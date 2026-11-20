import { db } from '$lib/client/db';
import { getCurrentOwnerId } from '$lib/client/db/syncState';
import { createLogger } from '$lib/logger';

const log = createLogger('ProgressSync');

interface ProgressUpdate {
	chapterId: string;
	progressSeconds: number;
	isCompleted: boolean;
}

class ProgressSyncService {
	private pendingUpdates = new Map<string, ProgressUpdate>();
	private syncTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingOwner: string | null = null;
	private pendingOwnerPromise: Promise<string | null> | null = null;
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
	 * The owner is captured when the first update is recorded: a guest's
	 * progress must not suddenly become account-owned after login.
	 */
	recordProgress(chapterId: string, progressSeconds: number, isCompleted = false) {
		this.pendingUpdates.set(chapterId, {
			chapterId,
			progressSeconds,
			isCompleted
		});

		if (!this.pendingOwnerPromise) {
			this.pendingOwnerPromise = getCurrentOwnerId().then((owner) => {
				this.pendingOwner = owner;
				return owner;
			});
		}

		if (!this.syncTimer) {
			this.syncTimer = setTimeout(() => {
				this.flushImmediately();
			}, this.BATCH_INTERVAL_MS);
		}
	}

	private async enqueue(updates: ProgressUpdate[], ownerUserId: string | null): Promise<void> {
		try {
			await db.syncQueue.add({
				action: 'UPDATE_PROGRESS',
				payload: updates,
				timestamp: Date.now(),
				ownerUserId
			});
			log.debug('Progress saved to offline syncQueue.');
		} catch (err) {
			log.warn('Failed to save progress to syncQueue:', err);
		}
	}

	/**
	 * Flushes pending progress immediately to the server or offline queue.
	 * If the current owner differs from the owner at record time, the update is
	 * queued under the original owner instead of being sent under a new session.
	 */
	async flushImmediately() {
		if (this.syncTimer) {
			clearTimeout(this.syncTimer);
			this.syncTimer = null;
		}

		if (this.pendingUpdates.size === 0) return;

		const updates = Array.from(this.pendingUpdates.values());
		const recordedOwner = await (this.pendingOwnerPromise ?? Promise.resolve(null));
		this.pendingUpdates.clear();
		this.pendingOwnerPromise = null;
		this.pendingOwner = null;

		const currentOwner = await getCurrentOwnerId();
		const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

		if (!isOnline || currentOwner === null || recordedOwner !== currentOwner) {
			await this.enqueue(updates, recordedOwner);
			return;
		}

		try {
			const res = await fetch('/api/user/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ progressUpdates: updates })
			});

			if (!res.ok) {
				// 401 keeps the data for a later login; 5xx/429 are retryable.
				// Other 4xx are permanent (bad chapter/payload) and must not poison
				// the queue forever.
				if (res.status === 401 || res.status >= 500 || res.status === 429) {
					await this.enqueue(updates, recordedOwner);
				} else {
					log.warn(`Dropping invalid progress update after HTTP ${res.status}.`);
				}
			} else {
				log.debug(`Synced progress for ${updates.length} chapters.`);
			}
		} catch (err) {
			log.warn('Failed to send progress to server, enqueuing offline:', err);
			await this.enqueue(updates, recordedOwner);
		}
	}

	/**
	 * Flushes enqueued offline progress updates for the current owner.
	 */
	async flushOfflineQueue() {
		try {
			const ownerUserId = await getCurrentOwnerId();
			const queuedItems = (
				await db.syncQueue.where('action').equals('UPDATE_PROGRESS').toArray()
			).filter((item) => (item.ownerUserId ?? null) === ownerUserId);
			if (queuedItems.length === 0) return;

			for (const item of queuedItems) {
				const updates = item.payload as ProgressUpdate[];
				let shouldDelete = true;
				for (let i = 0; i < updates.length; i += 100) {
					const chunk = updates.slice(i, i + 100);
					const res = await fetch('/api/user/sync', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ progressUpdates: chunk })
					});

					if (
						!res.ok &&
						!(res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429)
					) {
						shouldDelete = false;
						break;
					}
				}

				if (item.id && shouldDelete) {
					// 4xx (except 401/429) is a permanent validation error; retrying it would block
					// every later progress update. Keep 401/429/5xx for retry.
					await db.syncQueue.delete(item.id);
				}
			}
			log.info('Offline progress queue flushed to server.');
		} catch (err) {
			log.warn('Failed to flush offline progress queue:', err);
		}
	}

	/**
	 * Deletes server progress and the local queue for the current owner.
	 * Guest/expired sessions fall back to clearing only local progress.
	 */
	async clearAllProgress(): Promise<boolean> {
		try {
			const ownerUserId = await getCurrentOwnerId();
			const res = await fetch('/api/user/progress/clear', { method: 'POST' });
			if (!res.ok && res.status !== 401) return false;

			await db.progress.clear();
			const queued = (
				await db.syncQueue.where('action').equals('UPDATE_PROGRESS').toArray()
			).filter((item) => (item.ownerUserId ?? null) === ownerUserId);
			const ids = queued.map((item) => item.id).filter((id): id is number => id !== undefined);
			if (ids.length > 0) await db.syncQueue.bulkDelete(ids);
			this.clearPending();
			return true;
		} catch {
			return false;
		}
	}

	/** Drops in-memory progress so logout cannot write it under the next session. */
	clearPending() {
		if (this.syncTimer) {
			clearTimeout(this.syncTimer);
			this.syncTimer = null;
		}
		this.pendingUpdates.clear();
		this.pendingOwner = null;
		this.pendingOwnerPromise = null;
	}

	get pendingOwnerUserId(): string | null {
		return this.pendingOwner;
	}
}

export const progressSync = new ProgressSyncService();
