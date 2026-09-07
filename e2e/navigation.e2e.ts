import { test, expect } from './fixtures/test';

/**
 * E2E: навигация приложения.
 *
 * Покрывает общий каркас UI:
 *  1. Десктопный сайдбар (≥1024px): логотип HEDGEHOG.INC + все пункты меню.
 *  2. Мобильный хедер (<1024px): бургер «Toggle Menu» открывает Sheet с
 *     навигацией, клик по пункту закрывает меню.
 *  3. Переключатель темы: клик добавляет/снимает класс `.dark` на <html>.
 *  4. Дропдаун профиля: гость видит «Войти» → /auth; залогиненный видит имя
 *     и «Выйти» (мок sign-out) → редирект на главную.
 *  5. Хлебные крошки (AppBreadcrumbs) на вложенной странице содержат «Главная».
 *
 * Селекторы — по ролям/текстам (getByRole/getByText), без CSS-классов.
 */

const SIDEBAR_LINKS = [
	'Каталог',
	'Закладки',
	'История',
	'Загрузки',
	'Сообщество',
	'Поддержать',
	'О сайте'
] as const;

test.describe('Навигация: десктопный сайдбар', () => {
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	test('гость на главной видит логотип и все пункты меню в сайдбаре', async ({ page }) => {
		await page.goto('/');

		const sidebar = page.locator('aside');
		await expect(sidebar).toBeVisible();

		// Логотип
		await expect(sidebar.getByText('HEDGEHOG.INC')).toBeVisible();

		// Пункты меню обеих групп: Библиотека + Информация
		for (const label of SIDEBAR_LINKS) {
			await expect(sidebar.getByRole('link', { name: label })).toBeVisible();
		}

		// Гость: в нижнем блоке — ссылка «Войти»
		await expect(sidebar.getByRole('link', { name: 'Войти' })).toBeVisible();
	});

	test('гость: клик по «Войти» ведёт на страницу входа', async ({ page }) => {
		await page.goto('/');

		await page.locator('aside').getByRole('link', { name: 'Войти' }).click();

		// /auth с параметром from, чтобы после входа вернуться на главную
		await expect(page).toHaveURL(/\/auth\?from=/);
	});

	test('переключатель темы добавляет и снимает класс .dark на <html>', async ({ page }) => {
		// Стартуем с гарантированно светлой темой (mode-watcher хранит выбор в localStorage)
		await page.addInitScript(() => {
			localStorage.setItem('mode-watcher-mode', 'light');
		});

		await page.goto('/');

		const html = page.locator('html');
		await expect(html).not.toHaveClass(/dark/);

		const themeToggle = page.getByRole('button', { name: 'Переключить тему' });
		await expect(themeToggle).toBeVisible();

		// Клик → тёмная тема
		await themeToggle.click();
		await expect(html).toHaveClass(/dark/);

		// Повторный клик → светлая тема
		await themeToggle.click();
		await expect(html).not.toHaveClass(/dark/);
	});

	test('хлебные крошки видны на вложенной странице и содержат «Главная»', async ({ page }) => {
		await page.goto('/about');

		const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' });
		await expect(breadcrumb).toBeVisible();

		const homeCrumb = breadcrumb.getByRole('link', { name: 'Главная' });
		await expect(homeCrumb).toBeVisible();
		await expect(homeCrumb).toHaveAttribute('href', '/');

		// На главной (`/`) крошек нет — segments пустой
		await page.goto('/');
		await expect(page.getByRole('navigation', { name: 'breadcrumb' })).toHaveCount(0);
	});
});

test.describe('Навигация: мобильный хедер (< 1024px)', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	test('бургер открывает Sheet с навигацией, клик по пункту закрывает', async ({ page }) => {
		await page.goto('/');

		// Сайдбар скрыт на мобильном — пунктов меню в дереве доступности нет
		await expect(page.getByRole('link', { name: 'Каталог' })).toHaveCount(0);

		// Бургер (aria-label из sr-only текста «Toggle Menu»)
		const burger = page.getByRole('button', { name: 'Toggle Menu' });
		await expect(burger).toBeVisible();
		await burger.click();

		// Открылся Sheet (bits-ui Dialog, role=dialog) с навигацией
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		for (const label of SIDEBAR_LINKS) {
			await expect(dialog.getByRole('link', { name: label })).toBeVisible();
		}

		// Клик по пункту меню закрывает Sheet и ведёт на страницу
		await dialog.getByRole('link', { name: 'О сайте' }).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(page).toHaveURL(/\/about$/);
	});
});

test.describe('Навигация: дропдаун профиля (залогинен)', () => {
	test.beforeEach(async ({ loggedIn }) => {
		void loggedIn;
	});

	test('залогиненный видит имя в дропдауне; «Выйти» редиректит на главную', async ({ page }) => {
		// Мок sign-out (better-auth POST /api/auth/sign-out)
		await page.route('**/api/auth/sign-out', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			})
		);

		await page.goto('/');

		const sidebar = page.locator('aside');
		// Имя пользователя в триггере дропдауна
		await expect(sidebar.getByText('Еж Тестовый')).toBeVisible();

		// Открываем дропдаун
		await sidebar.getByRole('button', { name: /Еж Тестовый/ }).click();
		const menu = page.getByRole('menu');
		await expect(menu.getByRole('menuitem', { name: 'Мой аккаунт' })).toBeVisible();
		await expect(menu.getByRole('menuitem', { name: 'Выйти' })).toBeVisible();

		// Выход → редирект на главную
		await menu.getByRole('menuitem', { name: 'Выйти' }).click();
		await expect(page).toHaveURL(/localhost:4173\//);
	});
});
