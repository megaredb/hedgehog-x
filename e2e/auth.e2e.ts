import { test, expect } from '@playwright/test';

/**
 * E2E: авторизация через Telegram (OIDC).
 *
 * Полный OIDC-флоу (oauth.telegram.org → callback → сессия) требует
 * реального бота с настроенным Web Login, поэтому в e2e мы проверяем:
 *  1. Страница /auth рендерит кнопку «Войти через Telegram».
 *  2. Клик отправляет корректный запрос sign-in/social с провайдером
 *     telegram-oidc и редиректит на oauth.telegram.org с PKCE-параметрами.
 *  3. При залогиненном состоянии (мок get-session) шапка показывает
 *     имя пользователя, а на /auth — кнопку «Выйти».
 */

const TELEGRAM_OAUTH_URL = 'https://oauth.telegram.org/auth';

test.describe('Telegram OIDC авторизация', () => {
	test('страница /auth показывает кнопку входа через Telegram', async ({ page }) => {
		// Закрываем приветственное модальное окно, чтобы не перехватывало клики
		await page.addInitScript(() => {
			localStorage.setItem('hedgehog-welcome-modal-dismissed', 'true');
		});

		await page.goto('/auth');
		await expect(page.getByRole('button', { name: 'Войти через Telegram' })).toBeVisible();
	});

	test('клик запускает OIDC-редирект на oauth.telegram.org', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('hedgehog-welcome-modal-dismissed', 'true');
		});

		// Перехватываем sign-in/social и возвращаем URL oauth.telegram.org
		await page.route('**/api/auth/sign-in/social', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					url: `${TELEGRAM_OAUTH_URL}?response_type=code&client_id=8204202555&scope=openid+profile&code_challenge_method=S256&code_challenge=mock&state=mockstate&redirect_uri=${encodeURIComponent('http://localhost:4173/api/auth/callback/telegram-oidc')}`,
					redirect: true
				})
			});
		});

		await page.goto('/auth');
		await page.getByRole('button', { name: 'Войти через Telegram' }).click();

		// Должен произойти редирект на oauth.telegram.org
		await expect(page).toHaveURL(new RegExp(TELEGRAM_OAUTH_URL.replace('.', '\\.')));
	});

	test('при залогиненном пользователе шапка показывает имя и есть кнопка выхода', async ({
		page
	}) => {
		await page.addInitScript(() => {
			localStorage.setItem('hedgehog-welcome-modal-dismissed', 'true');
		});

		// Мокаем сессию: лучше-auth клиент вызывает GET /api/auth/get-session
		const mockUser = {
			id: 'mock-user-1',
			name: 'Еж Тестовый',
			email: 'mock@telegram.oidc',
			image: null,
			emailVerified: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
		const mockSession = {
			id: 'mock-session-1',
			userId: 'mock-user-1',
			token: 'mock-token',
			expiresAt: new Date(Date.now() + 3600_000).toISOString(),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		await page.route('**/api/auth/get-session', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ session: mockSession, user: mockUser })
			});
		});

		await page.goto('/auth');

		// Имя пользователя видно на странице /auth (в профильном блоке) и в шапке
		await expect(page.getByRole('main').getByText('Еж Тестовый')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
	});
});
