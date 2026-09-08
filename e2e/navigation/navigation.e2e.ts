import { test, expect } from '../fixtures/test';
import { NAV_ITEMS, Shell } from '../shared/shell.page';

/**
 * E2E: навигация приложения (каркас, рендерится на каждой странице).
 *
 * Все действия и точки поиска идут через page-object Shell (e2e/shared/shell.page.ts),
 * который оборачивает AppNavigation / ProfileDropdown / ThemeSwitchButton /
 * AppBreadcrumbs из +layout.svelte. Селекторы — по ролям/текстам, без CSS-классов.
 *
 * Покрытие (перенесено из старого плоского e2e/navigation.e2e.ts без потери
 * ни одного ассерта):
 *  1. Десктопный сайдбар (≥1024px): логотип + все пункты меню + «Войти» (гость).
 *  2. Гость: клик по «Войти» → /auth?from=…
 *  3. Переключатель темы: клик добавляет/снимает класс `.dark` на <html>.
 *  4. Хлебные крошки на вложенной странице содержат «Главная».
 *  5. Мобильный хедер (<1024px): бургер открывает Sheet, клик по пункту закрывает.
 *  6. Залогиненный: дропдаун с именем и «Выйти» → редирект на главную.
 */

test.describe('Навигация: десктопный сайдбар', () => {
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	test('гость на главной видит логотип и все пункты меню в сайдбаре', async ({ page }) => {
		const shell = new Shell(page);
		await shell.goto('/');

		await expect(shell.sidebar).toBeVisible();
		await expect(shell.logo).toBeVisible();

		// Пункты меню обеих групп: Библиотека + Информация
		for (const label of NAV_ITEMS) {
			await expect(shell.navItem(label)).toBeVisible();
		}

		// Гость: в нижнем блоке — ссылка «Войти»
		await expect(shell.signInLink).toBeVisible();
	});

	test('гость: клик по «Войти» ведёт на страницу входа', async ({ page }) => {
		const shell = new Shell(page);
		await shell.goto('/');

		await shell.signInLink.click();

		// /auth с параметром from, чтобы после входа вернуться на главную
		await expect(page).toHaveURL(/\/auth\?from=/);
	});

	test('переключатель темы добавляет и снимает класс .dark на <html>', async ({ page }) => {
		const shell = new Shell(page);
		// Стартуем с гарантированно светлой темой (mode-watcher хранит выбор в localStorage)
		await page.addInitScript(() => {
			localStorage.setItem('mode-watcher-mode', 'light');
		});

		await shell.goto('/');

		await expect(shell.html).not.toHaveClass(/dark/);

		const themeToggle = shell.themeToggle;
		await expect(themeToggle).toBeVisible();

		// Клик → тёмная тема
		await themeToggle.click();
		await expect(shell.html).toHaveClass(/dark/);

		// Повторный клик → светлая тема
		await themeToggle.click();
		await expect(shell.html).not.toHaveClass(/dark/);
	});

	test('хлебные крошки видны на вложенной странице и содержат «Главная»', async ({ page }) => {
		const shell = new Shell(page);
		await shell.goto('/about');

		await expect(shell.breadcrumb).toBeVisible();

		const homeCrumb = shell.breadcrumbRoot;
		await expect(homeCrumb).toBeVisible();
		await expect(homeCrumb).toHaveAttribute('href', '/');

		// На главной (`/`) крошек нет — segments пустой
		await shell.goto('/');
		await expect(shell.breadcrumb).toHaveCount(0);
	});
});

test.describe('Навигация: мобильный хедер (< 1024px)', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	test('бургер открывает Sheet с навигацией, клик по пункту закрывает', async ({ page }) => {
		const shell = new Shell(page);
		await shell.goto('/');

		// Сайдбар скрыт на мобильном — пунктов меню в дереве доступности нет
		await expect(shell.navItem('Каталог')).toHaveCount(0);

		// Бургер (aria-label из sr-only текста «Toggle Menu»)
		const burger = shell.mobileBurger;
		await expect(burger).toBeVisible();

		// Открылся Sheet (bits-ui Dialog, role=dialog) с навигацией
		const dialog = await shell.openMobileMenu();
		await expect(dialog).toBeVisible();
		for (const label of NAV_ITEMS) {
			await expect(dialog.getByRole('link', { name: label })).toBeVisible();
		}

		// Клик по пункту меню закрывает Sheet и ведёт на страницу
		await dialog.getByRole('link', { name: 'О сайте' }).click();
		await expect(shell.mobileSheet).toHaveCount(0);
		await expect(page).toHaveURL(/\/about$/);
	});
});

test.describe('Навигация: дропдаун профиля (залогинен)', () => {
	test.beforeEach(async ({ loggedIn }) => {
		void loggedIn;
	});

	test('залогиненный видит имя в дропдауне; «Выйти» редиректит на главную', async ({ page }) => {
		const shell = new Shell(page);
		// Мок sign-out (better-auth POST /api/auth/sign-out)
		await page.route('**/api/auth/sign-out', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			})
		);

		await shell.goto('/');

		// Имя пользователя в триггере дропдауна
		await expect(shell.sidebar.getByText('Еж Тестовый')).toBeVisible();

		// Открываем дропдаун
		const menu = await shell.openProfileMenu('Еж Тестовый');
		await expect(menu).toBeVisible();
		await expect(shell.profileMenuItem('Мой аккаунт')).toBeVisible();
		await expect(shell.profileMenuItem('Выйти')).toBeVisible();

		// Выход → редирект на главную
		await shell.signOut('Еж Тестовый');
		await expect(page).toHaveURL('/');
	});
});
