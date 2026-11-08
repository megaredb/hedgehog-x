import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createLikeService } from './likeService';
import type {
	OfflineVolume,
	OfflineChapter,
	OfflineVolumeLike,
	OfflineChapterLike,
	SyncItem
} from '$lib/client/db';

class MockTable<
	T extends { id?: number | string; volumeId?: string; chapterId?: string },
	Key extends string
> {
	private items = new Map<string, T>();
	private keyField: Key;
	private autoInc = 1;

	constructor(keyField: Key) {
		this.keyField = keyField;
	}

	private getKey(item: T): string {
		const k = (item as Record<string, unknown>)[this.keyField];
		return String(k);
	}

	async get(key: string | number): Promise<T | undefined> {
		return this.items.get(String(key));
	}

	async put(item: T): Promise<string | number> {
		const key = this.getKey(item);
		this.items.set(key, { ...item });
		return key;
	}

	async add(item: T): Promise<number> {
		const id = this.autoInc++;
		const withId = { ...item, id } as T;
		this.items.set(String(id), withId);
		return id;
	}

	async update(key: string | number, changes: Partial<T>): Promise<number> {
		const existing = this.items.get(String(key));
		if (!existing) return 0;
		this.items.set(String(key), { ...existing, ...changes });
		return 1;
	}

	async delete(key: string | number): Promise<void> {
		this.items.delete(String(key));
	}

	async toArray(): Promise<T[]> {
		return Array.from(this.items.values());
	}

	where(field: keyof T) {
		return {
			anyOf: (values: unknown[]) => ({
				toArray: async (): Promise<T[]> => {
					const valSet = new Set(values);
					return Array.from(this.items.values()).filter((item) => valSet.has(item[field]));
				}
			}),
			equals: (value: unknown) => ({
				toArray: async (): Promise<T[]> => {
					return Array.from(this.items.values()).filter((item) => item[field] === value);
				}
			})
		};
	}

	clear() {
		this.items.clear();
		this.autoInc = 1;
	}
}

function createMockDexie() {
	return {
		volumes: new MockTable<OfflineVolume, 'id'>('id'),
		chapters: new MockTable<OfflineChapter, 'id'>('id'),
		volumeLikes: new MockTable<OfflineVolumeLike, 'volumeId'>('volumeId'),
		chapterLikes: new MockTable<OfflineChapterLike, 'chapterId'>('chapterId'),
		syncQueue: new MockTable<SyncItem, 'id'>('id')
	};
}

