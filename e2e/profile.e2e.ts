import { test, expect } from './fixtures/test';
import { BASE_URL } from './config';
import {
	MOCK_SESSION,
	MOCK_USER,
	DISCORD_ACCOUNT,
	TELEGRAM_ACCOUNT,
	type MockLinkedAccount
} from './fixtures/data';
import { mockGetSession, mockListAccounts } from './fixtures/mocks';

/**
 * E2E: страница профиля и управление способами входа.
 *
 * Тесты мокают сессию (get-session) и API аккаунтов (list-accounts,
 * unlink-account), т.к. реальные OAuth-провайдеры требуют регистрации
 * приложений и реальных учёток.
 *
 * Базовая сессия (get-session) приходит из фикстуры `loggedIn`; где нужен
 * кастомный user (аватар/username провайдера), get-session переопределяется
 * в теле теста — последний зарегистрированный page.route побеждает.
 */

/** Мок списка способов входа для залогиненного теста. */
async function mockLoggedInAccounts(
	page: import('@playwright/test').Page,
	accounts: MockLinkedAccount[]
) {
	await mockListAccounts(page, accounts);
}

test.describe('Страница профиля: способы входа', () => {
	test.describe('авторизованный пользователь', () => {
		test.beforeEach(async ({ loggedIn }) => {
			void loggedIn;
		});

		test('показывает ID, имя и ID Telegram-аккаунта', async ({ page }) => {
			await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);
			await page.goto('/profile');

			await expect(page.getByText('Мой аккаунт')).toBeVisible();
			await expect(page.getByText(MOCK_USER.id)).toBeVisible();
			await expect(page.getByText(MOCK_USER.name).first()).toBeVisible();
			// ID способа входа: «ID 123456789»
			await expect(page.getByText(`ID ${TELEGRAM_ACCOUNT.accountId}`)).toBeVisible();
		});

		test('показывает аватар платформы в строке способа входа', async ({ page }) => {
			const userWithAvatar = {
				...MOCK_USER,
				telegramAvatar: 'https://t.me/i/userpic/320/hedgehog_test.jpg'
			};
			await mockGetSession(page, { user: userWithAvatar, session: MOCK_SESSION });
			await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);
			await page.goto('/profile');

			// В строке Telegram вместо иконки — <img> с аватаром Telegram
			const telegramRow = page.locator('div.rounded-xl.border').filter({ hasText: 'Telegram' });
			const avatarImg = telegramRow.locator('img');
			await expect(avatarImg).toBeVisible();
			await expect(avatarImg).toHaveAttribute('src', userWithAvatar.telegramAvatar);
		});

		test('показывает username способа входа, если он есть', async ({ page }) => {
			const userWithUsername = {
				...MOCK_USER,
				telegramOidcUsername: 'hedgehog_test'
			};
			await mockGetSession(page, { user: userWithUsername, session: MOCK_SESSION });
			await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);
			await page.goto('/profile');

			await expect(page.getByText('@hedgehog_test · ID 123456789')).toBeVisible();
		});

		test('если аватара нет, показывает первую букву username (фолбэк)', async ({ page }) => {
			const userWithUsername = {
				...MOCK_USER,
				telegramOidcUsername: 'hedgehog_test'
			};
			await mockGetSession(page, { user: userWithUsername, session: MOCK_SESSION });
			await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);
			await page.goto('/profile');

			// В строке Telegram вместо иконки/картинки — кружок с первой буквой username
			const telegramRow = page.locator('div.rounded-xl.border').filter({ hasText: 'Telegram' });
			await expect(telegramRow.getByText('H', { exact: true })).toBeVisible();
		});

		test('если username нет, показывает first name из имени пользователя', async ({ page }) => {
			const userNoUsername = {
				...MOCK_USER,
				name: 'Еж Иванов',
				telegramOidcUsername: null,
				image: null
			};
			await mockGetSession(page, { user: userNoUsername, session: MOCK_SESSION });
			await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);
			await page.goto('/profile');

			// Фолбэк имени: «Еж · ID 123456789»
			await expect(page.getByText('Еж · ID 123456789')).toBeVisible();
		});

		test('единственный способ входа нельзя отвязать (кнопка отключена)', async ({ page }) => {
			await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);
			await page.goto('/profile');

			// Рядом с Telegram — кнопка «Отвязать» (заблокирована, т.к. способ последний)
			const telegramRow = page.locator('div.rounded-xl.border').filter({ hasText: 'Telegram' });
			await expect(telegramRow.getByRole('button', { name: 'Отвязать' })).toBeDisabled();
			// Discord не привязан — доступна кнопка «Привязать»
			const discordRow = page.locator('div.rounded-xl.border').filter({ hasText: 'Discord' });
			await expect(discordRow.getByRole('button', { name: 'Привязать' })).toBeEnabled();
		});

		test('при нескольких способах виден ID Discord и можно отвязать', async ({ page }) => {
			await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT, DISCORD_ACCOUNT]);

			// Отвязка Discord через API. Проверяем, что accountId — внешний ID
			// провайдера (account.accountId), а НЕ внутренний id записи (acc-dc-1).
			// Раньше клиент отправлял внутренний id → сервер отвечал
			// «Account not found» (ACCOUNT_NOT_FOUND).
			await page.route('**/api/auth/unlink-account', async (route) => {
				const body = (route.request().postDataJSON() ?? {}) as {
					providerId?: string;
					accountId?: string;
				};
				expect(body.providerId).toBe('discord');
				expect(body.accountId).toBe(DISCORD_ACCOUNT.accountId);
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ status: true })
				});
			});

			await page.goto('/profile');

			// ID Discord способа входа
			await expect(page.getByText(`ID ${DISCORD_ACCOUNT.accountId}`)).toBeVisible();
			// ID Telegram способа входа
			await expect(page.getByText(`ID ${TELEGRAM_ACCOUNT.accountId}`)).toBeVisible();

			const discordRow = page.locator('div.rounded-xl.border').filter({ hasText: 'Discord' });
			await expect(discordRow.getByRole('button', { name: 'Отвязать' })).toBeEnabled();

			// Отвязка требует подтверждения в модалке
			await discordRow.getByRole('button', { name: 'Отвязать' }).click();
			const dialog = page.getByRole('dialog');
			await expect(dialog).toContainText('Отвязать Discord?');
			await dialog.getByRole('button', { name: 'Отвязать' }).click();

			// После отвязки Discord помечается как доступный для привязки
			await expect(discordRow.getByRole('button', { name: 'Привязать' })).toBeVisible();
		});

		test('привязка Discord вызывает /link-social с правильным провайдером', async ({ page }) => {
			await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);

			await page.route('**/api/auth/link-social', async (route) => {
				const body = (route.request().postDataJSON() ?? {}) as { provider?: string };
				expect(body.provider).toBe('discord');
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						url: `https://discord.com/api/oauth2/authorize?response_type=code&client_id=1463632713943748925&redirect_uri=${encodeURIComponent(new URL('/api/auth/callback/discord', BASE_URL).href)}`,
						redirect: true,
						status: true
					})
				});
			});

			await page.goto('/profile');

			const discordRow = page.locator('div.rounded-xl.border').filter({ hasText: 'Discord' });
			await discordRow.getByRole('button', { name: 'Привязать' }).click();

			await expect(page).toHaveURL(/discord.com/);
		});
	});

	test.describe('гость', () => {
		test.beforeEach(async ({ guest }) => {
			void guest;
		});

		test('когда пользователь не авторизован — редирект на страницу входа', async ({ page }) => {
			await page.goto('/profile');
			// Уводим на /auth с параметром from=/profile, чтобы после входа вернуться
			await expect(page).toHaveURL(/\/auth\?from=/);
			await expect(page.getByText('Вход в аккаунт')).toBeVisible();
		});
	});
});

