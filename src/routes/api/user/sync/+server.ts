import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { and, eq, sql } from 'drizzle-orm';
import { chapterLikes, volumeLikes, listeningProgress, bookmarks } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return json({
			chapterLikes: [],
			volumeLikes: [],
			listeningProgress: [],
			bookmarks: []
		});
	}

	const [userChapterLikes, userVolumeLikes, userProgress, userBookmarks] = await Promise.all([
		db.select().from(chapterLikes).where(eq(chapterLikes.userId, user.id)),
		db.select().from(volumeLikes).where(eq(volumeLikes.userId, user.id)),
		db.select().from(listeningProgress).where(eq(listeningProgress.userId, user.id)),
		db.select().from(bookmarks).where(eq(bookmarks.userId, user.id))
	]);

	return json({
		chapterLikes: userChapterLikes.map((l) => ({
			chapterId: l.chapterId,
			createdAt: l.createdAt?.getTime() || 0
		})),
		volumeLikes: userVolumeLikes.map((l) => ({
			volumeId: l.volumeId,
			createdAt: l.createdAt?.getTime() || 0
		})),
		listeningProgress: userProgress.map((p) => ({
			chapterId: p.chapterId,
			progressSeconds: p.progressSeconds,
			isCompleted: p.isCompleted || false,
			updatedAt: p.updatedAt?.getTime() || 0
		})),
		bookmarks: userBookmarks.map((b) => ({
			id: b.id,
			chapterId: b.chapterId,
			timestampSeconds: b.timestampSeconds,
			note: b.note || '',
			createdAt: b.createdAt?.getTime() || 0
		}))
	});
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const items: Array<{
			chapterId: string;
			progressSeconds: number;
			isCompleted?: boolean;
		}> = body.progressUpdates || [];

		const bookmarkUpdates: Array<{
			id: string;
			chapterId: string;
			timestampSeconds: number;
			note?: string;
			action?: 'upsert' | 'delete';
		}> = body.bookmarkUpdates || [];

		// Handle progress updates
		if (Array.isArray(items) && items.length > 0) {
			for (const item of items) {
				if (!item.chapterId) continue;
				await db
					.insert(listeningProgress)
					.values({
						userId: user.id,
						chapterId: item.chapterId,
						progressSeconds: item.progressSeconds || 0,
						isCompleted: !!item.isCompleted,
						updatedAt: new Date()
					})
					.onConflictDoUpdate({
						target: [listeningProgress.userId, listeningProgress.chapterId],
						set: {
							progressSeconds: sql`GREATEST(${listeningProgress.progressSeconds}, ${item.progressSeconds})`,
							isCompleted: item.isCompleted ? true : listeningProgress.isCompleted,
							updatedAt: new Date()
						}
					});
			}
		}

		// Handle bookmark sync updates
		if (Array.isArray(bookmarkUpdates) && bookmarkUpdates.length > 0) {
			for (const b of bookmarkUpdates) {
				if (!b.id) continue;
				if (b.action === 'delete') {
					await db
						.delete(bookmarks)
						.where(and(eq(bookmarks.id, b.id), eq(bookmarks.userId, user.id)));
				} else {
					await db
						.insert(bookmarks)
						.values({
							id: b.id,
							userId: user.id,
							chapterId: b.chapterId,
							timestampSeconds: b.timestampSeconds || 0,
							note: b.note || '',
							createdAt: new Date()
						})
						.onConflictDoUpdate({
							target: bookmarks.id,
							set: {
								timestampSeconds: b.timestampSeconds,
								note: b.note || '',
								createdAt: new Date()
							}
						});
				}
			}
		}

		return json({
			success: true,
			progressCount: items.length,
			bookmarksCount: bookmarkUpdates.length
		});
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'Failed to sync data' },
			{ status: 500 }
		);
	}
};
