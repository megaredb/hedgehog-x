import { test, expect } from '@playwright/test';

/**
 * E2E: страница профиля и управление способами входа.
 *
 * Тесты мокают сессию (get-session) и API аккаунтов (list-accounts,
 * unlink-account), т.к. реальные OAuth-провайдеры требуют регистрации
 * приложений и реальных учёток.
 */

const mockUser = {
	id: 'user-123',
	name: 'Еж Тестовый',
	email: '123456@telegram.oidc',
	image: null,
	emailVerified: false,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString()
};

const mockSession = {
	id: 'session-1',
	userId: 'user-123',
	token: 'mock-token',
	expiresAt: new Date(Date.now() + 3600_000).toISOString(),
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString()
};

async function mockLoggedIn(
	page: import('@playwright/test').Page,
	accounts: unknown[],
	user = mockUser
) {
	await page.addInitScript(() => {
		localStorage.setItem('hedgehog-welcome-modal-dismissed', 'true');
	});
	await page.route('**/api/auth/get-session', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ session: mockSession, user })
		});
	});
	await page.route('**/api/auth/list-accounts', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(accounts)
		});
	});
}

const telegramAccount = {
	id: 'acc-tg-1',
	providerId: 'telegram-oidc',
	accountId: '123456789',
	userId: 'user-123',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	scopes: ['openid', 'profile']
};

const discordAccount = {
	id: 'acc-dc-1',
	providerId: 'discord',
	accountId: '987654321',
	userId: 'user-123',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	scopes: ['identify', 'email']
};

test.describe('Страница профиля: способы входа', () => {
	test('показывает ID, имя и ID Telegram-аккаунта', async ({ page }) => {
		await mockLoggedIn(page, [telegramAccount]);
		await page.goto('/profile');

		await expect(page.getByText('Мой аккаунт')).toBeVisible();
		await expect(page.getByText('user-123')).toBeVisible();
		await expect(page.getByText('Еж Тестовый').first()).toBeVisible();
		// ID способа входа: «ID 123456789»
		await expect(page.getByText('ID 123456789')).toBeVisible();
	});

	test('показывает аватар платформы в строке способа входа', async ({ page }) => {
		const userWithAvatar = {
			...mockUser,
			telegramAvatar: 'https://t.me/i/userpic/320/hedgehog_test.jpg'
		};
		await mockLoggedIn(page, [telegramAccount], userWithAvatar);
		await page.goto('/profile');

		// В строке Telegram вместо иконки — <img> с аватаром Telegram
		const telegramRow = page.locator('div.rounded-xl.border').filter({ hasText: 'Telegram' });
		const avatarImg = telegramRow.locator('img');
		await expect(avatarImg).toBeVisible();
		await expect(avatarImg).toHaveAttribute('src', userWithAvatar.telegramAvatar);
	});

	test('показывает username способа входа, если он есть', async ({ page }) => {
		const userWithUsername = {
			...mockUser,
			telegramOidcUsername: 'hedgehog_test'
		};
		await mockLoggedIn(page, [telegramAccount], userWithUsername);
		await page.goto('/profile');

		await expect(page.getByText('@hedgehog_test · ID 123456789')).toBeVisible();
	});

	test('если аватара нет, показывает первую букву username (фолбэк)', async ({ page }) => {
		const userWithUsername = {
			...mockUser,
			telegramOidcUsername: 'hedgehog_test'
		};
		await mockLoggedIn(page, [telegramAccount], userWithUsername);
		await page.goto('/profile');

		// В строке Telegram вместо иконки/картинки — кружок с первой буквой username
		const telegramRow = page.locator('div.rounded-xl.border').filter({ hasText: 'Telegram' });
		await expect(telegramRow.getByText('H', { exact: true })).toBeVisible();
	});

	test('если username нет, показывает first name из имени пользователя', async ({ page }) => {
		const userNoUsername = {
			...mockUser,
			name: 'Еж Иванов',
			telegramOidcUsername: null,
			image: null
		};
		await mockLoggedIn(page, [telegramAccount], userNoUsername);
		await page.goto('/profile');

		// Фолбэк имени: «Еж · ID 123456789»
		await expect(page.getByText('Еж · ID 123456789')).toBeVisible();
	});

	test('единственный способ входа нельзя отвязать (кнопка отключена)', async ({ page }) => {
		await mockLoggedIn(page, [telegramAccount]);
		await page.goto('/profile');

		// Рядом с Telegram — кнопка «Отвязать» (заблокирована, т.к. способ последний)
		const telegramRow = page.locator('div.rounded-xl.border').filter({ hasText: 'Telegram' });
		await expect(telegramRow.getByRole('button', { name: 'Отвязать' })).toBeDisabled();
		// Discord не привязан — доступна кнопка «Привязать»
		const discordRow = page.locator('div.rounded-xl.border').filter({ hasText: 'Discord' });
		await expect(discordRow.getByRole('button', { name: 'Привязать' })).toBeEnabled();
	});

	test('при нескольких способах виден ID Discord и можно отвязать', async ({ page }) => {
		await mockLoggedIn(page, [telegramAccount, discordAccount]);

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
			expect(body.accountId).toBe('987654321');
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ status: true })
			});
		});

		await page.goto('/profile');

		// ID Discord способа входа
		await expect(page.getByText('ID 987654321')).toBeVisible();
		// ID Telegram способа входа
		await expect(page.getByText('ID 123456789')).toBeVisible();

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
		await mockLoggedIn(page, [telegramAccount]);

		await page.route('**/api/auth/link-social', async (route) => {
			const body = (route.request().postDataJSON() ?? {}) as { provider?: string };
			expect(body.provider).toBe('discord');
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					url: 'https://discord.com/api/oauth2/authorize?response_type=code&client_id=1463632713943748925&redirect_uri=http%3A%2F%2Flocalhost%3A4173%2Fapi%2Fauth%2Fcallback%2Fdiscord',
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

	test('когда пользователь не авторизован — редирект на страницу входа', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('hedgehog-welcome-modal-dismissed', 'true');
		});
		await page.route('**/api/auth/get-session', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ session: null, user: null })
			});
		});

		await page.goto('/profile');
		// Уводим на /auth с параметром from=/profile, чтобы после входа вернуться
		await expect(page).toHaveURL(/\/auth\?from=/);
		await expect(page.getByText('Вход в аккаунт')).toBeVisible();
	});
});

test.describe('Страница профиля: удаление аккаунта', () => {
	test('удаление требует четырёхступенчатого подтверждения и вызывает API', async ({ page }) => {
		await mockLoggedIn(page, [telegramAccount]);

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
		await mockLoggedIn(page, [telegramAccount]);

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
		await mockLoggedIn(page, [telegramAccount]);

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
		await mockLoggedIn(page, [telegramAccount]);

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
		await mockLoggedIn(page, [telegramAccount]);

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
		await expect(page).toHaveURL(/localhost:4173\//);
	});
});
