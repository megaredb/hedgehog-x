import { browser } from '$app/environment';
import { db } from '$lib/client/db';
import { hydrate } from '$lib/client/db/hydrate';
import {
	clearLocalUserData,
	clearPendingUserActivity,
	clearSessionLocalState,
	countLocalUserData,
	countPendingUserMutations,
	getSyncOwner,
	setSyncOwner
} from '$lib/client/db/syncState';
import { createLogger } from '$lib/logger';
import { flushBookmarkQueue } from './bookmarkSync';
import { guestAdoption } from './guestAdoption.svelte';
import { decideSyncAction, type SyncAction } from './syncPolicy';
import {
	mapServerBookToOfflineBook,
	mapServerVolumeToOfflineVolume,
	mapServerChapterToOfflineChapter,
	mapServerIllustrationToOfflineIllustration
} from './mappers';

const log = createLogger('Sync');

type ServerVolume = typeof import('$lib/server/db/schema').volumes.$inferSelect;
type ServerChapter = typeof import('$lib/server/db/schema').chapters.$inferSelect;
type ServerIllustration = typeof import('$lib/server/db/schema').illustrations.$inferSelect;

type ServerBookWithRelations = typeof import('$lib/server/db/schema').books.$inferSelect & {
	volumes: (ServerVolume & {
		chapters: ServerChapter[];
		illustrations: ServerIllustration[];
	})[];
};

export type UserSyncResult =
	| { status: 'skipped' | 'unauthenticated' | 'offline' | 'error' }
	| { status: 'synced'; action: Exclude<SyncAction, 'skip'>; userId: string };

type UserSyncPayload = {
	authenticated?: boolean;
	userId?: string;
	userName?: string;
	isNewUser?: boolean;
	chapterLikes?: Array<{ chapterId: string; createdAt?: number }>;
	volumeLikes?: Array<{ volumeId: string; createdAt?: number }>;
	listeningProgress?: Array<{
		chapterId: string;
		progressSeconds: number;
		isCompleted?: boolean;
		updatedAt?: number;
	}>;
	bookmarks?: Array<{
		id: string;
		chapterId: string;
		timestampSeconds: number;
		note?: string;
		createdAt?: number;
	}>;
};

/**
 * Uploads guest/local data before the first authenticated sync. This prevents
 * a later authoritative replace from deleting data that only exists in Dexie.
 * The endpoint is idempotent (GREATEST/upsert/onConflictDoNothing).
 */
async function pushLocalUserData(fetchFn: typeof fetch): Promise<void> {
	const [progress, bookmarks, volumeLikes, chapterLikes] = await Promise.all([
		db.progress.toArray(),
		db.bookmarks.toArray(),
		db.volumeLikes.toArray(),
		db.chapterLikes.toArray()
	]);

	if (
		progress.length === 0 &&
		bookmarks.length === 0 &&
		volumeLikes.length === 0 &&
		chapterLikes.length === 0
	) {
		return;
	}

	const res = await fetchFn('/api/user/sync', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			progressUpdates: progress.map((p) => ({
				chapterId: p.chapterId,
				progressSeconds: p.progressSeconds,
				isCompleted: p.isCompleted
			})),
			bookmarkUpdates: bookmarks.map((b) => ({
				id: b.id,
				chapterId: b.chapterId,
				timestampSeconds: b.timestampSeconds,
				note: b.note,
				action: 'upsert'
			})),
			volumeLikeUpdates: volumeLikes.map((l) => ({
				id: l.volumeId,
				volumeId: l.volumeId,
				action: 'like'
			})),
			chapterLikeUpdates: chapterLikes.map((l) => ({
				id: l.chapterId,
				chapterId: l.chapterId,
				action: 'like'
			}))
		})
	});

	if (!res.ok) {
		throw new Error(`Failed to adopt local user data: HTTP ${res.status}`);
	}
}

