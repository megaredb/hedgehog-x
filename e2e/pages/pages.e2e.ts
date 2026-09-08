/**
 * E2E: статические страницы приложения (гость) — новый стиль:
 *  - заглушки (/bookmarks /community /history /settings /support) — h1 через
 *    PageHeader, текст из ROUTE_TITLES (единый источник, не хардкод);
 *  - согласованность h1 и хлебных крошек проверяется через общий Shell
 *    (e2e/shared/shell.page.ts), список маршрутов — STUB_PAGES из
 *    e2e/fixtures/utils.ts;
 *  - /about: заголовки «О сайте», «Автор контента», «Разработчики», авторы
 *    megared/mk-rn и кнопки «GitHub» с корректными внешними ссылками.
 *
 * Все страницы доступны гостю (без сессии).
 */

import { test, expect } from '../fixtures/test';
import { ROUTE_TITLES } from '../../src/lib/route-titles';
import { STUB_PAGES } from '../fixtures/utils';
import { Shell } from '../shared/shell.page';

test.describe('Страницы-заглушки (PageHeader + крошки)', () => {
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	for (const path of STUB_PAGES) {
		const title = ROUTE_TITLES[path.slice(1)];
		test(`${path} рендерит h1 «${title}» и согласованную хлебную крошку`, async ({ page }) => {
			const shell = new Shell(page);
			expect(title, `в ROUTE_TITLES нет заголовка для сегмента «${path.slice(1)}»`).toBeTruthy();

			await shell.goto(path);

			// Заголовок страницы (h1 через PageHeader) = значение карты.
			await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();

			// Хлебные крошки: ссылка «Главная» на / + последняя крошка с тем же текстом.
			const breadcrumb = shell.breadcrumb;
			await expect(breadcrumb).toBeVisible();
			await expect(shell.breadcrumbRoot).toHaveAttribute('href', '/');
			await expect(shell.breadcrumbCrumb(title)).toHaveCount(1);
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
