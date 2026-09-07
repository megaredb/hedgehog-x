import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/test';
import { MOCK_CATALOG, type MockBookDetail } from './fixtures/data';
import { BASE_URL } from './config';

/**
 * E2E: менеджер загрузок (/downloads).
 *
 * Покрытие:
 *  1. Гость: пустые состояния «Очередь пуста» и «Нет загрузок».
 *  2. Очередь через UI: «Скачать все»/кнопка у главы на странице тома →
 *     активная секция с «Отменить том»/«Отменить главу»/«Очистить очередь»;
 *     клики удаляют главы/том из очереди (возврат к пустому состоянию).
 *  3. «Сохранённые тома»: downloaded-состояние засевается напрямую в
 *     IndexedDB (по схеме src/lib/client/db/index.ts) — метка
 *     «Доступно оффлайн», «Удалить главу» и «Удалить том».
 *
 * Детерминизм скачивания:
 *  - performDownload (downloadManager.svelte.ts) строит URL через
 *    new URL(chapter.audioUrl) и делает fetch(chapter.audioUrl + '?_cors=1').
 *    URL обязан быть абсолютным: в фикстурах audioUrl относительный
 *    ('/audio/...'), поэтому тест перехватывает GET /api/books/book-1 и
 *    отдаёт каталог с абсолютными audioUrl (route поверх фикстуры `catalog`
 *    побеждает — регистрируется позже).
 *  - Аудио-запросы вешаются навечно (page.route по глоб-паттерну аудио без
 *    continue/fulfill) — глава детерминированно остаётся в статусе downloading,
 *    а остальные — queued. Отмена работает: abort на клиенте, запись удаляется
 *    из Dexie.
 *  - Service Worker в этих тестах заблокирован: download-запросы SW не
 *    перехватывает (destination '' + url с '?_cors=1'), но блокировка делает
 *    сетевую картину полностью предсказуемой.
 *
 * Селекторы — роли/aria-label/точные тексты; CSS-классы не используются.
 */

test.use({ serviceWorkers: 'block' });

const BOOK = MOCK_CATALOG;
const VOLUME_1 = MOCK_CATALOG.volumes.find((v) => v.id === 'book-1-vol-1')!;
const CH_1 = VOLUME_1.chapters.find((c) => c.id === 'book-1-ch-1')!; // «Встреча у ручья»
const CH_2 = VOLUME_1.chapters.find((c) => c.id === 'book-1-ch-2')!; // «Листопад»

/** Глубокий клон каталога с абсолютными audioUrl (нужен new URL в performDownload). */
function catalogWithAbsoluteAudio(book: MockBookDetail): MockBookDetail {
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
function hangAudioRequests(page: Page): Promise<void> {
	return page.route('**/audio/**', () => new Promise<void>(() => {}));
}

/** Отдаём каталог с абсолютными audioUrl (поверх фикстуры `catalog`). */
function serveCatalogWithAbsoluteAudio(page: Page): Promise<void> {
	return page.route('**/api/books/book-1', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(catalogWithAbsoluteAudio(MOCK_CATALOG))
		})
	);
}

/** Переход в раздел «Загрузки» через десктопный сайдбар (SPA-навигация). */
async function openDownloads(page: Page): Promise<void> {
	await page.locator('aside').getByRole('link', { name: 'Загрузки', exact: true }).click();
	await expect(page).toHaveURL(/\/downloads$/);
}

