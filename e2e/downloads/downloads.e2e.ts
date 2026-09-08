/**
 * E2E: менеджер загрузок (/downloads) — новый стиль: page-объекты через
 * фикстуру (DownloadsPage из downloads.page.ts + VolumePage из
 * e2e/catalog/volume.page.ts — очередь через «Скачать»/«Скачать все» у глав).
 * Детерминизм скачивания вынесен в downloads.helpers.ts (перенесён как есть из
 * удалённого плоского e2e/downloads.e2e.ts): абсолютные audioUrl в каталоге,
 * «висящие» аудио-запросы, serviceWorkers:'block', засев IndexedDB.
 *
 * Покрытие (перенесено без потери ассертов):
 *  1. Гость: пустые состояния «Очередь пуста» и «Нет загрузок».
 *  2. Очередь через UI: «Скачать все»/кнопка у главы на странице тома →
 *     активная секция с «Отменить том»/«Отменить главу»/«Очистить очередь»;
 *     клики удаляют главы/том из очереди (возврат к пустому состоянию).
 *  3. «Сохранённые тома»: downloaded-состояние засевается напрямую в IndexedDB —
 *     метка «Доступно оффлайн», «Удалить главу» и «Удалить том».
 */

import { test, expect } from './downloads.fixtures';
import type { Page } from '@playwright/test';
import { MOCK_CATALOG } from '../fixtures/data';
import {
	hangAudioRequests,
	seedDownloadedState,
	serveCatalogWithAbsoluteAudio
} from './downloads.helpers';

test.use({ serviceWorkers: 'block' });

const BOOK = MOCK_CATALOG;
const VOLUME_1 = BOOK.volumes.find((v) => v.id === 'book-1-vol-1')!;
const CH_1 = VOLUME_1.chapters.find((c) => c.id === 'book-1-ch-1')!; // «Встреча у ручья»
const CH_2 = VOLUME_1.chapters.find((c) => c.id === 'book-1-ch-2')!; // «Листопад»

/** Каталог с абсолютными audioUrl + «висящие» аудио-запросы (детерминизм). */
async function deterministicCatalog(page: Page): Promise<void> {
	await serveCatalogWithAbsoluteAudio(page);
	await hangAudioRequests(page);
}

test.describe('/downloads: гость, пустые состояния', () => {
	test('«Очередь пуста» и «Нет загрузок», управляющих кнопок нет', async ({
		guest,
		downloadsPage
	}) => {
		void guest;
		await downloadsPage.goto();

		await expect(downloadsPage.heading).toBeVisible();
		await expect(downloadsPage.activeHeading).toBeVisible();
		await expect(downloadsPage.queueEmptyText).toBeVisible();
		await expect(downloadsPage.queueEmptyDescription).toBeVisible();

		await expect(downloadsPage.savedHeading).toBeVisible();
		await expect(downloadsPage.noDownloadsText).toBeVisible();
		await expect(downloadsPage.noDownloadsDescription).toBeVisible();

		// Деструктивные кнопки не показываются без активных/сохранённых загрузок
		await expect(downloadsPage.clearQueueButton).toHaveCount(0);
		await expect(downloadsPage.cancelVolumeButton).toHaveCount(0);
		await expect(downloadsPage.deleteVolumeButton).toHaveCount(0);
	});
});

