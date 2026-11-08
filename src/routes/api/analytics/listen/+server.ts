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
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON request body' }, { status: 400 });
	}

	const userId = locals.user?.id ?? locals.session?.userId ?? null;

	let rawSessions: unknown[] = [];
	if (Array.isArray(body?.sessions)) {
		rawSessions = body.sessions;
	} else if (body && typeof body === 'object') {
		rawSessions = [body];
	}

	if (rawSessions.length === 0) {
		return json({ error: 'No listen sessions provided' }, { status: 400 });
	}

	const validatedSessions: ValidatedListenSession[] = [];
	for (const raw of rawSessions) {
		const validation = validateListenSession(raw);
		if (!validation.valid || !validation.session) {
			return json({ error: validation.error ?? 'Invalid listen session payload' }, { status: 400 });
		}
		validatedSessions.push(validation.session);
	}

	let recordedSeconds = 0;

	for (const session of validatedSessions) {
		// Verify chapter existence and resolve bookId / volumeId
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
			return json({ error: `Chapter not found: ${session.chapterId}` }, { status: 400 });
		}

		const resolvedVolumeId = session.volumeId || chapterRow.volumeId;
		const resolvedBookId = session.bookId || chapterRow.bookId;

		// Record raw listening session
		await db.insert(listeningSessions).values({
			userId,
			bookId: resolvedBookId,
			volumeId: resolvedVolumeId,
			chapterId: session.chapterId,
			listenedSeconds: session.listenedSeconds,
			startedAt: session.startedAt,
			createdAt: new Date()
		});

		// Aggregate / upsert into daily_listening_stats
		const dateKey = formatDateKey(session.startedAt);
		const statId = buildDailyStatId(dateKey, resolvedBookId, session.chapterId, userId);

		await db
			.insert(dailyListeningStats)
			.values({
				id: statId,
				date: dateKey,
				userId,
				bookId: resolvedBookId,
				chapterId: session.chapterId,
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

		recordedSeconds += session.listenedSeconds;
	}

	return json({
		success: true,
		received: validatedSessions.length,
		recordedSeconds
	});
};
