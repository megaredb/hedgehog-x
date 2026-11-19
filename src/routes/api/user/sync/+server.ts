import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { and, eq, inArray } from 'drizzle-orm';
import {
	chapterLikes,
	volumeLikes,
	listeningProgress,
	bookmarks,
	chapters,
	volumes
} from '$lib/server/db/schema';
import { createLogger } from '$lib/logger';
import { boundedText as text, timestampSeconds as time } from '$lib/utils/validation';
import type { RequestHandler } from './$types';

const log = createLogger('UserSyncAPI');
const MAX_ITEMS = 100;
const MAX_BODY_BYTES = 1024 * 1024;
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function allowRequest(key: string): boolean {
	const now = Date.now();
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
		if (buckets.size > 5000) {
			for (const [k, value] of buckets) if (value.resetAt <= now) buckets.delete(k);
		}
		return true;
	}
	if (bucket.count >= RATE_LIMIT) return false;
	bucket.count++;
	return true;
}

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const sessionCreatedAt = locals.session?.createdAt
		? new Date(locals.session.createdAt).getTime()
		: 0;
	const userCreatedAt = user.createdAt ? new Date(user.createdAt).getTime() : 0;
	const isNewUser =
		sessionCreatedAt > 0 &&
		userCreatedAt > 0 &&
		Math.abs(sessionCreatedAt - userCreatedAt) < 60_000;

	const [userChapterLikes, userVolumeLikes, userProgress, userBookmarks] = await Promise.all([
		db.select().from(chapterLikes).where(eq(chapterLikes.userId, user.id)),
		db.select().from(volumeLikes).where(eq(volumeLikes.userId, user.id)),
		db.select().from(listeningProgress).where(eq(listeningProgress.userId, user.id)),
		db.select().from(bookmarks).where(eq(bookmarks.userId, user.id))
	]);

	return json(
		{
			authenticated: true,
			userId: user.id,
			userName: user.name,
			isNewUser,
			chapterLikes: userChapterLikes.map((like) => ({
				chapterId: like.chapterId,
				createdAt: like.createdAt?.getTime() || 0
			})),
			volumeLikes: userVolumeLikes.map((like) => ({
				volumeId: like.volumeId,
				createdAt: like.createdAt?.getTime() || 0
			})),
			listeningProgress: userProgress.map((progress) => ({
				chapterId: progress.chapterId,
				progressSeconds: progress.progressSeconds,
				isCompleted: progress.isCompleted || false,
				updatedAt: progress.updatedAt?.getTime() || 0
			})),
			bookmarks: userBookmarks.map((bookmark) => ({
				id: bookmark.id,
				chapterId: bookmark.chapterId,
				timestampSeconds: bookmark.timestampSeconds,
				note: bookmark.note || '',
				createdAt: bookmark.createdAt?.getTime() || 0
			}))
		},
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const length = Number(request.headers.get('content-length') || '0');
	if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
		return json({ error: 'Sync body is too large', maxBytes: MAX_BODY_BYTES }, { status: 413 });
	}
	if (!allowRequest('user:' + user.id)) {
		return json(
			{ error: 'Too many sync requests' },
			{ status: 429, headers: { 'Retry-After': '60' } }
		);
	}

	let body: Record<string, unknown>;
	try {
		const parsed = await request.json();
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return json({ error: 'Body must be a JSON object' }, { status: 400 });
		}
		body = parsed as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON request body' }, { status: 400 });
	}

	const source = {
		progressUpdates: body.progressUpdates,
		bookmarkUpdates: body.bookmarkUpdates,
		volumeLikeUpdates: body.volumeLikeUpdates,
		chapterLikeUpdates: body.chapterLikeUpdates
	};
	for (const value of Object.values(source)) {
		if (value !== undefined && !Array.isArray(value))
			return json({ error: 'Each update field must be an array' }, { status: 400 });
		if (Array.isArray(value) && value.length > MAX_ITEMS)
			return json({ error: 'Too many items in one batch', max: MAX_ITEMS }, { status: 413 });
	}

	const errors: string[] = [];
	const progress: Array<{ chapterId: string; progressSeconds: number; isCompleted: boolean }> = [];
	for (const raw of Array.isArray(source.progressUpdates) ? source.progressUpdates : []) {
		const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
		const chapterId = text(item?.chapterId);
		const progressSeconds = typeof item?.progressSeconds === 'number' ? item.progressSeconds : NaN;
		if (
			!chapterId ||
			!Number.isFinite(progressSeconds) ||
			progressSeconds < 0 ||
			progressSeconds > 86_400
		) {
			if (errors.length < 5) errors.push('Invalid progress update');
			continue;
		}
		progress.push({
			chapterId,
			progressSeconds: Math.floor(progressSeconds),
			isCompleted: item?.isCompleted === true
		});
	}

	const bookmarkUpdates: Array<{
		id: string;
		chapterId: string;
		timestampSeconds: number;
		note: string;
		action: 'upsert' | 'delete';
	}> = [];
	for (const raw of Array.isArray(source.bookmarkUpdates) ? source.bookmarkUpdates : []) {
		const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
		const id = text(item?.id);
		const chapterId = text(item?.chapterId);
		const timestampSeconds = time(item?.timestampSeconds);
		const note = typeof item?.note === 'string' ? item.note.slice(0, 500) : '';
		const action = item?.action === 'delete' ? 'delete' : 'upsert';
		if (!id || !chapterId || (action === 'upsert' && timestampSeconds === null)) {
			if (errors.length < 5) errors.push('Invalid bookmark update');
			continue;
		}
		bookmarkUpdates.push({ id, chapterId, timestampSeconds: timestampSeconds ?? 0, note, action });
	}

	const volumeLikeUpdates: Array<{ volumeId: string; action: 'like' | 'unlike' }> = [];
	for (const raw of Array.isArray(source.volumeLikeUpdates) ? source.volumeLikeUpdates : []) {
		const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
		const volumeId = text(item?.volumeId) || text(item?.id);
		const action = item?.action === 'unlike' ? 'unlike' : 'like';
		if (!volumeId) {
			if (errors.length < 5) errors.push('Invalid volume like update');
			continue;
		}
		volumeLikeUpdates.push({ volumeId, action });
	}

	const chapterLikeUpdates: Array<{ chapterId: string; action: 'like' | 'unlike' }> = [];
	for (const raw of Array.isArray(source.chapterLikeUpdates) ? source.chapterLikeUpdates : []) {
		const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
		const chapterId = text(item?.chapterId) || text(item?.id);
		const action = item?.action === 'unlike' ? 'unlike' : 'like';
		if (!chapterId) {
			if (errors.length < 5) errors.push('Invalid chapter like update');
			continue;
		}
		chapterLikeUpdates.push({ chapterId, action });
	}

	try {
		const result = await db.transaction(async (tx) => {
			const chapterIds = [
				...new Set([
					...progress.map((item) => item.chapterId),
					...bookmarkUpdates.map((item) => item.chapterId),
					...chapterLikeUpdates.map((item) => item.chapterId)
				])
			];
			const volumeIds = [...new Set(volumeLikeUpdates.map((item) => item.volumeId))];
			const knownChapters = chapterIds.length
				? await tx
						.select({ id: chapters.id })
						.from(chapters)
						.where(inArray(chapters.id, chapterIds))
				: [];
			const knownVolumes = volumeIds.length
				? await tx.select({ id: volumes.id }).from(volumes).where(inArray(volumes.id, volumeIds))
				: [];
			const knownChapterIds = new Set(knownChapters.map((item) => item.id));
			const knownVolumeIds = new Set(knownVolumes.map((item) => item.id));
			const skipped =
				progress.filter((item) => !knownChapterIds.has(item.chapterId)).length +
				bookmarkUpdates.filter((item) => !knownChapterIds.has(item.chapterId)).length +
				chapterLikeUpdates.filter((item) => !knownChapterIds.has(item.chapterId)).length +
				volumeLikeUpdates.filter((item) => !knownVolumeIds.has(item.volumeId)).length;
			const validProgress = progress.filter((item) => knownChapterIds.has(item.chapterId));
			const validBookmarks = bookmarkUpdates.filter((item) => knownChapterIds.has(item.chapterId));
			const validChapterLikes = chapterLikeUpdates.filter((item) =>
				knownChapterIds.has(item.chapterId)
			);
			const validVolumeLikes = volumeLikeUpdates.filter((item) =>
				knownVolumeIds.has(item.volumeId)
			);

			const currentProgress = await tx
				.select()
				.from(listeningProgress)
				.where(eq(listeningProgress.userId, user.id));
			const progressMap = new Map(currentProgress.map((item) => [item.chapterId, item]));
			for (const item of validProgress) {
				const previous = progressMap.get(item.chapterId);
				const seconds = Math.max(previous?.progressSeconds ?? 0, item.progressSeconds);
				const completed = previous?.isCompleted || item.isCompleted;
				await tx
					.insert(listeningProgress)
					.values({
						userId: user.id,
						chapterId: item.chapterId,
						progressSeconds: seconds,
						isCompleted: completed,
						updatedAt: new Date()
					})
					.onConflictDoUpdate({
						target: [listeningProgress.userId, listeningProgress.chapterId],
						set: { progressSeconds: seconds, isCompleted: completed, updatedAt: new Date() }
					});
			}

			const ownBookmarks = await tx
				.select({ id: bookmarks.id })
				.from(bookmarks)
				.where(eq(bookmarks.userId, user.id));
			const ownBookmarkIds = new Set(ownBookmarks.map((item) => item.id));
			for (const item of validBookmarks) {
				if (item.action === 'delete') {
					await tx
						.delete(bookmarks)
						.where(and(eq(bookmarks.id, item.id), eq(bookmarks.userId, user.id)));
					ownBookmarkIds.delete(item.id);
				} else if (ownBookmarkIds.has(item.id)) {
					await tx
						.update(bookmarks)
						.set({
							timestampSeconds: item.timestampSeconds,
							note: item.note,
							createdAt: new Date()
						})
						.where(and(eq(bookmarks.id, item.id), eq(bookmarks.userId, user.id)));
				} else {
					await tx.insert(bookmarks).values({
						id: item.id,
						userId: user.id,
						chapterId: item.chapterId,
						timestampSeconds: item.timestampSeconds,
						note: item.note,
						createdAt: new Date()
					});
					ownBookmarkIds.add(item.id);
				}
			}

			for (const item of validVolumeLikes) {
				if (item.action === 'unlike')
					await tx
						.delete(volumeLikes)
						.where(and(eq(volumeLikes.userId, user.id), eq(volumeLikes.volumeId, item.volumeId)));
				else
					await tx
						.insert(volumeLikes)
						.values({ userId: user.id, volumeId: item.volumeId, createdAt: new Date() })
						.onConflictDoNothing();
			}
			for (const item of validChapterLikes) {
				if (item.action === 'unlike')
					await tx
						.delete(chapterLikes)
						.where(
							and(eq(chapterLikes.userId, user.id), eq(chapterLikes.chapterId, item.chapterId))
						);
				else
					await tx
						.insert(chapterLikes)
						.values({ userId: user.id, chapterId: item.chapterId, createdAt: new Date() })
						.onConflictDoNothing();
			}

			return {
				progressCount: validProgress.length,
				bookmarksCount: validBookmarks.length,
				volumeLikesCount: validVolumeLikes.length,
				chapterLikesCount: validChapterLikes.length,
				skipped
			};
		});

		if (result.skipped && errors.length < 5)
			errors.push('Some items referenced a missing chapter or volume');
		return json({ success: true, ...result, rejected: result.skipped, errors });
	} catch (error) {
		log.error('User data sync failed', error);
		return json({ error: 'Failed to sync data' }, { status: 500 });
	}
};
