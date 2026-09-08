/**
 * Детерминированный хелпер для тестов витрины: засев книги в Dexie.
 *
 * CTA-ветка «Слушать» в ShowcaseItem рендерится только если в Dexie есть
 * реальная книга с id из витрины (`db.books.get(book.id)`). Витринные id
 * (`mushoku_tensei`/`overlord`) в мок-каталоге по умолчанию отсутствуют, поэтому
 * чтобы проверить ветку «Слушать», засеваем запись в Dexie напрямую (аналог
 * seedDownloadedState из downloads.helpers): открываем БД без версии, ждём
 * появления store'а `books`, кладём запись и делаем полный reload — иначе
 * liveQuery не увидит изменение из постороннего соединения.
 */

import type { Page } from '@playwright/test';
import { HEDGEHOG_DB_NAME } from '../../src/lib/constants';

/**
 * Засевает в Dexie книгу с заданным id витрины (минимальная запись — важно лишь
 * существование ключа для `db.books.get(id)`). После записи нужен полный reload
 * страницы, чтобы ShowcaseItem прочитал книгу из Dexie при старте.
 */
export async function seedShowcaseBook(page: Page, bookId: string): Promise<void> {
	await page.evaluate(
		async (opts: { dbName: string; bookId: string }) => {
			const { dbName, bookId } = opts;
			const openDb = () =>
				new Promise<IDBDatabase>((resolve, reject) => {
					const req = indexedDB.open(dbName);
					req.onsuccess = () => resolve(req.result);
					req.onerror = () => reject(req.error);
				});

			let db = await openDb();
			// Ждём, пока приложение (Dexie) создаст store 'books'.
			for (let attempt = 0; attempt < 50 && !db.objectStoreNames.contains('books'); attempt++) {
				db.close();
				await new Promise((r) => setTimeout(r, 50));
				db = await openDb();
			}
			if (!db.objectStoreNames.contains('books')) {
				throw new Error('Dexie store books не создан приложением');
			}

			const tx = db.transaction(['books'], 'readwrite');
			tx.objectStore('books').put({
				id: bookId,
				title: bookId,
				coverUrl: '',
				status: 'ongoing'
			});
			await new Promise<void>((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
				tx.onabort = () => reject(tx.error);
			});
			db.close();
		},
		{ dbName: HEDGEHOG_DB_NAME, bookId }
	);
}
