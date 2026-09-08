import { test, expect } from './fixtures/test';
import { ROUTE_TITLES } from '../src/lib/route-titles';
import { STUB_PAGES } from './fixtures/utils';

/**
 * E2E: статические страницы приложения (гость).
 *
 *  1. Заглушки /bookmarks, /community, /history, /settings, /support рендерят
 *     свой заголовок через PageHeader (<h1>) — текст из ROUTE_TITLES.
 *  2. /about: заголовки «О сайте», «Автор контента», «Разработчики», авторы
 *     megared/mk-rn и кнопки «GitHub» с корректными внешними ссылками.
 *
 * Все страницы доступны гостю (без сессии).
 */

test.describe('Страницы-заглушки (PageHeader)', () => {
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	for (const path of STUB_PAGES) {
		const title = ROUTE_TITLES[path.slice(1)];
		test(`${path} рендерит заголовок «${title}»`, async ({ page }) => {
			await page.goto(path);
			await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
		});
	}
});

test.describe('Страница «О сайте» (/about)', () => {
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	test('содержит заголовки, авторов и внешние ссылки на GitHub', async ({ page }) => {
		await page.goto('/about');

		// Заголовки страницы
		await expect(page.getByRole('heading', { name: 'О сайте', level: 1 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Автор контента' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Разработчики' })).toBeVisible();

		// Авторы-разработчики
		await expect(page.getByText('megared')).toBeVisible();
		await expect(page.getByText('mk-rn')).toBeVisible();

		// Кнопки «GitHub» — внешние ссылки (проверяем атрибут href, без перехода)
		const githubLinks = page.getByRole('link', { name: 'GitHub' });
		await expect(githubLinks).toHaveCount(2);

		// Порядок карточек совпадает с порядком массива developers: megared, mk-rn
		await expect(githubLinks.nth(0)).toHaveAttribute('href', 'https://github.com/megaredb');
		await expect(githubLinks.nth(1)).toHaveAttribute('href', 'https://github.com/mk-rn');
		// Ссылки открываются в новой вкладке
		await expect(githubLinks.nth(0)).toHaveAttribute('target', '_blank');
	});
});
