import { db } from '$lib/client/db';
import { createLogger } from '$lib/logger';

const log = createLogger('ProgressSync');

class ProgressSyncService {
	private pendingUpdates = new Map<
		string,
		{ chapterId: string; progressSeconds: number; isCompleted: boolean }
	>();
	private syncTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly BATCH_INTERVAL_MS = 30000;

	constructor() {
		if (typeof window !== 'undefined') {
			window.addEventListener('online', () => this.flushOfflineQueue());
			window.addEventListener('beforeunload', () => this.flushImmediately());
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'hidden') {
					this.flushImmediately();
				}
			});
		}
	}

	/**
	 * Records playback progress in memory to batch sync requests.
	 */
	recordProgress(chapterId: string, progressSeconds: number, isCompleted = false) {
		this.pendingUpdates.set(chapterId, {
			chapterId,
			progressSeconds,
			isCompleted
		});

		if (!this.syncTimer) {
			this.syncTimer = setTimeout(() => {
				this.flushImmediately();
			}, this.BATCH_INTERVAL_MS);
		}
	}

	/**
	 * Flushes pending progress immediately to the server or offline queue.
	 */
	async flushImmediately() {
		if (this.syncTimer) {
			clearTimeout(this.syncTimer);
			this.syncTimer = null;
		}

		if (this.pendingUpdates.size === 0) return;

		const updates = Array.from(this.pendingUpdates.values());
		this.pendingUpdates.clear();

		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			try {
				await db.syncQueue.add({
					action: 'UPDATE_PROGRESS',
					payload: updates,
					timestamp: Date.now()
				});
				log.debug('Progress saved to offline syncQueue.');
			} catch (err) {
				log.warn('Failed to save progress to syncQueue:', err);
			}
			return;
		}

		try {
			const res = await fetch('/api/user/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ progressUpdates: updates })
			});

			if (!res.ok && res.status !== 401) {
				await db.syncQueue.add({
					action: 'UPDATE_PROGRESS',
					payload: updates,
					timestamp: Date.now()
				});
			} else if (res.ok) {
				log.debug(`Synced progress for ${updates.length} chapters.`);
			}
		} catch (err) {
			log.warn('Failed to send progress to server, enqueuing offline:', err);
			await db.syncQueue
				.add({
					action: 'UPDATE_PROGRESS',
					payload: updates,
					timestamp: Date.now()
				})
				.catch(() => {});
		}
	}

	/**
	 * Flushes enqueued offline progress updates when connectivity returns.
	 */
	async flushOfflineQueue() {
		try {
			const queuedItems = await db.syncQueue.where('action').equals('UPDATE_PROGRESS').toArray();
			if (queuedItems.length === 0) return;

			for (const item of queuedItems) {
				const updates = item.payload as Array<{
					chapterId: string;
					progressSeconds: number;
					isCompleted: boolean;
				}>;
				const res = await fetch('/api/user/sync', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ progressUpdates: updates })
				});

				if (res.ok && item.id) {
					await db.syncQueue.delete(item.id);
				}
			}
			log.info('Offline progress queue flushed to server.');
		} catch (err) {
			log.warn('Failed to flush offline progress queue:', err);
		}
	}
}

export const progressSync = new ProgressSyncService();
