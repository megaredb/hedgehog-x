import { test, expect } from './fixtures/test';
import { ROUTE_TITLES } from '../src/lib/route-titles';
import { mockListAccounts } from './fixtures/mocks';
import { GUEST_STATIC_PAGES } from './fixtures/utils';

/**
 * E2E: единый источник заголовков (ROUTE_TITLES) согласует h1 страниц и
 * хлебные крошки (AppBreadcrumbs) на статических маршрутах.
 *
 * Ожидаемый текст берётся из импортированной карты ROUTE_TITLES, а не
 * захардкожен в тесте: если страница (h1) или последняя крошка отдадут
 * текст, отличный от карты — тест упадёт. ROUTE_TITLES — изотропный модуль
 * без алиасов, поэтому импортируется относительным путём из e2e.
 */

test.describe('ROUTE_TITLES: h1 страницы и крошки согласованы (гость)', () => {
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	for (const path of GUEST_STATIC_PAGES) {
		test(`${path}: h1 и последняя крошка равны ROUTE_TITLES['${path.slice(1)}']`, async ({
			page
		}) => {
			const title = ROUTE_TITLES[path.slice(1)];
			expect(title, `в ROUTE_TITLES нет заголовка для сегмента «${path.slice(1)}»`).toBeTruthy();

			await page.goto(path);

			// Заголовок страницы (h1) = значение карты
			await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();

			// Хлебные крошки: ссылка «Главная» на / + последняя крошка с тем же текстом
			const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' });
			await expect(breadcrumb).toBeVisible();
			await expect(breadcrumb.getByRole('link', { name: ROUTE_TITLES[''] })).toHaveAttribute(
				'href',
				'/'
			);
			// Последняя крошка (Breadcrumb.Page: role=link, aria-current=page) —
			// ровно один элемент с текстом заголовка внутри навигации крошек.
			await expect(breadcrumb.getByRole('link', { name: title })).toHaveCount(1);
		});
	}
});

test.describe('ROUTE_TITLES: /profile (залогинен)', () => {
	test('h1 «Мой аккаунт» и последняя крошка согласованы с картой', async ({ page, loggedIn }) => {
		void loggedIn;
		const title = ROUTE_TITLES['profile'];
		// Явная проверка для читаемости (см. также unit-тесты карты)
		expect(title).toBe('Мой аккаунт');

		// Профиль при залогиненном пользователе грузит способы входа —
		// мокаем list-accounts (как в profile.e2e.ts), чтобы не зависеть от БД.
		await mockListAccounts(page, []);

		await page.goto('/profile');
		await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();

		const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' });
		await expect(breadcrumb).toBeVisible();
		await expect(breadcrumb.getByRole('link', { name: ROUTE_TITLES[''] })).toHaveAttribute(
			'href',
			'/'
		);
		await expect(breadcrumb.getByRole('link', { name: title })).toHaveCount(1);
	});
});
