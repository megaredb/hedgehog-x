import { test, expect } from '@playwright/test';

/**
 * E2E: «Вход через Boosty» (телефон + SMS-код).
 *
 * Реальная отправка SMS и подтверждение требуют живой учётки Boosty — в e2e
 * мокаем /api/boosty/{phone-codes,send-code,confirm-code,subscription} и
 * проверяем UI-флоу: кастомный select страны (поиск, русские названия),
 * авто-подтверждение 6-значного кода, ошибка неверного кода, подписка.
 */

const PHONE_CODES = [
	{ name: 'Russia', dialCode: '+7', code: 'RU', mask: '(XXX) XXX-XX-XX' },
	{ name: 'Kazakhstan', dialCode: '+7', code: 'KZ' },
	{ name: 'Ukraine', dialCode: '+380', code: 'UA' }
];

async function mockBoostyApis(
	page: import('@playwright/test').Page,
	opts: { confirmStatus?: number; confirmError?: string } = {}
) {
	await page.route('**/api/boosty/phone-codes', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ phoneCodes: PHONE_CODES })
		});
	});
	await page.route('**/api/boosty/send-code', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				ok: true,
				deviceId: 'device-123',
				verifyToken: 'verify-token-123',
				sentTransport: 'gate'
			})
		});
	});
	await page.route('**/api/boosty/confirm-code', async (route) => {
		const body = route.request().postDataJSON() as Record<string, unknown>;
		if (opts.confirmStatus && opts.confirmStatus >= 400) {
			await route.fulfill({
				status: opts.confirmStatus,
				contentType: 'application/json',
				body: JSON.stringify({ error: opts.confirmError ?? 'Code is invalid' })
			});
			return;
		}
		expect(body.smsCode).toBe('123456');
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				ok: true,
				user: { id: 'user-boosty', name: 'Boosty-пользователь', image: null }
			})
		});
	});
}