describe('likeService (Offline-first likes & sync)', () => {
	let mockDb: ReturnType<typeof createMockDexie>;
	let service: ReturnType<typeof createLikeService>;

	beforeEach(() => {
		mockDb = createMockDexie();
		// @ts-expect-error Mocking Dexie instance for pure unit testing
		service = createLikeService(mockDb);
	});

	describe('Volume likes', () => {
		it('optimistically likes an unliked volume and enqueues LIKE_VOLUME', async () => {
			await mockDb.volumes.put({
				id: 'vol-1',
				bookId: 'book-1',
				volumeNumber: 1,
				title: 'Том 1',
				coverUrl: '',
				likesCount: 5
			});

			// Perform like toggle
			const result = await service.toggleVolumeLike('vol-1');
			assert.equal(result.liked, true);
			assert.equal(result.likesCount, 6);

			// Check local Dexie state
			const like = await mockDb.volumeLikes.get('vol-1');
			assert.ok(like, 'Volume like should be persisted in Dexie');
			assert.equal(like?.volumeId, 'vol-1');

			const updatedVol = await mockDb.volumes.get('vol-1');
			assert.equal(updatedVol?.likesCount, 6);

			// Check syncQueue entry
			const queue = await mockDb.syncQueue.toArray();
			assert.equal(queue.length, 1);
			assert.equal(queue[0].action, 'LIKE_VOLUME');
			assert.deepEqual(queue[0].payload, { id: 'vol-1', volumeId: 'vol-1' });
		});

		it('optimistically unlikes a liked volume and enqueues UNLIKE_VOLUME', async () => {
			await mockDb.volumes.put({
				id: 'vol-1',
				bookId: 'book-1',
				volumeNumber: 1,
				title: 'Том 1',
				coverUrl: '',
				likesCount: 3
			});
			await mockDb.volumeLikes.put({
				volumeId: 'vol-1',
				createdAt: Date.now() - 1000
			});

			const result = await service.toggleVolumeLike('vol-1');
			assert.equal(result.liked, false);
			assert.equal(result.likesCount, 2);

			const like = await mockDb.volumeLikes.get('vol-1');
			assert.equal(like, undefined, 'Volume like should be removed from Dexie');

			const updatedVol = await mockDb.volumes.get('vol-1');
			assert.equal(updatedVol?.likesCount, 2);

			const queue = await mockDb.syncQueue.toArray();
			assert.equal(queue.length, 1);
			assert.equal(queue[0].action, 'UNLIKE_VOLUME');
			assert.deepEqual(queue[0].payload, { id: 'vol-1', volumeId: 'vol-1' });
		});

		it('clamps likesCount to 0 when decrementing with 0 likes', async () => {
			await mockDb.volumes.put({
				id: 'vol-zero',
				bookId: 'book-1',
				volumeNumber: 1,
				title: 'Том 0',
				coverUrl: '',
				likesCount: 0
			});
			await mockDb.volumeLikes.put({
				volumeId: 'vol-zero',
				createdAt: Date.now()
			});

			const result = await service.toggleVolumeLike('vol-zero');
			assert.equal(result.liked, false);
			assert.equal(result.likesCount, 0);

			const updatedVol = await mockDb.volumes.get('vol-zero');
			assert.equal(updatedVol?.likesCount, 0);
		});
	});

	describe('Chapter likes', () => {
		it('optimistically likes an unliked chapter and enqueues LIKE_CHAPTER', async () => {
			await mockDb.chapters.put({
				id: 'ch-1',
				volumeId: 'vol-1',
				chapterNumber: 1,
				title: 'Глава 1',
				audioUrl: 'https://example.com/ch1.mp3',
				durationSeconds: 1200,
				likesCount: 10
			});

			const result = await service.toggleChapterLike('ch-1');
			assert.equal(result.liked, true);
			assert.equal(result.likesCount, 11);

			const like = await mockDb.chapterLikes.get('ch-1');
			assert.ok(like);
			assert.equal(like?.chapterId, 'ch-1');

			const updatedCh = await mockDb.chapters.get('ch-1');
			assert.equal(updatedCh?.likesCount, 11);

			const queue = await mockDb.syncQueue.toArray();
			assert.equal(queue.length, 1);
			assert.equal(queue[0].action, 'LIKE_CHAPTER');
			assert.deepEqual(queue[0].payload, { id: 'ch-1', chapterId: 'ch-1' });
		});

		it('optimistically unlikes a liked chapter and enqueues UNLIKE_CHAPTER', async () => {
			await mockDb.chapters.put({
				id: 'ch-1',
				volumeId: 'vol-1',
				chapterNumber: 1,
				title: 'Глава 1',
				audioUrl: 'https://example.com/ch1.mp3',
				durationSeconds: 1200,
				likesCount: 1
			});
			await mockDb.chapterLikes.put({
				chapterId: 'ch-1',
				createdAt: Date.now()
			});

			const result = await service.toggleChapterLike('ch-1');
			assert.equal(result.liked, false);
			assert.equal(result.likesCount, 0);

			const like = await mockDb.chapterLikes.get('ch-1');
			assert.equal(like, undefined);

			const updatedCh = await mockDb.chapters.get('ch-1');
			assert.equal(updatedCh?.likesCount, 0);

			const queue = await mockDb.syncQueue.toArray();
			assert.equal(queue.length, 1);
			assert.equal(queue[0].action, 'UNLIKE_CHAPTER');
		});
	});

	describe('syncLikesQueue', () => {
		it('returns { synced: 0 } when queue is empty', async () => {
			let fetchCalled = false;
			const customFetch: typeof fetch = async () => {
				fetchCalled = true;
				return new Response(JSON.stringify({ success: true }));
			};

			const res = await service.syncLikesQueue(customFetch);
			assert.equal(res.synced, 0);
			assert.equal(fetchCalled, false);
		});

		it('dispatches queued likes to /api/user/sync and removes them upon success', async () => {
			await mockDb.syncQueue.add({
				action: 'LIKE_VOLUME',
				payload: { id: 'vol-1', volumeId: 'vol-1' },
				timestamp: 1000
			});
			await mockDb.syncQueue.add({
				action: 'UNLIKE_CHAPTER',
				payload: { id: 'ch-2', chapterId: 'ch-2' },
				timestamp: 2000
			});

			let sentUrl = '';
			let sentBody: Record<string, unknown> = {};

			const customFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
				sentUrl = String(input);
				sentBody = JSON.parse(String(init?.body || '{}'));
				return new Response(
					JSON.stringify({
						success: true,
						volumeLikesCount: 1,
						chapterLikesCount: 1
					}),
					{ status: 200 }
				);
			};

			const res = await service.syncLikesQueue(customFetch);
			assert.equal(res.synced, 2);
			assert.equal(sentUrl, '/api/user/sync');
			assert.deepEqual(sentBody.volumeLikeUpdates, [
				{ id: 'vol-1', volumeId: 'vol-1', action: 'like', timestamp: 1000 }
			]);
			assert.deepEqual(sentBody.chapterLikeUpdates, [
				{ id: 'ch-2', chapterId: 'ch-2', action: 'unlike', timestamp: 2000 }
			]);

			// Queue should be cleared
			const remainingQueue = await mockDb.syncQueue.toArray();
			assert.equal(remainingQueue.length, 0);
		});

		it('retains queued items in syncQueue if server responds with error (401/500)', async () => {
			await mockDb.syncQueue.add({
				action: 'LIKE_VOLUME',
				payload: { id: 'vol-99', volumeId: 'vol-99' },
				timestamp: 3000
			});

			const failingFetch: typeof fetch = async () => {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401
				});
			};

			const res = await service.syncLikesQueue(failingFetch);
			assert.equal(res.synced, 0);
			assert.equal(res.status, 401);

			// Item must remain in queue for retry after login
			const remainingQueue = await mockDb.syncQueue.toArray();
			assert.equal(remainingQueue.length, 1);
			assert.equal(remainingQueue[0].action, 'LIKE_VOLUME');
		});
	});

	describe('Read helpers', () => {
		it('checks liked status and counts correctly', async () => {
			await mockDb.volumeLikes.put({ volumeId: 'v-10', createdAt: 1 });
			await mockDb.volumes.put({
				id: 'v-10',
				bookId: 'b-1',
				volumeNumber: 1,
				title: 'Vol',
				coverUrl: '',
				likesCount: 42
			});

			assert.equal(await service.isVolumeLiked('v-10'), true);
			assert.equal(await service.isVolumeLiked('v-nonexistent'), false);
			assert.equal(await service.getVolumeLikesCount('v-10'), 42);
			assert.equal(await service.getVolumeLikesCount('v-nonexistent'), 0);
		});
	});
});