test.describe('Страница профиля: удаление аккаунта', () => {
	test.beforeEach(async ({ loggedIn }) => {
		void loggedIn;
	});

	test('удаление требует четырёхступенчатого подтверждения и вызывает API', async ({ page }) => {
		await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);

		let deleteCalled = 0;
		await page.route('**/api/user/delete', async (route) => {
			deleteCalled += 1;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true })
			});
		});

		await page.goto('/profile');

		// Кнопка в опасной зоне
		await page.getByRole('button', { name: 'Удалить аккаунт' }).click();

		// Модалка, шаг 1: заголовок «Удалить аккаунт»
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText('Удалить аккаунт');
		// Кнопка подтверждения на шаге 1 — «Удалить аккаунт» (дублирует заголовок)
		await dialog.getByRole('button', { name: 'Удалить аккаунт' }).last().click();

		// Шаг 2: «Точно удалить?»
		await expect(dialog).toContainText('Точно удалить?');
		await dialog.getByRole('button', { name: 'Точно удалить?' }).click();

		// Шаг 3: «Да, удалить навсегда»
		await expect(dialog).toContainText('Да, удалить навсегда');
		await dialog.getByRole('button', { name: 'Да, удалить навсегда' }).click();

		// Шаг 4 (финальный): «Удалить безвозвратно» — отправляет запрос
		await expect(dialog).toContainText('Удалить безвозвратно');
		await dialog.getByRole('button', { name: 'Удалить безвозвратно' }).click();

		await expect.poll(() => deleteCalled).toBe(1);
	});

	test('кнопка «отмена» закрывает модалку без удаления', async ({ page }) => {
		await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);

		let deleteCalled = 0;
		await page.route('**/api/user/delete', async (route) => {
			deleteCalled += 1;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true })
			});
		});

		await page.goto('/profile');

		await page.getByRole('button', { name: 'Удалить аккаунт' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		// Любая из трёх «отмен» (в перемешанном порядке) закрывает окно
		// без вызова delete API. Тексты отмен берутся из пула.
		const cancelButton = dialog.getByRole('button', {
			name: /Не надо|Передумал|Оставить аккаунт|Вернуться|Отмена/
		});
		await cancelButton.first().click();
		await expect(dialog).not.toBeVisible();
		await expect.poll(() => deleteCalled).toBe(0);
	});

	test('закрытие кликом по оверлею позволяет открыть модалку снова', async ({ page }) => {
		await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);

		let deleteCalled = 0;
		await page.route('**/api/user/delete', async (route) => {
			deleteCalled += 1;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true })
			});
		});

		await page.goto('/profile');

		// Открываем модалку удаления
		await page.getByRole('button', { name: 'Удалить аккаунт' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		// Закрываем кликом по оверлею (затемняющий фон вне модалки)
		await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 5, y: 5 } });
		await expect(dialog).not.toBeVisible();

		// Повторно открываем — модалка должна появиться снова (баг: требовалась перезагрузка)
		await page.getByRole('button', { name: 'Удалить аккаунт' }).click();
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText('Удалить аккаунт');

		// Закрываем и убеждаемся, что delete API не вызывался
		await dialog
			.getByRole('button', { name: /Не надо|Передумал|Оставить аккаунт|Вернуться|Отмена/ })
			.first()
			.click();
		await expect(dialog).not.toBeVisible();
		await expect.poll(() => deleteCalled).toBe(0);
	});

	test('кнопка подтверждения каждый раз на новом месте (4 шага)', async ({ page }) => {
		await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);

		let deleteCalled = 0;
		await page.route('**/api/user/delete', async (route) => {
			deleteCalled += 1;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true })
			});
		});

		await page.goto('/profile');
		await page.getByRole('button', { name: 'Удалить аккаунт' }).click();
		const dialog = page.getByRole('dialog');

		// Тексты подтверждения по шагам (в порядке появления в модалке).
		const confirmLabels = [
			'Удалить аккаунт',
			'Точно удалить?',
			'Да, удалить навсегда',
			'Удалить безвозвратно'
		];

		/** Индекс позиции кнопки с данным текстом среди ВСЕХ 4 кнопок модалки. */
		async function confirmPosition(label: string): Promise<number> {
			const texts = await dialog
				.locator('button')
				.allTextContents()
				.then((all) => all.map((t) => t.trim()).filter((t) => t !== '' && t !== 'Удаление…'));
			expect(texts).toHaveLength(4);
			const idx = texts.indexOf(label);
			expect(idx).toBeGreaterThanOrEqual(0);
			return idx;
		}

		// Проходим все 4 шага: на каждом подтверждение должно быть НЕ там,
		// где на предыдущем шаге (гарантия «нового места»).
		const positions: number[] = [];
		for (let step = 0; step < confirmLabels.length; step++) {
			const label = confirmLabels[step];
			const pos = await confirmPosition(label);
			positions.push(pos);
			if (positions.length > 1) {
				expect(pos).not.toBe(positions[positions.length - 2]);
			}
			if (step < confirmLabels.length - 1) {
				await dialog.getByRole('button', { name: label }).click();
				await expect(dialog).toContainText(confirmLabels[step + 1]);
			}
		}

		// На последнем шаге нажимаем подтверждение — реальное удаление.
		await dialog.getByRole('button', { name: 'Удалить безвозвратно' }).click();
		await expect.poll(() => deleteCalled).toBe(1);
	});

	test('после удаления аккаунта пользователь переходит на главную', async ({ page }) => {
		await mockLoggedInAccounts(page, [TELEGRAM_ACCOUNT]);

		await page.route('**/api/user/delete', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true })
			});
		});

		await page.goto('/profile');

		await page.getByRole('button', { name: 'Удалить аккаунт' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByRole('button', { name: 'Удалить аккаунт' }).last().click();
		await dialog.getByRole('button', { name: 'Точно удалить?' }).click();
		await dialog.getByRole('button', { name: 'Да, удалить навсегда' }).click();
		await dialog.getByRole('button', { name: 'Удалить безвозвратно' }).click();

		// После удаления — редирект на главную
		await expect(page).toHaveURL('/');
	});
});
