import { db, type OfflineBookmark } from '$lib/client/db';
import { createLogger } from '$lib/logger';

const log = createLogger('BookmarkService');

export const bookmarkService = {
	/**
	 * Creates a new bookmark locally and syncs it with the server if online.
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
				await fetch('/api/user/sync', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						bookmarkUpdates: [{ ...bookmark, action: 'upsert' }]
					})
				});
			} catch (err) {
				log.warn('Failed to sync bookmark to server:', err);
			}
		} else {
			try {
				await db.syncQueue.add({
					action: 'ADD_BOOKMARK',
					payload: bookmark,
					timestamp: Date.now()
				});
			} catch (err) {
				log.warn('Failed to enqueue bookmark in syncQueue:', err);
			}
		}

		return bookmark;
	},

	/**
	 * Deletes a bookmark locally and syncs deletion with the server.
	 */
	async deleteBookmark(id: string): Promise<void> {
		await db.bookmarks.delete(id);

		if (typeof navigator !== 'undefined' && navigator.onLine) {
			try {
				await fetch('/api/user/sync', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						bookmarkUpdates: [{ id, action: 'delete' }]
					})
				});
			} catch (err) {
				log.warn('Failed to sync bookmark deletion to server:', err);
			}
		} else {
			try {
				await db.syncQueue.add({
					action: 'REMOVE_BOOKMARK',
					payload: { id },
					timestamp: Date.now()
				});
			} catch (err) {
				log.warn('Failed to enqueue bookmark deletion in syncQueue:', err);
			}
		}
	}
};
