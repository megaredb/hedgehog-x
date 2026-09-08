/**
 * E2E: страница входа (/auth) — новый стиль:
 *  - page-object AuthPage (e2e/auth/auth.page.ts) для кнопок/состояний/модалок;
 *  - каркас (имя в шапке, «Выйти») проверяется через общий Shell
 *    (e2e/shared/shell.page.ts) — локальное состояние сессии мокается фикстурой
 *    loggedIn из e2e/fixtures/test.ts.
 *
 * Покрытие перенесено из старого плоского e2e/auth.e2e.ts (удалён) без потери
 * ни одного ассерта:
 *  1. /auth рендерит кнопки «Войти через Telegram» и «Войти через Discord».
 *  2. Клик по Telegram → sign-in/social уходит с провайдером и редиректит на
 *     oauth.telegram.org (внешний хост перехватывается, НЕ навигируется реально).
 *  3. Клик по Discord → то же для discord.com (провайдер discord в теле запроса).
 *  4. Ошибка у провайдера (?error=access_denied) → модалка с сообщением.
 *  5. Ошибка sign-in/social → модалка «Не удалось войти».
 *  6. Залогиненный: имя в шапке (Shell) + карточка на /auth с «Выйти».
 */

import { test, expect } from '../fixtures/test';
import { BASE_URL } from '../config';
import { MOCK_USER } from '../fixtures/data';
import { AuthPage } from './auth.page';
import { Shell } from '../shared/shell.page';

const TELEGRAM_OAUTH_URL = 'https://oauth.telegram.org/auth';
const DISCORD_OAUTH_URL = 'https://discord.com/api/oauth2/authorize';

test.describe('Авторизация через внешние провайдеры', () => {
	// Гость: get-session → null (как если бы session-cookie не было).
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	test('страница /auth показывает кнопки входа через Telegram и Discord', async ({ page }) => {
		const auth = new AuthPage(page);
		await auth.goto();
		await expect(auth.telegramButton).toBeVisible();
		await expect(auth.discordButton).toBeVisible();
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

		// Перехватываем внешний хост, чтобы не навигировать на реальный oauth.telegram.org
		let externalUrl = '';
		await page.route('https://oauth.telegram.org/**', (route) => {
			externalUrl = route.request().url();
			return route.fulfill({
				status: 200,
				contentType: 'text/html',
				body: '<html><body></body></html>'
			});
		});

		const auth = new AuthPage(page);
		await auth.goto();
		await auth.telegramButton.click();

		await expect.poll(() => externalUrl).toContain('oauth.telegram.org/auth');
	});

	test('клик по Discord запускает OAuth2-редирект на discord.com', async ({ page }) => {
		// В route-колбэке только захватываем тело запроса — ассерты вынесены
		// ниже, после действия (иначе при несовпадении тест зависает, а не падает).
		let provider = '';
		await page.route('**/api/auth/sign-in/social', async (route) => {
			provider = ((route.request().postDataJSON() ?? {}) as { provider?: string }).provider ?? '';
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					url: `${DISCORD_OAUTH_URL}?response_type=code&client_id=1463632713943748925&redirect_uri=${encodeURIComponent(new URL('/api/auth/callback/discord', BASE_URL).href)}`,
					redirect: true
				})
			});
		});

		// Перехватываем внешний хост discord.com, чтобы не навигировать на реальный discord.com
		let externalUrl = '';
		await page.route('https://discord.com/**', (route) => {
			externalUrl = route.request().url();
			return route.fulfill({
				status: 200,
				contentType: 'text/html',
				body: '<html><body></body></html>'
			});
		});

		const auth = new AuthPage(page);
		await auth.goto();
		await auth.discordButton.click();

		// sign-in/social ушёл с провайдером discord
		await expect.poll(() => provider).toBe('discord');
		// Мок sign-in/social возвращает URL discord.com (Discord сам редиректит /api → /oauth2/authorize)
		await expect.poll(() => externalUrl).toContain('discord.com/api/oauth2/authorize');
	});

	test('при ошибке авторизации (отмена у провайдера) показывается модалка', async ({ page }) => {
		const auth = new AuthPage(page);
		await auth.goto('/auth?error=access_denied');

		const dialog = auth.dialog;
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText('Не удалось войти');
		await expect(dialog).toContainText('Вы отменили авторизацию. Вход не выполнен.');

		// Закрываем модалку
		await auth.dialogButton('Понятно').click();
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

		const auth = new AuthPage(page);
		await auth.goto();
		await auth.telegramButton.click();

		const dialog = auth.dialog;
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText('Не удалось войти');

		await auth.dialogButton('Понятно').click();
		await expect(dialog).not.toBeVisible();
	});
});

test.describe('Авторизация: залогиненный пользователь', () => {
	// Залогинен: get-session → MOCK_USER + MOCK_SESSION (имя «Еж Тестовый»).
	test.beforeEach(async ({ loggedIn }) => {
		void loggedIn;
	});

	test('залогиненный видит имя в шапке (Shell) и карточку /auth с «Выйти»', async ({ page }) => {
		const shell = new Shell(page);
		const auth = new AuthPage(page);

		await auth.goto('/auth');

		// Имя пользователя видно в шапке (Shell — ProfileDropdown в сайдбаре).
		await expect(shell.sidebar.getByText(MOCK_USER.name)).toBeVisible();

		// И на /auth в карточке залогиненного: имя + кнопка «Выйти».
		await expect(auth.userName(MOCK_USER.name)).toBeVisible();
		await expect(auth.signOutButton).toBeVisible();
	});
});
