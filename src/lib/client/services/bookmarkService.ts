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

async function postBookmarkUpdates(updates: unknown[]): Promise<void> {
	const res = await fetch('/api/user/sync', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ bookmarkUpdates: updates })
	});

	if (!res.ok) {
		throw new Error('HTTP ' + res.status);
	}
}

export const bookmarkService = {
	/**
	 * Creates a new bookmark locally and syncs it with the server if online.
	 * Failures are queued and retried by bookmarkSync.
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
		const bookmark: OfflineBookmark = {
			id: crypto.randomUUID(),
			chapterId: params.chapterId,
			versionId: params.versionId ?? 'default',
			timestampSeconds: Math.floor(params.timestampSeconds),
			endTimestampSeconds:
				params.endTimestampSeconds != null ? Math.floor(params.endTimestampSeconds) : null,
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

		if (typeof navigator !== 'undefined' && navigator.onLine) {
			try {
				await postBookmarkUpdates([{ ...bookmark, action: 'upsert' }]);
				return bookmark;
			} catch (err) {
				log.warn('Failed to sync bookmark, queueing retry:', err);
			}
		}

		await enqueue('ADD_BOOKMARK', bookmark);
		void flushBookmarkQueue();
		return bookmark;
	},

	/**
	 * Updates an existing bookmark locally and syncs the change with the server.
	 */
	async updateBookmark(
		id: string,
		params: { timestampSeconds: number; endTimestampSeconds?: number | null; note?: string }
	): Promise<OfflineBookmark | null> {
		const existing = await db.bookmarks.get(id);
		if (!existing) return null;
		const updated: OfflineBookmark = {
			...existing,
			timestampSeconds: Math.floor(params.timestampSeconds),
			endTimestampSeconds:
				params.endTimestampSeconds != null ? Math.floor(params.endTimestampSeconds) : null,
			note: params.note?.trim() || ''
		};
		await db.bookmarks.put(updated);

		if (typeof navigator !== 'undefined' && navigator.onLine) {
			try {
				await postBookmarkUpdates([{ ...updated, action: 'upsert' }]);
				return updated;
			} catch (err) {
				log.warn('Failed to sync bookmark update, queueing retry:', err);
			}
		}

		await enqueue('ADD_BOOKMARK', updated);
		void flushBookmarkQueue();
		return updated;
	},

	/**
	 * Deletes a bookmark locally and syncs deletion with the server.
	 * Failures are queued and retried by bookmarkSync.
	 */
	async deleteBookmark(id: string): Promise<void> {
		await db.bookmarks.delete(id);

		if (typeof navigator !== 'undefined' && navigator.onLine) {
			try {
				await postBookmarkUpdates([{ id, action: 'delete' }]);
				return;
			} catch (err) {
				log.warn('Failed to sync bookmark deletion, queueing retry:', err);
			}
		}

		await enqueue('REMOVE_BOOKMARK', { id });
		void flushBookmarkQueue();
	}
};
