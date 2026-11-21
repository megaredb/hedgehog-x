import { db } from '$lib/client/db';
import type { SyncItem } from '$lib/client/db';
import { getCurrentOwnerId, isMutationOwnedBy } from '$lib/client/db/syncState';
import { createLogger } from '$lib/logger';

const log = createLogger('Bookmarks');

const BOOKMARK_ACTIONS = ['ADD_BOOKMARK', 'REMOVE_BOOKMARK'] as const;
const MAX_SYNC_BATCH = 100;

type BookmarkUpdate =
	| {
			id: string;
			chapterId: string;
			versionId: string;
			timestampSeconds: number;
			note: string;
			action: 'upsert';
	  }
	| { id: string; action: 'delete' };

let activeFlush: Promise<number> | null = null;

function canSync(): boolean {
	return typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine;
}

function toUpdate(item: SyncItem): BookmarkUpdate | null {
	const payload = item.payload as
		| {
				id?: string;
				chapterId?: string;
				versionId?: string;
				timestampSeconds?: number;
				note?: string;
		  }
		| undefined;
	if (!payload?.id) return null;

	if (item.action === 'ADD_BOOKMARK') {
		if (!payload.chapterId || typeof payload.timestampSeconds !== 'number') return null;
		return {
			id: payload.id,
			chapterId: payload.chapterId,
			versionId: payload.versionId ?? 'default',
			timestampSeconds: payload.timestampSeconds,
			note: payload.note ?? '',
			action: 'upsert'
		};
	}

	return { id: payload.id, action: 'delete' };
}

async function flush(fetchFn: typeof fetch): Promise<number> {
	const ownerUserId = await getCurrentOwnerId();
	const items = (
		await db.syncQueue
			.where('action')
			.anyOf([...BOOKMARK_ACTIONS] as string[])
			.toArray()
	)
		.filter((item) => isMutationOwnedBy(item, ownerUserId))
		.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0) || (a.id ?? 0) - (b.id ?? 0));

	if (items.length === 0) return 0;

	const updates: BookmarkUpdate[] = [];
	const processedIds: number[] = [];
	const invalidIds: number[] = [];

	for (const item of items) {
		const update = toUpdate(item);
		if (update) {
			updates.push(update);
			if (item.id !== undefined) processedIds.push(item.id);
		} else {
			log.warn('Dropping malformed bookmark sync item.', item.id);
			if (item.id !== undefined) invalidIds.push(item.id);
		}
	}

	if (updates.length === 0) {
		if (invalidIds.length > 0) await db.syncQueue.bulkDelete(invalidIds);
		return 0;
	}

	let synced = 0;
	for (let i = 0; i < updates.length; i += MAX_SYNC_BATCH) {
		const chunk = updates.slice(i, i + MAX_SYNC_BATCH);
		const chunkIds = processedIds.slice(i, i + MAX_SYNC_BATCH);

		let res: Response;
		try {
			res = await fetchFn('/api/user/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bookmarkUpdates: chunk })
			});
		} catch (e) {
			log.info('Bookmark sync postponed (offline).', e);
			break;
		}

		if (!res.ok) {
			if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429) {
				log.warn('Dropping invalid bookmark batch after HTTP ' + res.status + '.');
				await db.syncQueue.bulkDelete(chunkIds);
				continue;
			}
			// 401 for guests, 429, or 5xx: keep remaining chunks for retry.
			log.info('Bookmark sync postponed (HTTP ' + res.status + ').');
			break;
		}

		await db.syncQueue.bulkDelete(chunkIds);
		synced += chunk.length;
	}

	if (invalidIds.length > 0) await db.syncQueue.bulkDelete(invalidIds);
	if (synced > 0) log.info('Synchronized ' + synced + ' bookmark change(s).');
	return synced;
}

/**
 * Flushes queued bookmark creates/deletes. Safe to call repeatedly:
 * concurrent calls share one in-flight request.
 */
export function flushBookmarkQueue(fetchFn: typeof fetch = fetch): Promise<number> {
	if (!canSync()) return Promise.resolve(0);
	if (activeFlush) return activeFlush;

	activeFlush = flush(fetchFn).finally(() => {
		activeFlush = null;
	});

	return activeFlush;
}

// Online event and initial app load are the two natural retry points.
// The module is imported by GlobalPlayer/syncService, so this runs once per page.
if (typeof window !== 'undefined') {
	window.addEventListener('online', () => {
		void flushBookmarkQueue();
	});

	setTimeout(() => {
		void flushBookmarkQueue();
	}, 0);
}
