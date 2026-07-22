import { browser } from '$app/environment';
import { db } from '$lib/client/db';
import { hydrate } from '$lib/client/db/hydrate';
import {
	mapServerBookToOfflineBook,
	mapServerVolumeToOfflineVolume,
	mapServerChapterToOfflineChapter,
	mapServerIllustrationToOfflineIllustration
} from './mappers';

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
	 * Стягивает список книг с бэкенда и сохраняет в локальный Dexie.
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
			console.log('Синхронизация каталога не удалась (Оффлайн). Используем данные из Dexie.', e);
			if (browser) {
				return await db.books.toArray();
			}
			return [];
		}
	},

	/**
	 * Стягивает конкретную книгу со всеми её томами и главами.
	 * Поддерживает ETag: если сервер вернет 304 Not Modified, функция просто
	 * завершится, не делая лишней работы с локальной базой.
	 */
	async syncBookDetails(bookId: string, fetchFn: typeof fetch = fetch) {
		try {
			const res = await fetchFn(`/api/books/${bookId}`);

			// Если сервер вернул 304, значит данные в локальном кэше (Dexie) полностью актуальны!
			if (res.status === 304) {
				console.log(`Данные для книги ${bookId} актуальны (304 Not Modified).`);
				return;
			}

			if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

			const bookData: ServerBookWithRelations = await res.json();

			// 1. Подготовка плоских массивов для Dexie
			const offlineBook = mapServerBookToOfflineBook(bookData);
			const offlineVolumes = bookData.volumes.map(mapServerVolumeToOfflineVolume);
			const offlineChapters = bookData.volumes.flatMap((v) =>
				v.chapters.map(mapServerChapterToOfflineChapter)
			);
			const offlineIllustrations = bookData.volumes.flatMap((v) =>
				v.illustrations.map(mapServerIllustrationToOfflineIllustration)
			);

			// Для корректного удаления старых глав/иллюстраций нам нужны ID всех томов этой книги (включая удаленные на сервере)
			const existingVolumes = await db.volumes.where('bookId').equals(bookId).toArray();
			const allVolumeIds = Array.from(
				new Set([...existingVolumes.map((v) => v.id), ...offlineVolumes.map((v) => v.id)])
			);

			// 2. Параллельная гидратация всех связанных таблиц с очисткой удаленных
			await Promise.all([
				hydrate('books', offlineBook),
				hydrate('volumes', offlineVolumes, { index: 'bookId', values: [bookId] }),
				hydrate('chapters', offlineChapters, { index: 'volumeId', values: allVolumeIds }),
				hydrate('illustrations', offlineIllustrations, { index: 'volumeId', values: allVolumeIds })
			]);

			console.log(`Книга ${bookId} успешно синхронизирована.`);
		} catch (e) {
			console.log(`Оффлайн: данные для книги ${bookId} читаются из Dexie.`, e);
			// В случае ошибки ничего не делаем, UI-руна прочитает старые данные из Dexie
		}
	},

	/**
	 * Стягивает личные данные текущего пользователя (Лайки, Прогресс, Закладки)
	 * Этот метод легкий и выполняется независимо от стягивания большой книги.
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

			console.log('Пользовательские данные успешно синхронизированы с сервером.');
		} catch (e) {
			console.log('Синхронизация пользовательских данных не удалась (Оффлайн).', e);
		}
	}
};