test.describe('/downloads: очередь через UI', () => {
	test('кнопка скачивания главы кладёт главу в очередь; «Отменить главу» убирает её', async ({
		catalog,
		page,
		volumePage,
		downloadsPage
	}) => {
		void catalog;
		await deterministicCatalog(page);

		// Страница тома: главы загрузились из Dexie (фикстура catalog → мок /api/books/*)
		await volumePage.goto(BOOK.id, VOLUME_1.id);
		await expect(volumePage.playButton(CH_1.title)).toBeVisible();

		// В строке главы вторая кнопка — «скачать» (Download.svelte, без aria-label)
		await volumePage.downloadChapter(CH_1.title);

		// В менеджере загрузок появилась глава (аккордеон тома)
		await downloadsPage.openFromVolumeNav();
		await expect(downloadsPage.groupSubtitle('1 глава в очереди')).toBeVisible();
		await expect(downloadsPage.cancelVolumeButton).toBeVisible();
		await expect(downloadsPage.clearQueueButton).toBeVisible();

		// Раскрываем том и отменяем единственную главу — очередь пустеет
		await downloadsPage.expandGroup('1 глава в очереди');
		const queuedRow = downloadsPage.chapterRow(CH_1.title);
		await expect(queuedRow).toBeVisible();
		await downloadsPage.cancelChapterButton(CH_1.title).click();

		await expect(downloadsPage.queueEmptyText).toBeVisible();
		await expect(downloadsPage.cancelVolumeButton).toHaveCount(0);
		await expect(downloadsPage.clearQueueButton).toHaveCount(0);
	});

	test('«Скачать все» → «Отменить главу» и «Очистить очередь» очищают очередь', async ({
		catalog,
		page,
		volumePage,
		downloadsPage
	}) => {
		void catalog;
		await deterministicCatalog(page);

		await volumePage.goto(BOOK.id, VOLUME_1.id);
		await expect(volumePage.downloadAllButton).toBeVisible();
		await volumePage.downloadAll();

		// Том перешёл в состояние загрузки — кнопка в шапке сменилась
		await expect(volumePage.cancelVolumeProgressButton).toBeVisible();

		// Активная очередь: том с тремя главами
		await downloadsPage.openFromVolumeNav();
		await expect(downloadsPage.activeHeading).toBeVisible();
		await expect(downloadsPage.groupSubtitle('3 глав в очереди')).toBeVisible();
		await expect(downloadsPage.cancelVolumeButton).toBeVisible();
		await expect(downloadsPage.clearQueueButton).toBeVisible();
		await expect(downloadsPage.queueEmptyText).toHaveCount(0);

		// Отменяем одну главу («Листопад») — из очереди исчезает её строка
		await downloadsPage.expandGroup('3 глав в очереди');
		const chapterRow = downloadsPage.chapterRow(CH_2.title);
		await expect(chapterRow).toBeVisible();
		await downloadsPage.cancelChapterButton(CH_2.title).click();
		await expect(downloadsPage.groupSubtitle('2 глав в очереди')).toBeVisible();
		await expect(downloadsPage.page.getByText(CH_2.title, { exact: true })).toHaveCount(0);

		// «Очистить очередь» убирает все queued — остаётся только активная глава
		await downloadsPage.clearQueueButton.click();
		await expect(downloadsPage.groupSubtitle('1 глава в очереди')).toBeVisible();

		// Последняя (downloading) глава убирается кнопкой «Отменить главу»
		await downloadsPage.page.getByRole('button', { name: 'Отменить главу', exact: true }).click();
		await expect(downloadsPage.queueEmptyText).toBeVisible();
		await expect(downloadsPage.clearQueueButton).toHaveCount(0);
	});

	test('«Отменить том» снимает с загрузки весь том', async ({
		catalog,
		page,
		volumePage,
		downloadsPage
	}) => {
		void catalog;
		await deterministicCatalog(page);

		await volumePage.goto(BOOK.id, VOLUME_1.id);
		await expect(volumePage.downloadAllButton).toBeVisible();
		await volumePage.downloadAll();
		await expect(volumePage.cancelVolumeProgressButton).toBeVisible();

		await downloadsPage.openFromVolumeNav();
		await expect(downloadsPage.groupSubtitle('3 глав в очереди')).toBeVisible();

		// Кнопка в заголовке аккордеона — «Отменить том» (не раскрывая контент)
		await downloadsPage.cancelVolumeButton.click();

		await expect(downloadsPage.queueEmptyText).toBeVisible();
		await expect(downloadsPage.groupSubtitle('3 глав в очереди')).toHaveCount(0);
		await expect(downloadsPage.cancelVolumeButton).toHaveCount(0);
		await expect(downloadsPage.clearQueueButton).toHaveCount(0);
	});
});

test.describe('/downloads: сохранённые тома (downloaded-состояние)', () => {
	test('метка «Доступно оффлайн», «Удалить главу» и «Удалить том»', async ({
		guest,
		page,
		downloadsPage
	}) => {
		void guest;
		await downloadsPage.goto();
		await expect(downloadsPage.noDownloadsText).toBeVisible();

		// Засеиваем downloaded-состояние (2 главы тома book-1-vol-1) и перезагружаем:
		// при старте приложения Dexie прочитает записи и отрисует «Сохранённые тома».
		await seedDownloadedState(page);
		await page.reload();

		// Том с меткой оффлайн-доступности и кнопкой «Удалить том»
		await expect(downloadsPage.savedHeading).toBeVisible();
		await expect(downloadsPage.groupSubtitle('Доступно оффлайн: 2 глав')).toBeVisible();
		await expect(downloadsPage.deleteVolumeButton).toBeVisible();
		// Активная очередь по-прежнему пуста
		await expect(downloadsPage.queueEmptyText).toBeVisible();

		// Раскрываем том: строки глав с размером и «Удалить главу»
		await downloadsPage.expandGroup('Доступно оффлайн: 2 глав');
		const firstRow = downloadsPage.chapterRow(CH_1.title);
		const secondRow = downloadsPage.chapterRow(CH_2.title);
		await expect(firstRow).toBeVisible();
		await expect(secondRow).toBeVisible();
		await expect(firstRow.getByText(/Размер: \d+\.\d{2} МБ/)).toBeVisible();

		// «Удалить главу» — исчезает только эта глава
		await downloadsPage.deleteChapterButton(CH_2.title).click();
		await expect(downloadsPage.groupSubtitle('Доступно оффлайн: 1 глава')).toBeVisible();
		await expect(downloadsPage.page.getByText(CH_2.title, { exact: true })).toHaveCount(0);
		await expect(downloadsPage.page.getByText(CH_1.title, { exact: true })).toBeVisible();

		// «Удалить том» — весь том удаляется, возвращается пустое состояние
		await downloadsPage.deleteVolumeButton.click();
		await expect(downloadsPage.noDownloadsText).toBeVisible();
		await expect(downloadsPage.page.getByText('Доступно оффлайн', { exact: false })).toHaveCount(0);
	});
});
