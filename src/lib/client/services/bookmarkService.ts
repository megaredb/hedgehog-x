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
		timestampSeconds: number;
		note?: string;
	}): Promise<OfflineBookmark> {
		const bookmark: OfflineBookmark = {
			id: crypto.randomUUID(),
			chapterId: params.chapterId,
			timestampSeconds: Math.floor(params.timestampSeconds),
			note: params.note?.trim() || '',
			createdAt: Date.now()
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