async function performUserDataSync(fetchFn: typeof fetch): Promise<UserSyncResult> {
	try {
		const res = await fetchFn('/api/user/sync', {
			headers: { Accept: 'application/json' }
		});

		if (res.status === 401) {
			// If we still have an owner, the session expired/was revoked: local
			// personal data must not remain visible to the next guest.
			const owner = await getSyncOwner();
			if (owner?.userId) await clearSessionLocalState();
			return { status: 'unauthenticated' };
		}
		if (!res.ok) {
			log.warn(`User data sync failed with status ${res.status}`);
			return { status: 'error' };
		}

		const payload = (await res.json()) as UserSyncPayload;
		const userId = typeof payload.userId === 'string' ? payload.userId : '';
		if (!userId) {
			// Compatibility with an older server: never hydrate/purge without
			// explicit ownership information.
			log.warn('User data sync response has no userId; keeping local cache.');
			return { status: 'error' };
		}

		const [owner, localCounts, pendingMutations] = await Promise.all([
			getSyncOwner(),
			countLocalUserData(),
			countPendingUserMutations()
		]);
		const hasLocal = Object.values(localCounts).some((count) => count > 0);

		let decision = decideSyncAction({
			serverUserId: userId,
			localOwner: owner?.userId,
			hasLocalData: hasLocal,
			hasPendingMutations: pendingMutations > 0
		});

		if (decision === 'skip') return { status: 'error' };

		if (decision === 'switch') {
			// Never send the previous account's data or queue under the new user.
			await clearLocalUserData();
			await clearPendingUserActivity();
			decision = 'replace';
		}

		if (decision === 'merge' && (owner?.userId ?? null) === null && hasLocal) {
			// Guest -> authenticated. New accounts may adopt automatically; for an
			// existing account the user must explicitly choose what happens to the
			// local data. Never silently mix guest history into an account.
			const shouldImport =
				payload.isNewUser === true ||
				(await guestAdoption.ask({
					userId,
					accountName: payload.userName,
					counts: localCounts
				})) === 'import';

			if (shouldImport) {
				// Upload the snapshot first; if it fails, keep everything and retry later.
				await pushLocalUserData(fetchFn);
				// The snapshot already contains the state; queued guest mutations are
				// now redundant and must not be replayed under this account.
				await clearPendingUserActivity();
			} else {
				await clearLocalUserData();
				await clearPendingUserActivity();
				decision = 'replace';
			}
		}

		const purgeScope = decision === 'replace' ? ('all' as const) : undefined;
		const options = { allowEmptyPurge: decision === 'replace' };

		await Promise.all([
			hydrate(
				'chapterLikes',
				(payload.chapterLikes ?? []).map((like) => ({
					chapterId: like.chapterId,
					createdAt: like.createdAt ?? 0
				})),
				purgeScope,
				options
			),
			hydrate(
				'volumeLikes',
				(payload.volumeLikes ?? []).map((like) => ({
					volumeId: like.volumeId,
					createdAt: like.createdAt ?? 0
				})),
				purgeScope,
				options
			),
			hydrate(
				'progress',
				(payload.listeningProgress ?? []).map((progress) => ({
					chapterId: progress.chapterId,
					progressSeconds: progress.progressSeconds,
					isCompleted: !!progress.isCompleted,
					updatedAt: progress.updatedAt ?? 0
				})),
				purgeScope,
				options
			),
			hydrate(
				'bookmarks',
				(payload.bookmarks ?? []).map((bookmark) => ({
					id: bookmark.id,
					chapterId: bookmark.chapterId,
					timestampSeconds: bookmark.timestampSeconds,
					note: bookmark.note ?? '',
					createdAt: bookmark.createdAt ?? 0
				})),
				purgeScope,
				options
			)
		]);

		await setSyncOwner(userId);
		// The queue may contain bookmark mutations created before login/offline.
		void flushBookmarkQueue(fetchFn);
		log.info(`User data synchronized (${decision}).`);
		return { status: 'synced', action: decision, userId };
	} catch (e) {
		log.info('User data sync skipped (offline/retry later).', e);
		return { status: 'offline' };
	}
}

let activeUserSync: Promise<UserSyncResult> | null = null;

export const syncService = {
	/**
	 * Fetches book details with relations (volumes, chapters, illustrations).
	 * Supports ETag: skips hydration if 304 Not Modified.
	 */
	async syncBookDetails(bookId: string, fetchFn: typeof fetch = fetch) {
		try {
			const etagKey = 'book-etag:' + bookId;
			const etag = typeof localStorage !== 'undefined' ? localStorage.getItem(etagKey) : null;
			const res = await fetchFn(`/api/books/${bookId}`, {
				headers: etag ? { 'If-None-Match': etag } : undefined
			});

			if (res.status === 304) {
				log.debug(`Book data for ${bookId} is up to date (304 Not Modified).`);
				return;
			}

			if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

			const nextEtag = res.headers.get('etag');
			if (nextEtag && typeof localStorage !== 'undefined') localStorage.setItem(etagKey, nextEtag);
			const bookData: ServerBookWithRelations = await res.json();

			const offlineBook = mapServerBookToOfflineBook(bookData);
			const offlineVolumes = bookData.volumes.map(mapServerVolumeToOfflineVolume);
			const offlineChapters = bookData.volumes.flatMap((v) =>
				v.chapters.map(mapServerChapterToOfflineChapter)
			);
			const offlineIllustrations = bookData.volumes.flatMap((v) =>
				v.illustrations.map(mapServerIllustrationToOfflineIllustration)
			);

			const existingVolumes = await db.volumes.where('bookId').equals(bookId).toArray();
			const allVolumeIds = Array.from(
				new Set([...existingVolumes.map((v) => v.id), ...offlineVolumes.map((v) => v.id)])
			);

			await Promise.all([
				hydrate('books', offlineBook),
				hydrate('volumes', offlineVolumes, { index: 'bookId', values: [bookId] }),
				hydrate('chapters', offlineChapters, { index: 'volumeId', values: allVolumeIds }),
				hydrate('illustrations', offlineIllustrations, { index: 'volumeId', values: allVolumeIds })
			]);

			log.info(`Book ${bookId} synchronized successfully.`);
		} catch (e) {
			log.info(`Offline: Reading book data for ${bookId} from Dexie.`, e);
		}
	},

	/**
	 * Synchronizes user data (likes, progress, bookmarks).
	 * Serialized: rapid navigations must not race ownership/purge decisions.
	 */
	async syncUserData(fetchFn: typeof fetch = fetch): Promise<UserSyncResult> {
		if (!browser) return { status: 'skipped' };
		if (activeUserSync) return activeUserSync;

		activeUserSync = performUserDataSync(fetchFn).finally(() => {
			activeUserSync = null;
		});

		return activeUserSync;
	}
};
