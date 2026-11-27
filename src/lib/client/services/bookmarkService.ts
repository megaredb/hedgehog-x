import { db, type OfflineBookmark } from '$lib/client/db';
import { getCurrentOwnerId } from '$lib/client/db/syncState';
import { createLogger } from '$lib/logger';
import { flushBookmarkQueue } from './bookmarkSync';

const log = createLogger('BookmarkService');

async function enqueue(action: 'ADD_BOOKMARK' | 'REMOVE_BOOKMARK', payload: unknown) {
	try {
		await db.syncQueue.add({
			action,
			payload,
			timestamp: Date.now(),
			ownerUserId: await getCurrentOwnerId()
		});
	} catch (err) {
		log.warn('Failed to enqueue bookmark change:', err);
	}
}

function normalizeEndTimestamp(start: number, end?: number | null): number | null {
	if (end == null || !Number.isFinite(end)) return null;
	const floored = Math.floor(end);
	return floored > start ? floored : null;
}

export const bookmarkService = {
	/**
	 * Creates a new bookmark locally and queues sync via bookmarkSync.
	 */
	async addBookmark(params: {
		chapterId: string;
		versionId?: string;
		timestampSeconds: number;
		endTimestampSeconds?: number | null;
		note?: string;
		broadcastId?: string;
		broadcastTitle?: string;
		broadcastBookTitle?: string;
		broadcastVolumeTitle?: string;
		broadcastCoverUrl?: string;
		broadcastHref?: string;
	}): Promise<OfflineBookmark> {
		const timestampSeconds = Math.max(0, Math.floor(params.timestampSeconds));
		const bookmark: OfflineBookmark = {
			id: crypto.randomUUID(),
			chapterId: params.chapterId,
			versionId: params.versionId ?? 'default',
			timestampSeconds,
			endTimestampSeconds: normalizeEndTimestamp(timestampSeconds, params.endTimestampSeconds),
			note: params.note?.trim() || '',
			createdAt: Date.now(),
			...(params.broadcastId
				? {
						broadcastId: params.broadcastId,
						broadcastTitle: params.broadcastTitle,
						broadcastBookTitle: params.broadcastBookTitle,
						broadcastVolumeTitle: params.broadcastVolumeTitle,
						broadcastCoverUrl: params.broadcastCoverUrl,
						broadcastHref: params.broadcastHref
					}
				: {})
		};

		await db.bookmarks.put(bookmark);
		await enqueue('ADD_BOOKMARK', bookmark);
		void flushBookmarkQueue();
		return bookmark;
	},

	/**
	 * Updates an existing bookmark locally and queues sync via bookmarkSync.
	 */
	async updateBookmark(
		id: string,
		params: { timestampSeconds: number; endTimestampSeconds?: number | null; note?: string }
	): Promise<OfflineBookmark | null> {
		const existing = await db.bookmarks.get(id);
		if (!existing) return null;
		const timestampSeconds = Math.max(0, Math.floor(params.timestampSeconds));
		const updated: OfflineBookmark = {
			...existing,
			timestampSeconds,
			endTimestampSeconds: normalizeEndTimestamp(timestampSeconds, params.endTimestampSeconds),
			note: params.note?.trim() || ''
		};
		await db.bookmarks.put(updated);
		await enqueue('ADD_BOOKMARK', updated);
		void flushBookmarkQueue();
		return updated;
	},

	/**
	 * Deletes a bookmark locally and queues deletion via bookmarkSync.
	 */
	async deleteBookmark(id: string): Promise<void> {
		await db.bookmarks.delete(id);
		await enqueue('REMOVE_BOOKMARK', { id });
		void flushBookmarkQueue();
	}
};
