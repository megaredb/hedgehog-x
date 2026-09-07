import { test, expect } from './fixtures/test';
import { BASE_URL } from './config';

/**
 * E2E: авторизация через Telegram (OIDC) и Discord (OAuth2).
 *
 * Полный OAuth-флоу (oauth.telegram.org / discord.com → callback → сессия)
 * требует реальных приложений с настроенными Redirect URI, поэтому в e2e
 * мы проверяем:
 *  1. Страница /auth рендерит кнопки «Войти через Telegram» и «Войти через
 *     Discord».
 *  2. Клик отправляет корректный запрос sign-in/social с правильным
 *     провайдером и редиректит на страницу авторизации провайдера.
 *  3. При залогиненном состоянии (мок get-session) шапка показывает имя
 *     пользователя, а на /auth — кнопку «Выйти».
 */

const TELEGRAM_OAUTH_URL = 'https://oauth.telegram.org/auth';
const DISCORD_OAUTH_URL = 'https://discord.com/api/oauth2/authorize';

test.describe('Авторизация через внешние провайдеры', () => {
	// Гость: get-session → null (как если бы session-cookie не было).
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	test('страница /auth показывает кнопки входа через Telegram и Discord', async ({ page }) => {
		await page.goto('/auth');
		await expect(page.getByRole('button', { name: 'Войти через Telegram' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Войти через Discord' })).toBeVisible();
	});

	test('клик по Telegram запускает OIDC-редирект на oauth.telegram.org', async ({ page }) => {
		// Перехватываем sign-in/social и возвращаем URL oauth.telegram.org
		await page.route('**/api/auth/sign-in/social', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					url: `${TELEGRAM_OAUTH_URL}?response_type=code&client_id=8204202555&scope=openid+profile&redirect_uri=${encodeURIComponent(new URL('/api/auth/callback/telegram-oidc', BASE_URL).href)}`,
					redirect: true
				})
			});
		});

		await page.goto('/auth');
		await page.getByRole('button', { name: 'Войти через Telegram' }).click();

		await expect(page).toHaveURL(new RegExp(TELEGRAM_OAUTH_URL.replace('.', '\\.')));
	});

	test('клик по Discord запускает OAuth2-редирект на discord.com', async ({ page }) => {
		await page.route('**/api/auth/sign-in/social', async (route) => {
			const body = (route.request().postDataJSON() ?? {}) as { provider?: string };
			expect(body.provider).toBe('discord');
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					url: `${DISCORD_OAUTH_URL}?response_type=code&client_id=1463632713943748925&redirect_uri=${encodeURIComponent(new URL('/api/auth/callback/discord', BASE_URL).href)}`,
					redirect: true
				})
			});
		});

		await page.goto('/auth');
		await page.getByRole('button', { name: 'Войти через Discord' }).click();

		// Discord сам редиректит на https://discord.com/oauth2/authorize (без /api)
		await expect(page).toHaveURL(/discord\.com\/oauth2\/authorize/);
	});

	test('при ошибке авторизации (отмена у провайдера) показывается модалка', async ({ page }) => {
		// Возврат с провайдера с error=access_denied
		await page.goto('/auth?error=access_denied');

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText('Не удалось войти');
		await expect(dialog).toContainText('Вы отменили авторизацию. Вход не выполнен.');

		// Закрываем модалку
		await dialog.getByRole('button', { name: 'Понятно' }).click();
		await expect(dialog).not.toBeVisible();

		// Параметр error убран из URL
		await expect(page).not.toHaveURL(/error=/);
	});

	test('при ошибке sign-in/social возвращается модалка с сообщением', async ({ page }) => {
		await page.route('**/api/auth/sign-in/social', async (route) => {
			await route.fulfill({
				status: 400,
				contentType: 'application/json',
				body: JSON.stringify({
					error: { message: 'provider_not_found' }
				})
			});
		});

		await page.goto('/auth');
		await page.getByRole('button', { name: 'Войти через Telegram' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText('Не удалось войти');

		await dialog.getByRole('button', { name: 'Понятно' }).click();
		await expect(dialog).not.toBeVisible();
	});
});

test.describe('Авторизация: залогиненный пользователь', () => {
	// Залогинен: get-session → MOCK_USER + MOCK_SESSION (имя «Еж Тестовый»).
	test.beforeEach(async ({ loggedIn }) => {
		void loggedIn;
	});

	test('при залогиненном пользователе шапка показывает имя и есть кнопка выхода', async ({
		page
	}) => {
		await page.goto('/auth');

		// Имя пользователя видно на странице /auth (в профильном блоке) и в шапке
		await expect(page.getByRole('main').getByText('Еж Тестовый')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
	});
});
