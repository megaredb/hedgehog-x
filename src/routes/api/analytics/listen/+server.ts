import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { listeningSessions, dailyListeningStats, chapters, volumes } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import {
	validateListenSession,
	formatDateKey,
	buildDailyStatId,
	type ValidatedListenSession
} from '$lib/analytics/stats';
import { createLogger } from '$lib/logger';
import type { RequestHandler } from './$types';

const log = createLogger('AnalyticsAPI');
const MAX_BATCH = 100;
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function allowRequest(key: string): boolean {
	const now = Date.now();
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
		if (buckets.size > 5000) {
			for (const [k, value] of buckets) {
				if (value.resetAt <= now) buckets.delete(k);
			}
		}
		return true;
	}
	if (bucket.count >= RATE_LIMIT) return false;
	bucket.count++;
	return true;
}

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON request body' }, { status: 400 });
	}

	const userId = locals.user?.id ?? locals.session?.userId ?? null;
	const ip = (() => {
		try {
			return getClientAddress();
		} catch {
			return 'unknown';
		}
	})();
	const rateKey = userId ? 'user:' + userId : 'ip:' + ip;
	if (!allowRequest(rateKey)) {
		return json(
			{ error: 'Too many analytics requests' },
			{ status: 429, headers: { 'Retry-After': '60' } }
		);
	}

	let rawSessions: unknown[] = [];
	if (Array.isArray(body?.sessions)) {
		rawSessions = body.sessions;
	} else if (body && typeof body === 'object') {
		rawSessions = [body];
	}

	if (rawSessions.length === 0) {
		return json({ error: 'No listen sessions provided' }, { status: 400 });
	}
	if (rawSessions.length > MAX_BATCH) {
		return json({ error: 'Too many sessions in one batch', max: MAX_BATCH }, { status: 413 });
	}

	const validationErrors: string[] = [];
	const validatedSessions: ValidatedListenSession[] = [];
	for (const raw of rawSessions) {
		const validation = validateListenSession(raw);
		if (!validation.valid || !validation.session) {
			if (validationErrors.length < 5) {
				validationErrors.push(validation.error ?? 'Invalid listen session payload');
			}
			continue;
		}
		validatedSessions.push(validation.session);
	}

	let accepted = 0;
	let rejected = rawSessions.length - validatedSessions.length;
	let recordedSeconds = 0;

	for (const session of validatedSessions) {
		const [chapterRow] = await db
			.select({
				chapterId: chapters.id,
				volumeId: chapters.volumeId,
				bookId: volumes.bookId
			})
			.from(chapters)
			.leftJoin(volumes, eq(chapters.volumeId, volumes.id))
			.where(eq(chapters.id, session.chapterId))
			.limit(1);

		if (!chapterRow) {
			rejected++;
			if (validationErrors.length < 5) {
				validationErrors.push('Chapter not found: ' + session.chapterId);
			}
			continue;
		}

		const resolvedVolumeId = session.volumeId || chapterRow.volumeId;
		const resolvedBookId = session.bookId || chapterRow.bookId;

		await db.insert(listeningSessions).values({
			userId,
			bookId: resolvedBookId,
			volumeId: resolvedVolumeId,
			chapterId: session.chapterId,
			versionId: session.versionId,
			listenedSeconds: session.listenedSeconds,
			startedAt: session.startedAt,
			createdAt: new Date()
		});

		const dateKey = session.dateKey || formatDateKey(session.startedAt);
		const statId = buildDailyStatId(
			dateKey,
			resolvedBookId,
			session.chapterId,
			userId,
			session.versionId
		);

		await db
			.insert(dailyListeningStats)
			.values({
				id: statId,
				date: dateKey,
				userId,
				bookId: resolvedBookId,
				chapterId: session.chapterId,
				versionId: session.versionId,
				totalSeconds: session.listenedSeconds,
				sessionsCount: 1,
				updatedAt: new Date()
			})
			.onConflictDoUpdate({
				target: dailyListeningStats.id,
				set: {
					totalSeconds: sql`${dailyListeningStats.totalSeconds} + ${session.listenedSeconds}`,
					sessionsCount: sql`${dailyListeningStats.sessionsCount} + 1`,
					updatedAt: new Date()
				}
			});

		accepted++;
		recordedSeconds += session.listenedSeconds;
	}

	if (rejected > 0) {
		log.warn('Analytics batch partially rejected: ' + rejected + '/' + rawSessions.length);
	}

	return json({
		success: true,
		received: rawSessions.length,
		accepted,
		rejected,
		recordedSeconds,
		errors: validationErrors
	});
};
