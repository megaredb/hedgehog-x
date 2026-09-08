/**
 * Фикстуры для тестов загрузок.
 *
 * Расширяет глобальный `test` из ../fixtures/test (guest/loggedIn/catalog/audio)
 * фикстурами page-объектов: `volumePage` (страница тома /books/[bookId]/[volumeId]
 * из e2e/catalog/volume.page.ts — источник очереди загрузок через кнопки
 * «Скачать»/«Скачать все») и `downloadsPage` (менеджер загрузок /downloads).
 *
 * Включаются «перечислением в параметрах»:
 *
 *   test('...', async ({ volumePage, downloadsPage }) => { ... })
 */
import { test as base, expect } from '../fixtures/test';
import { VolumePage } from '../catalog/volume.page';
import { DownloadsPage } from './downloads.page';

type DownloadsFixtures = {
	/** Page-object страницы тома (кнопки «Скачать»/«Скачать все» у глав). */
	volumePage: VolumePage;
	/** Page-object менеджера загрузок /downloads. */
	downloadsPage: DownloadsPage;
};

export const test = base.extend<DownloadsFixtures>({
	volumePage: async ({ page }, use) => {
		await use(new VolumePage(page));
	},
	downloadsPage: async ({ page }, use) => {
		await use(new DownloadsPage(page));
	}
});

export { expect };
