/**
 * Фикстуры для тестов каталога.
 *
 * Расширяет глобальный `test` из ../fixtures/test (guest/loggedIn/catalog/audio)
 * фикстурами page-объектов: `bookPage` (страница книги /books/[bookId]),
 * `volumePage` (страница тома /books/[bookId]/[volumeId]) и `playerBar`
 * (закреплённый GlobalPlayer из e2e/shared/player.page.ts — нужен для проверки
 * запуска воспроизведения по клику на главу).
 *
 * Включаются «перечислением в параметрах»:
 *
 *   test('...', async ({ bookPage, volumePage }) => { ... })
 */
import { test as base, expect } from '../fixtures/test';
import { PlayerBar } from '../shared/player.page';
import { BookPage } from './catalog.page';
import { VolumePage } from './volume.page';

type CatalogFixtures = {
	/** Page-object страницы книги /books/[bookId]. */
	bookPage: BookPage;
	/** Page-object страницы тома /books/[bookId]/[volumeId]. */
	volumePage: VolumePage;
	/** Page-object закреплённого плеера GlobalPlayer. */
	playerBar: PlayerBar;
};

export const test = base.extend<CatalogFixtures>({
	bookPage: async ({ page }, use) => {
		await use(new BookPage(page));
	},
	volumePage: async ({ page }, use) => {
		await use(new VolumePage(page));
	},
	playerBar: async ({ page }, use) => {
		await use(new PlayerBar(page));
	}
});

export { expect };
