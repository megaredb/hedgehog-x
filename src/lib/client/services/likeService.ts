import { db, type SyncItem } from '$lib/client/db';
import { isMutationOwnedBy } from '$lib/client/db/syncState';
import { audioVersionKey } from '$lib/audio-version';
import { createLogger } from '$lib/logger';

const log = createLogger('LikeService');
const MAX_SYNC_BATCH = 100;

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

	async function resolveOwner(): Promise<string | null> {
		const meta = (
			database as unknown as {
				meta?: { get(key: string): Promise<{ userId?: string | null } | undefined> };
			}
		).meta;
		if (!meta) return null;
		const record = await meta.get('syncOwner');
		return record?.userId ?? null;
	}

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
			const ownerUserId = await resolveOwner();

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
					timestamp: Date.now(),
					ownerUserId
				} as SyncItem);
			} else {
				await database.volumeLikes.delete(volumeId);
				if (vol) {
					await database.volumes.update(volumeId, { likesCount: newLikesCount });
				}
				await database.syncQueue.add({
					action: 'UNLIKE_VOLUME',
					payload: { id: volumeId, volumeId },
					timestamp: Date.now(),
					ownerUserId
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
			versionId = 'default',
			fetchFn: typeof fetch = fetch
		): Promise<LikeToggleResult> {
			const key = audioVersionKey(chapterId, versionId);
			const existing = await database.chapterLikes.get(key);
			const isCurrentlyLiked = !!existing;
			const targetLiked = !isCurrentlyLiked;
			const ownerUserId = await resolveOwner();

			const ch = versionId === 'default' ? await database.chapters.get(chapterId) : undefined;
			const baseCount = currentCount ?? ch?.likesCount ?? (isCurrentlyLiked ? 1 : 0);
			const newLikesCount = targetLiked ? baseCount + 1 : Math.max(0, baseCount - 1);

			if (targetLiked) {
				await database.chapterLikes.put({
					chapterId: key,
					baseChapterId: chapterId,
					versionId,
					createdAt: Date.now()
				});
				if (ch) {
					await database.chapters.update(chapterId, { likesCount: newLikesCount });
				}
				await database.syncQueue.add({
					action: 'LIKE_CHAPTER',
					payload: { id: key, chapterId, versionId },
					timestamp: Date.now(),
					ownerUserId
				} as SyncItem);
			} else {
				await database.chapterLikes.delete(key);
				if (ch) {
					await database.chapters.update(chapterId, { likesCount: newLikesCount });
				}
				await database.syncQueue.add({
					action: 'UNLIKE_CHAPTER',
					payload: { id: key, chapterId, versionId },
					timestamp: Date.now(),
					ownerUserId
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
				const ownerUserId = await resolveOwner();
				const items = (
					await database.syncQueue
						.where('action')
						.anyOf([...likeActions])
						.toArray()
				).filter((item) => isMutationOwnedBy(item, ownerUserId));

				if (items.length === 0) return { synced: 0 };

				type ParsedLikeUpdate =
					| {
							kind: 'volume';
							queueId?: number;
							update: {
								id: string;
								volumeId: string;
								action: 'like' | 'unlike';
								timestamp: number;
							};
					  }
					| {
							kind: 'chapter';
							queueId?: number;
							update: {
								id: string;
								chapterId: string;
								versionId: string;
								action: 'like' | 'unlike';
								timestamp: number;
							};
					  };

				const parsedUpdates: ParsedLikeUpdate[] = [];
				const invalidIds: number[] = [];

				for (const item of items) {
					const payload = (item.payload || (item as unknown as { data?: unknown }).data || {}) as {
						id?: string;
						volumeId?: string;
						chapterId?: string;
						versionId?: string;
					};
					const targetId = payload.volumeId || payload.chapterId || payload.id;
					if (!targetId) {
						if (item.id !== undefined) invalidIds.push(item.id);
						continue;
					}

					if (item.action === 'LIKE_VOLUME' || item.action === 'UNLIKE_VOLUME') {
						parsedUpdates.push({
							kind: 'volume',
							queueId: item.id,
							update: {
								id: targetId,
								volumeId: targetId,
								action: item.action === 'LIKE_VOLUME' ? 'like' : 'unlike',
								timestamp: item.timestamp
							}
						});
					} else if (item.action === 'LIKE_CHAPTER' || item.action === 'UNLIKE_CHAPTER') {
						parsedUpdates.push({
							kind: 'chapter',
							queueId: item.id,
							update: {
								id: targetId,
								chapterId: payload.chapterId || targetId,
								versionId: payload.versionId ?? 'default',
								action: item.action === 'LIKE_CHAPTER' ? 'like' : 'unlike',
								timestamp: item.timestamp
							}
						});
					}
				}

				for (const id of invalidIds) {
					await database.syncQueue.delete(id);
				}

				if (parsedUpdates.length === 0) {
					return { synced: invalidIds.length };
				}

				let totalSynced = invalidIds.length;
				for (let i = 0; i < parsedUpdates.length; i += MAX_SYNC_BATCH) {
					const chunk = parsedUpdates.slice(i, i + MAX_SYNC_BATCH);
					const volumeLikeUpdates = chunk
						.filter(
							(entry): entry is Extract<ParsedLikeUpdate, { kind: 'volume' }> =>
								entry.kind === 'volume'
						)
						.map((entry) => entry.update);
					const chapterLikeUpdates = chunk
						.filter(
							(entry): entry is Extract<ParsedLikeUpdate, { kind: 'chapter' }> =>
								entry.kind === 'chapter'
						)
						.map((entry) => entry.update);
					const chunkIds = chunk
						.map((entry) => entry.queueId)
						.filter((id): id is number => id !== undefined);

					const res = await fetchFn('/api/user/sync', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							volumeLikeUpdates,
							chapterLikeUpdates
						})
					});

					if (res.ok) {
						for (const id of chunkIds) {
							await database.syncQueue.delete(id);
						}
						totalSynced += chunk.length;
					} else if (
						res.status >= 400 &&
						res.status < 500 &&
						res.status !== 401 &&
						res.status !== 429
					) {
						log.warn(`Dropping invalid likes batch after HTTP ${res.status}.`);
						for (const id of chunkIds) {
							await database.syncQueue.delete(id);
						}
						continue;
					} else {
						log.warn(`Sync likes queue failed with status ${res.status}`);
						return { synced: totalSynced, status: res.status };
					}
				}

				if (totalSynced > 0) {
					log.info(`Synced ${totalSynced} like mutations to server.`);
				}
				return { synced: totalSynced };
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
		async isChapterLiked(chapterId: string, versionId = 'default'): Promise<boolean> {
			const record = await database.chapterLikes.get(audioVersionKey(chapterId, versionId));
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
		async getChapterLikesCount(chapterId: string, versionId = 'default'): Promise<number> {
			if (versionId !== 'default') return 0;
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