/** Раскрываем аккордеон тома, кликая по подписи-счётчику внутри триггера. */
async function expandVolumeGroup(page: Page, subtitle: string): Promise<void> {
	await page.getByText(subtitle, { exact: true }).click();
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
async function seedDownloadedState(page: Page): Promise<void> {
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

test.describe('/downloads: гость, пустые состояния', () => {
	test('«Очередь пуста» и «Нет загрузок», управляющих кнопок нет', async ({ guest, page }) => {
		void guest;
		await page.goto('/downloads');

		await expect(page.getByRole('heading', { name: 'Загрузки', level: 1 })).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'Активные загрузки и очередь', level: 2 })
		).toBeVisible();
		await expect(page.getByText('Очередь пуста', { exact: true })).toBeVisible();
		await expect(
			page.getByText('Нет активных или запланированных загрузок.', { exact: true })
		).toBeVisible();

		await expect(page.getByRole('heading', { name: 'Сохраненные тома', level: 2 })).toBeVisible();
		await expect(page.getByText('Нет загрузок', { exact: true })).toBeVisible();
		await expect(
			page.getByText('У вас пока нет полностью скачанных глав.', { exact: true })
		).toBeVisible();

		// Деструктивные кнопки не показываются без активных/сохранённых загрузок
		await expect(page.getByRole('button', { name: 'Очистить очередь' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Отменить том' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Удалить том' })).toHaveCount(0);
	});
});

