import { db, type OfflineMeta, type SyncItem } from './index';
import { loadCachedSession } from '$lib/client/auth-storage';

const SYNC_OWNER_KEY = 'syncOwner';

/** Local actions which mutate user data and can be lost by an authoritative purge. */
export const USER_MUTATION_ACTIONS = [
	'UPDATE_PROGRESS',
	'LIKE_VOLUME',
	'UNLIKE_VOLUME',
	'LIKE_CHAPTER',
	'UNLIKE_CHAPTER',
	'ADD_BOOKMARK',
	'REMOVE_BOOKMARK'
] as const;

/** Data mutations plus analytics events that must not leak to another account. */
export const USER_ACTIVITY_ACTIONS = [...USER_MUTATION_ACTIONS, 'LISTEN_SESSION'] as const;

export interface SyncOwner {
	userId: string | null;
	updatedAt: number;
}

export interface LocalUserDataCounts {
	progress: number;
	bookmarks: number;
	volumeLikes: number;
	chapterLikes: number;
}

/** null = guest; undefined legacy/missing is deliberately treated as guest. */
export function mutationOwner(item: SyncItem): string | null {
	return item.ownerUserId ?? null;
}

export function isMutationOwnedBy(item: SyncItem, ownerUserId: string | null): boolean {
	return mutationOwner(item) === ownerUserId;
}

export async function getCurrentOwnerId(): Promise<string | null> {
	const owner = await getSyncOwner();
	return owner?.userId ?? null;
}

/**
 * Returns the user who currently owns local user-scoped data.
 * Missing owner means "not known yet" (treated as guest by syncPolicy).
 *
 * On the first run after the v2 upgrade, infer the owner from the offline auth
 * cache. Without this, old local data could be adopted by the next logged-in user.
 */
export async function getSyncOwner(): Promise<SyncOwner | undefined> {
	const record = await db.meta.get(SYNC_OWNER_KEY);
	if (record) {
		return { userId: record.userId ?? null, updatedAt: record.updatedAt };
	}

	const cached = loadCachedSession();
	if (cached?.user?.id) {
		const owner = { userId: cached.user.id, updatedAt: Date.now() };
		await db.meta.put({
			key: SYNC_OWNER_KEY,
			userId: owner.userId,
			updatedAt: owner.updatedAt
		});
		return owner;
	}

	return undefined;
}

export async function setSyncOwner(userId: string | null): Promise<void> {
	const record: OfflineMeta = {
		key: SYNC_OWNER_KEY,
		userId,
		updatedAt: Date.now()
	};
	await db.meta.put(record);
}

export async function clearSyncOwner(): Promise<void> {
	await db.meta.delete(SYNC_OWNER_KEY);
}

export async function countLocalUserData(): Promise<LocalUserDataCounts> {
	const [progress, bookmarks, volumeLikes, chapterLikes] = await Promise.all([
		db.progress.count(),
		db.bookmarks.count(),
		db.volumeLikes.count(),
		db.chapterLikes.count()
	]);
	return { progress, bookmarks, volumeLikes, chapterLikes };
}

export async function hasLocalUserData(): Promise<boolean> {
	const counts = await countLocalUserData();
	return Object.values(counts).some((count) => count > 0);
}

/** Clears progress, likes and bookmarks, but keeps content/downloads. */
export async function clearLocalUserData(): Promise<void> {
	await db.transaction(
		'rw',
		db.progress,
		db.volumeLikes,
		db.chapterLikes,
		db.bookmarks,
		async () => {
			await Promise.all([
				db.progress.clear(),
				db.volumeLikes.clear(),
				db.chapterLikes.clear(),
				db.bookmarks.clear()
			]);
		}
	);
}

/** Counts queued mutations whose loss would be a regression if we purge now. */
export async function countPendingUserMutations(): Promise<number> {
	return db.syncQueue
		.where('action')
		.anyOf([...USER_MUTATION_ACTIONS] as string[])
		.count();
}

/** Drops user data events that must not be sent under a different account. */
export async function clearPendingUserActivity(): Promise<void> {
	await db.syncQueue
		.where('action')
		.anyOf([...USER_ACTIVITY_ACTIONS] as string[])
		.delete();
}

/** Full logout cleanup: personal data, queued mutations and ownership. */
export async function clearSessionLocalState(): Promise<void> {
	await Promise.all([clearLocalUserData(), clearPendingUserActivity(), clearSyncOwner()]);
}
