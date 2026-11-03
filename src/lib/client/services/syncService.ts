import { browser } from '$app/environment';
import { db } from '$lib/client/db';
import { hydrate } from '$lib/client/db/hydrate';
import { createLogger } from '$lib/logger';
import {
	mapServerBookToOfflineBook,
	mapServerVolumeToOfflineVolume,
	mapServerChapterToOfflineChapter,
	mapServerIllustrationToOfflineIllustration
} from './mappers';

const log = createLogger('Sync');

type ServerBook = typeof import('$lib/server/db/schema').books.$inferSelect;
type ServerVolume = typeof import('$lib/server/db/schema').volumes.$inferSelect;
type ServerChapter = typeof import('$lib/server/db/schema').chapters.$inferSelect;
type ServerIllustration = typeof import('$lib/server/db/schema').illustrations.$inferSelect;

type ServerBookWithRelations = ServerBook & {
	volumes: (ServerVolume & {
		chapters: ServerChapter[];
		illustrations: ServerIllustration[];
	})[];
};

export const syncService = {
	/**
	 * Fetches the book catalog from the server and hydrates local Dexie storage.
	 */
	async syncBooks(fetchFn: typeof fetch = fetch) {
		try {
			const res = await fetchFn('/api/books');
			if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

			const serverBooks: ServerBook[] = await res.json();
			const offlineBooks = serverBooks.map(mapServerBookToOfflineBook);

			if (browser) {
				await hydrate('books', offlineBooks, 'all');
			}
			return offlineBooks;
		} catch (e) {
			log.info('Catalog sync skipped (Offline). Using cached Dexie data.', e);
			if (browser) {
				return await db.books.toArray();
			}
			return [];
		}
	},

	/**
	 * Fetches book details with relations (volumes, chapters, illustrations).
	 * Supports ETag: skips hydration if 304 Not Modified.
	 */
	async syncBookDetails(bookId: string, fetchFn: typeof fetch = fetch) {
		try {
			const res = await fetchFn(`/api/books/${bookId}`);

			if (res.status === 304) {
				log.debug(`Book data for ${bookId} is up to date (304 Not Modified).`);
				return;
			}

			if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

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
	 */
	async syncUserData(fetchFn: typeof fetch = fetch) {
		try {
			const res = await fetchFn('/api/user/sync');
			if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

			const userData = await res.json();

			await Promise.all([
				hydrate('chapterLikes', userData.chapterLikes || [], 'all'),
				hydrate('volumeLikes', userData.volumeLikes || [], 'all'),
				hydrate('progress', userData.listeningProgress || [], 'all'),
				hydrate('bookmarks', userData.bookmarks || [], 'all')
			]);

			log.info('User data synchronized successfully with server.');
		} catch (e) {
			log.info('User data sync skipped (Offline).', e);
		}
	}
};
