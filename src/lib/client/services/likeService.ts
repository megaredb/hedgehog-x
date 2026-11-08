import { db, type SyncItem } from '$lib/client/db';
import { createLogger } from '$lib/logger';

const log = createLogger('LikeService');

export interface LikeToggleResult {
	liked: boolean;
	likesCount: number;
}

export interface LikeSyncResult {
	synced: number;
	status?: number;
	error?: string;
}

export function createLikeService(database = db) {
	let isSyncing = false;

	return {
		/**
		 * Optimistically toggles like status for a volume in local Dexie storage,
		 * updates the likes count, queues an offline sync mutation, and flushes to the server if online.
		 */
		async toggleVolumeLike(
			volumeId: string,
			currentCount?: number,
			fetchFn: typeof fetch = fetch
		): Promise<LikeToggleResult> {
			const existing = await database.volumeLikes.get(volumeId);
			const isCurrentlyLiked = !!existing;
			const targetLiked = !isCurrentlyLiked;

			const vol = await database.volumes.get(volumeId);
			const baseCount = vol?.likesCount ?? currentCount ?? (isCurrentlyLiked ? 1 : 0);
			const newLikesCount = targetLiked ? baseCount + 1 : Math.max(0, baseCount - 1);

			if (targetLiked) {
				await database.volumeLikes.put({
					volumeId,
					createdAt: Date.now()
				});
				if (vol) {
					await database.volumes.update(volumeId, { likesCount: newLikesCount });
				}
				await database.syncQueue.add({
					action: 'LIKE_VOLUME',
					payload: { id: volumeId, volumeId },
					timestamp: Date.now()
				} as SyncItem);
			} else {
				await database.volumeLikes.delete(volumeId);
				if (vol) {
					await database.volumes.update(volumeId, { likesCount: newLikesCount });
				}
				await database.syncQueue.add({
					action: 'UNLIKE_VOLUME',
					payload: { id: volumeId, volumeId },
					timestamp: Date.now()
				} as SyncItem);
			}

			if (typeof navigator !== 'undefined' && navigator.onLine) {
				this.syncLikesQueue(fetchFn).catch((err) => {
					log.warn('Background volume like sync failed:', err);
				});
			}

			return { liked: targetLiked, likesCount: newLikesCount };
		},

		/**
		 * Optimistically toggles like status for a chapter in local Dexie storage,
		 * updates the likes count, queues an offline sync mutation, and flushes to the server if online.
		 */
		async toggleChapterLike(
			chapterId: string,
			currentCount?: number,
			fetchFn: typeof fetch = fetch
		): Promise<LikeToggleResult> {
			const existing = await database.chapterLikes.get(chapterId);
			const isCurrentlyLiked = !!existing;
			const targetLiked = !isCurrentlyLiked;

			const ch = await database.chapters.get(chapterId);
			const baseCount = ch?.likesCount ?? currentCount ?? (isCurrentlyLiked ? 1 : 0);
			const newLikesCount = targetLiked ? baseCount + 1 : Math.max(0, baseCount - 1);

			if (targetLiked) {
				await database.chapterLikes.put({
					chapterId,
					createdAt: Date.now()
				});
				if (ch) {
					await database.chapters.update(chapterId, { likesCount: newLikesCount });
				}
				await database.syncQueue.add({
					action: 'LIKE_CHAPTER',
					payload: { id: chapterId, chapterId },
					timestamp: Date.now()
				} as SyncItem);
			} else {
				await database.chapterLikes.delete(chapterId);
				if (ch) {
					await database.chapters.update(chapterId, { likesCount: newLikesCount });
				}
				await database.syncQueue.add({
					action: 'UNLIKE_CHAPTER',
					payload: { id: chapterId, chapterId },
					timestamp: Date.now()
				} as SyncItem);
			}

			if (typeof navigator !== 'undefined' && navigator.onLine) {
				this.syncLikesQueue(fetchFn).catch((err) => {
					log.warn('Background chapter like sync failed:', err);
				});
			}

			return { liked: targetLiked, likesCount: newLikesCount };
		},

		/**
		 * Flushes queued like/unlike mutations to POST /api/user/sync and cleans up processed items.
		 */
		async syncLikesQueue(fetchFn: typeof fetch = fetch): Promise<LikeSyncResult> {
			if (isSyncing) return { synced: 0 };
			isSyncing = true;

			try {
				const likeActions = [
					'LIKE_VOLUME',
					'UNLIKE_VOLUME',
					'LIKE_CHAPTER',
					'UNLIKE_CHAPTER'
				] as const;
				const items = await database.syncQueue
					.where('action')
					.anyOf([...likeActions])
					.toArray();

				if (items.length === 0) return { synced: 0 };

				const volumeLikeUpdates: Array<{
					id: string;
					volumeId: string;
					action: 'like' | 'unlike';
					timestamp: number;
				}> = [];
				const chapterLikeUpdates: Array<{
					id: string;
					chapterId: string;
					action: 'like' | 'unlike';
					timestamp: number;
				}> = [];
				const processedIds: number[] = [];

				for (const item of items) {
					const payload = (item.payload || (item as unknown as { data?: unknown }).data || {}) as {
						id?: string;
						volumeId?: string;
						chapterId?: string;
					};
					const targetId = payload.volumeId || payload.chapterId || payload.id;
					if (!targetId) {
						if (item.id !== undefined) processedIds.push(item.id);
						continue;
					}

					if (item.action === 'LIKE_VOLUME') {
						volumeLikeUpdates.push({
							id: targetId,
							volumeId: targetId,
							action: 'like',
							timestamp: item.timestamp
						});
						if (item.id !== undefined) processedIds.push(item.id);
					} else if (item.action === 'UNLIKE_VOLUME') {
						volumeLikeUpdates.push({
							id: targetId,
							volumeId: targetId,
							action: 'unlike',
							timestamp: item.timestamp
						});
						if (item.id !== undefined) processedIds.push(item.id);
					} else if (item.action === 'LIKE_CHAPTER') {
						chapterLikeUpdates.push({
							id: targetId,
							chapterId: targetId,
							action: 'like',
							timestamp: item.timestamp
						});
						if (item.id !== undefined) processedIds.push(item.id);
					} else if (item.action === 'UNLIKE_CHAPTER') {
						chapterLikeUpdates.push({
							id: targetId,
							chapterId: targetId,
							action: 'unlike',
							timestamp: item.timestamp
						});
						if (item.id !== undefined) processedIds.push(item.id);
					}
				}

				if (volumeLikeUpdates.length === 0 && chapterLikeUpdates.length === 0) {
					for (const id of processedIds) {
						await database.syncQueue.delete(id);
					}
					return { synced: processedIds.length };
				}

				const res = await fetchFn('/api/user/sync', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						volumeLikeUpdates,
						chapterLikeUpdates
					})
				});

				if (res.ok) {
					for (const id of processedIds) {
						await database.syncQueue.delete(id);
					}
					log.info(`Synced ${processedIds.length} like mutations to server.`);
					return { synced: processedIds.length };
				} else {
					log.warn(`Sync likes queue failed with status ${res.status}`);
					return { synced: 0, status: res.status };
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				log.warn('Failed to sync likes queue (offline or network error):', message);
				return { synced: 0, error: message };
			} finally {
				isSyncing = false;
			}
		},

		/**
		 * Checks whether a volume is currently liked locally.
		 */
		async isVolumeLiked(volumeId: string): Promise<boolean> {
			const record = await database.volumeLikes.get(volumeId);
			return !!record;
		},

		/**
		 * Checks whether a chapter is currently liked locally.
		 */
		async isChapterLiked(chapterId: string): Promise<boolean> {
			const record = await database.chapterLikes.get(chapterId);
			return !!record;
		},

		/**
		 * Returns the cached likes count for a volume.
		 */
		async getVolumeLikesCount(volumeId: string): Promise<number> {
			const vol = await database.volumes.get(volumeId);
			return vol?.likesCount ?? 0;
		},

		/**
		 * Returns the cached likes count for a chapter.
		 */
		async getChapterLikesCount(chapterId: string): Promise<number> {
			const ch = await database.chapters.get(chapterId);
			return ch?.likesCount ?? 0;
		}
	};
}

export const likeService = createLikeService(db);

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => {
		likeService.syncLikesQueue().catch((e) => {
			log.warn('Auto online likes sync error:', e);
		});
	});
}