test.describe('/downloads: очередь через UI', () => {
	test('кнопка скачивания главы кладёт главу в очередь; «Отменить главу» убирает её', async ({
		catalog,
		page
	}) => {
		void catalog;
		await serveCatalogWithAbsoluteAudio(page);
		await hangAudioRequests(page);

		// Страница тома: главы загрузились из Dexie (фикстура catalog → мок /api/books/*)
		await page.goto(`/books/${BOOK.id}/${VOLUME_1.id}`);
		const playChapter = page.getByRole('button', {
			name: `Воспроизвести: ${CH_1.title}`,
			exact: true
		});
		await expect(playChapter).toBeVisible();

		// В строке главы вторая кнопка — «скачать» (Download.svelte, без aria-label)
		const row = page.locator('li').filter({ has: playChapter });
		await row.getByRole('button').last().click();

		// В менеджере загрузок появилась глава (аккордеон тома)
		await openDownloads(page);
		const subtitle = page.getByText('1 глава в очереди', { exact: true });
		await expect(subtitle).toBeVisible();
		await expect(page.getByRole('button', { name: 'Отменить том', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Очистить очередь', exact: true })).toBeVisible();

		// Раскрываем том и отменяем единственную главу — очередь пустеет
		await expandVolumeGroup(page, '1 глава в очереди');
		const queuedRow = page.locator('[data-slot="item"]').filter({ hasText: CH_1.title });
		await expect(queuedRow).toBeVisible();
		await queuedRow.getByRole('button', { name: 'Отменить главу', exact: true }).click();

		await expect(page.getByText('Очередь пуста', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Отменить том' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Очистить очередь' })).toHaveCount(0);
	});

	test('«Скачать все» → «Отменить главу» и «Очистить очередь» очищают очередь', async ({
		catalog,
		page
	}) => {
		void catalog;
		await serveCatalogWithAbsoluteAudio(page);
		await hangAudioRequests(page);

		await page.goto(`/books/${BOOK.id}/${VOLUME_1.id}`);
		const downloadAll = page.getByRole('button', { name: 'Скачать все', exact: true });
		await expect(downloadAll).toBeVisible();
		await downloadAll.click();

		// Том перешёл в состояние загрузки — кнопка в шапке сменилась
		await expect(page.getByRole('button', { name: /Отменить \(\d+\/3\)/ })).toBeVisible();

		// Активная очередь: том с тремя главами
		await openDownloads(page);
		await expect(
			page.getByRole('heading', { name: 'Активные загрузки и очередь', level: 2 })
		).toBeVisible();
		const subtitle = page.getByText('3 глав в очереди', { exact: true });
		await expect(subtitle).toBeVisible();
		await expect(page.getByRole('button', { name: 'Отменить том', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Очистить очередь', exact: true })).toBeVisible();
		await expect(page.getByText('Очередь пуста', { exact: true })).toHaveCount(0);

		// Отменяем одну главу («Листопад») — из очереди исчезает её строка
		await expandVolumeGroup(page, '3 глав в очереди');
		const chapterRow = page.locator('[data-slot="item"]').filter({ hasText: CH_2.title });
		await expect(chapterRow).toBeVisible();
		await chapterRow.getByRole('button', { name: 'Отменить главу', exact: true }).click();
		await expect(page.getByText('2 глав в очереди', { exact: true })).toBeVisible();
		await expect(page.getByText(CH_2.title, { exact: true })).toHaveCount(0);

		// «Очистить очередь» убирает все queued — остаётся только активная глава
		await page.getByRole('button', { name: 'Очистить очередь', exact: true }).click();
		await expect(page.getByText('1 глава в очереди', { exact: true })).toBeVisible();

		// Последняя (downloading) глава убирается кнопкой «Отменить главу»
		await page.getByRole('button', { name: 'Отменить главу', exact: true }).click();
		await expect(page.getByText('Очередь пуста', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Очистить очередь' })).toHaveCount(0);
	});

	test('«Отменить том» снимает с загрузки весь том', async ({ catalog, page }) => {
		void catalog;
		await serveCatalogWithAbsoluteAudio(page);
		await hangAudioRequests(page);

		await page.goto(`/books/${BOOK.id}/${VOLUME_1.id}`);
		const downloadAll = page.getByRole('button', { name: 'Скачать все', exact: true });
		await expect(downloadAll).toBeVisible();
		await downloadAll.click();
		await expect(page.getByRole('button', { name: /Отменить \(\d+\/3\)/ })).toBeVisible();

		await openDownloads(page);
		const subtitle = page.getByText('3 глав в очереди', { exact: true });
		await expect(subtitle).toBeVisible();

		// Кнопка в заголовке аккордеона — «Отменить том» (не раскрывая контент)
		await page.getByRole('button', { name: 'Отменить том', exact: true }).click();

		await expect(page.getByText('Очередь пуста', { exact: true })).toBeVisible();
		await expect(page.getByText('3 глав в очереди', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Отменить том' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Очистить очередь' })).toHaveCount(0);
	});
});

test.describe('/downloads: сохранённые тома (downloaded-состояние)', () => {
	test('метка «Доступно оффлайн», «Удалить главу» и «Удалить том»', async ({ guest, page }) => {
		void guest;
		await page.goto('/downloads');
		await expect(page.getByText('Нет загрузок', { exact: true })).toBeVisible();

		// Засеиваем downloaded-состояние (2 главы тома book-1-vol-1) и перезагружаем:
		// при старте приложения Dexie прочитает записи и отрисует «Сохранённые тома».
		await seedDownloadedState(page);
		await page.reload();

		// Том с меткой оффлайн-доступности и кнопкой «Удалить том»
		await expect(page.getByRole('heading', { name: 'Сохраненные тома', level: 2 })).toBeVisible();
		await expect(page.getByText('Доступно оффлайн: 2 глав', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Удалить том', exact: true })).toBeVisible();
		// Активная очередь по-прежнему пуста
		await expect(page.getByText('Очередь пуста', { exact: true })).toBeVisible();

		// Раскрываем том: строки глав с размером и «Удалить главу»
		await expandVolumeGroup(page, 'Доступно оффлайн: 2 глав');
		const firstRow = page.locator('[data-slot="item"]').filter({ hasText: CH_1.title });
		const secondRow = page.locator('[data-slot="item"]').filter({ hasText: CH_2.title });
		await expect(firstRow).toBeVisible();
		await expect(secondRow).toBeVisible();
		await expect(firstRow.getByText(/Размер: \d+\.\d{2} МБ/)).toBeVisible();

		// «Удалить главу» — исчезает только эта глава
		await secondRow.getByRole('button', { name: 'Удалить главу', exact: true }).click();
		await expect(page.getByText('Доступно оффлайн: 1 глава', { exact: true })).toBeVisible();
		await expect(page.getByText(CH_2.title, { exact: true })).toHaveCount(0);
		await expect(page.getByText(CH_1.title, { exact: true })).toBeVisible();

		// «Удалить том» — весь том удаляется, возвращается пустое состояние
		await page.getByRole('button', { name: 'Удалить том', exact: true }).click();
		await expect(page.getByText('Нет загрузок', { exact: true })).toBeVisible();
		await expect(page.getByText('Доступно оффлайн', { exact: false })).toHaveCount(0);
	});
});
