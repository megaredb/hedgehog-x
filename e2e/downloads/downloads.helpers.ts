/**
 * Детерминированные хелперы загрузок (перенесены из удалённого плоского
 * e2e/downloads.e2e.ts как есть). Обеспечивают полностью предсказуемый сетевой
 * контур и засев downloaded-состояния в IndexedDB.
 *
 *  - Абсолютные audioUrl: performDownload (downloadManager.svelte.ts) строит URL
 *    через new URL(chapter.audioUrl), поэтому каталог в этих тестах отдаётся с
 *    абсолютными audioUrl (route поверх фикстуры `catalog` побеждает — регистрируется позже).
 *  - «Висящие» аудио-запросы: глава детерминированно остаётся downloading,
 *    остальные — queued; отмена abort-ит запрос на клиенте.
 *  - Засев downloaded-состояния прямо в IndexedDB (схема src/lib/client/db/index.ts).
 */

import type { Page } from '@playwright/test';
import { MOCK_CATALOG, type MockBookDetail } from '../fixtures/data';
import { BASE_URL } from '../config';

/** Глубокий клон каталога с абсолютными audioUrl (нужен new URL в performDownload). */
export function catalogWithAbsoluteAudio(book: MockBookDetail): MockBookDetail {
	return {
		...book,
		volumes: book.volumes.map((volume) => ({
			...volume,
			chapters: volume.chapters.map((ch) => ({
				...ch,
				audioUrl: new URL(ch.audioUrl, BASE_URL).href
			})),
			illustrations: volume.illustrations
		}))
	};
}

/** Аудио-запрос «висит» навсегда: глава остаётся downloading, пока её не отменят. */
export function hangAudioRequests(page: Page): Promise<void> {
	return page.route('**/audio/**', () => new Promise<void>(() => {}));
}

/** Отдаём каталог с абсолютными audioUrl (поверх фикстуры `catalog`). */
export function serveCatalogWithAbsoluteAudio(page: Page): Promise<void> {
	return page.route('**/api/books/book-1', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(catalogWithAbsoluteAudio(MOCK_CATALOG))
		})
	);
}

/**
 * Засевает downloaded-состояние прямо в IndexedDB (схема — db/index.ts):
 * один том book-1-vol-1 с двумя полностью скачанными главами.
 *
 * БД к этому моменту уже открыта приложением: Dexie создаёт HedgehogDB на
 * нативном IDB-версии 10 (версия декларации × 10) с внутренним store 'version',
 * поэтому открываем БЕЗ указания версии и ждём появления store'ов Dexie.
 * После записи нужен полный reload, чтобы Dexie прочитал данные при старте
 * (liveQuery не видит изменения из постороннего соединения).
 */
export async function seedDownloadedState(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const DB_NAME = 'HedgehogDB';
		const openDb = () =>
			new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open(DB_NAME);
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});

		let db = await openDb();
		// Ждём, пока приложение (Dexie) создаст таблицы
		for (let attempt = 0; attempt < 50 && !db.objectStoreNames.contains('downloads'); attempt++) {
			db.close();
			await new Promise((resolve) => setTimeout(resolve, 50));
			db = await openDb();
		}
		if (!db.objectStoreNames.contains('downloads')) {
			throw new Error('Dexie stores не созданы приложением');
		}

		const tx = db.transaction(['volumes', 'chapters', 'downloads'], 'readwrite');
		const put = (store: string, value: unknown) => tx.objectStore(store).put(value);
		put('volumes', {
			id: 'book-1-vol-1',
			bookId: 'book-1',
			volumeNumber: 1,
			title: 'Еж и первые снежинки',
			description: '',
			coverUrl: '',
			likesCount: 0
		});
		put('chapters', {
			id: 'book-1-ch-1',
			volumeId: 'book-1-vol-1',
			chapterNumber: 1,
			title: 'Встреча у ручья',
			audioUrl: '/audio/book-1/vol-1/ch-1.mp3',
			durationSeconds: 354,
			likesCount: 0
		});
		put('chapters', {
			id: 'book-1-ch-2',
			volumeId: 'book-1-vol-1',
			chapterNumber: 2,
			title: 'Листопад',
			audioUrl: '/audio/book-1/vol-1/ch-2.mp3',
			durationSeconds: 421,
			likesCount: 0
		});
		put('downloads', {
			chapterId: 'book-1-ch-1',
			status: 'downloaded',
			progress: 100,
			totalBytes: 1048576,
			createdAt: 1000
		});
		put('downloads', {
			chapterId: 'book-1-ch-2',
			status: 'downloaded',
			progress: 100,
			totalBytes: 1048576,
			createdAt: 1001
		});
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		});
		db.close();
	});
}