test.describe('Вход через Boosty (телефон + SMS)', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('hedgehog-welcome-modal-dismissed', 'true');
		});
		await page.route('**/api/auth/get-session', async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
		});
	});

	async function openDialog(page: import('@playwright/test').Page) {
		await page.goto('/auth');
		const btn = page.getByRole('button', { name: /Войти через Boosty/i });
		await expect(btn).toBeVisible();
		await btn.click();
		return page.getByRole('dialog');
	}

	test('кастомный select: Россия выбрана по умолчанию, русское название и флаг', async ({
		page
	}) => {
		await mockBoostyApis(page);
		const dialog = await openDialog(page);
		await expect(dialog).toContainText('Вход через Boosty');

		// Триггер select показывает 🇷🇺 +7 Россия (русское название).
		const trigger = dialog.getByRole('button', { name: /+7/ });
		await expect(trigger).toBeVisible();
		await expect(trigger).toContainText('Россия');

		// Открываем список, ищем по-русски.
		await trigger.click();
		const search = dialog.getByPlaceholder('Поиск страны…');
		await expect(search).toBeVisible();
		await search.fill('Укра');
		await expect(dialog.getByRole('option', { name: /Украина/ })).toBeVisible();
		await dialog.getByRole('option', { name: /Украина/ }).click();
		await expect(dialog.getByRole('button', { name: /\+380/ })).toBeVisible();
	});

	test('полный номер (код страны + номер) уходит в send-code', async ({ page }) => {
		await mockBoostyApis(page);
		let sentPhone = '';
		await page.route('**/api/boosty/send-code', async (route) => {
			sentPhone = (route.request().postDataJSON() as { phone?: string }).phone ?? '';
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true, deviceId: 'd1', verifyToken: 'v1', sentTransport: 'gate' })
			});
		});
		const dialog = await openDialog(page);
		// Россия по умолчанию (+7): вводим национальный номер.
		const phoneInput = dialog.locator('#boosty-phone');
		await expect(phoneInput).toBeEnabled();
		await phoneInput.fill('79999999999');
		await dialog.getByRole('button', { name: 'Получить код' }).click();

		await expect.poll(() => sentPhone).not.toBe('');
		expect(sentPhone).toBe('+79999999999');
	});

	test('смена страны на Украину меняет код (+380)', async ({ page }) => {
		await mockBoostyApis(page);
		let sentPhone = '';
		await page.route('**/api/boosty/send-code', async (route) => {
			sentPhone = (route.request().postDataJSON() as { phone?: string }).phone ?? '';
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true, deviceId: 'd1', verifyToken: 'v1', sentTransport: 'gate' })
			});
		});
		const dialog = await openDialog(page);
		const trigger = dialog.getByRole('button', { name: /\+7/ });
		await trigger.click();
		const search = dialog.getByPlaceholder('Поиск страны…');
		await search.fill('Укра');
		await dialog.getByRole('option', { name: /Украина/ }).click();
		await dialog.locator('#boosty-phone').fill('501234567');
		await dialog.getByRole('button', { name: 'Получить код' }).click();
		await expect.poll(() => sentPhone).not.toBe('');
		expect(sentPhone).toBe('+380501234567');
	});

	test('код подтверждается автоматически после 6 цифр (без кнопки)', async ({ page }) => {
		await mockBoostyApis(page);
		let confirmBody: unknown = null;
		let confirmCount = 0;
		await page.route('**/api/boosty/confirm-code', async (route) => {
			confirmBody = route.request().postDataJSON();
			confirmCount += 1;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true, user: { id: 'u1', name: 'Boosty', image: null } })
			});
		});
		const dialog = await openDialog(page);
		await dialog.locator('#boosty-phone').fill('9999999999');
		await dialog.getByRole('button', { name: 'Получить код' }).click();

		const codeInput = dialog.locator('input[inputmode="numeric"]');
		await expect(codeInput).toBeVisible();
		// Фокус сразу на поле кода.
		await expect(codeInput).toBeFocused();
		// Кнопки «Войти через Boosty» на шаге кода нет.
		await expect(dialog.getByRole('button', { name: /Войти через Boosty/i })).toHaveCount(0);

		await codeInput.fill('123456');
		await expect.poll(() => confirmCount).toBe(1);
		const b = confirmBody as { smsCode?: string; phone?: string; deviceId?: string };
		expect(b.smsCode).toBe('123456');
		expect(b.phone).toBe('+79999999999');
	});

	test('неверный код: сообщение об ошибке и поле можно ввести заново', async ({ page }) => {
		await mockBoostyApis(page, { confirmStatus: 400, confirmError: 'invalid_code' });
		const dialog = await openDialog(page);
		await dialog.locator('#boosty-phone').fill('9999999999');
		await dialog.getByRole('button', { name: 'Получить код' }).click();

		const codeInput = dialog.locator('input[inputmode="numeric"]');
		await expect(codeInput).toBeVisible();
		await codeInput.fill('000000');
		// Ошибка: текст + поле красное (destructive) + фокус снова на поле.
		await expect(dialog).toContainText('не подошёл');
		await expect(codeInput).toBeFocused();
	});
});

test.describe('Подписка HEDGEHOG.INC в Boosty', () => {
	test('на /profile показывается активная подписка (название, цена, дата)', async ({ page }) => {
		const mockUser = {
			id: 'user-1',
			name: 'Рамазан',
			email: 'boosty-test@boosty.local',
			image: null,
			emailVerified: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
		const mockSession = {
			id: 's1',
			userId: 'user-1',
			token: 't1',
			expiresAt: new Date(Date.now() + 3600_000).toISOString(),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
		await page.addInitScript(() => {
			localStorage.setItem('hedgehog-welcome-modal-dismissed', 'true');
		});
		await page.route('**/api/auth/get-session', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ session: mockSession, user: mockUser })
			});
		});
		await page.route('**/api/auth/list-accounts', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						id: 'a1',
						providerId: 'boosty',
						accountId: 'boosty:abc',
						userId: 'user-1',
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString()
					}
				])
			});
		});
		await page.route('**/api/boosty/subscription', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					linked: true,
					subscribed: true,
					levelName: 'ПОВЕЛИТЕЛЬ!',
					priceRub: 2000,
					periodMonths: 1,
					nextPayTime: 1790878023,
					onTime: 1788286023,
					isFeePaid: true,
					isPaused: false,
					error: null
				})
			});
		});
		await page.goto('/profile');
		const section = page.getByText('Подписка HEDGEHOG.INC');
		await expect(section).toBeVisible();
		await expect(page).toContainText('ПОВЕЛИТЕЛЬ!');
		await expect(page).toContainText('2 000');
	});
});
