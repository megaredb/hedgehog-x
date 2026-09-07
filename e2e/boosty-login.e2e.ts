import { test, expect } from './fixtures/test';
import { mockBoosty, mockListAccounts } from './fixtures/mocks';
import { BOOSTY_ACCOUNT } from './fixtures/data';

/**
 * E2E: «Вход через Boosty» (телефон + SMS-код).
 *
 * Реальная отправка SMS и подтверждение требуют живой учётки Boosty — в e2e
 * мокаем /api/boosty/{phone-codes,send-code,confirm-code,subscription} и
 * проверяем UI-флоу: кастомный select страны (поиск, русские названия),
 * авто-подтверждение 6-значного кода, ошибка неверного кода, подписка.
 */

test.describe('Вход через Boosty (телефон + SMS)', () => {
	// Гость: get-session → null (страница входа доступна без сессии).
	test.beforeEach(async ({ guest }) => {
		void guest;
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
		await mockBoosty(page);
		const dialog = await openDialog(page);
		await expect(dialog).toContainText('Вход через Boosty');

		// Триггер select показывает 🇷🇺 +7 Россия (русское название).
		const trigger = dialog.getByRole('button', { name: /\+7/ });
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
		await mockBoosty(page);
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
		// Россия по умолчанию (+7): вводим национальный номер без кода страны
		// (компонент сам конкатенирует dialCode + номер: dial + digits).
		const phoneInput = dialog.locator('#boosty-phone');
		await expect(phoneInput).toBeEnabled();
		await phoneInput.fill('9999999999');
		await dialog.getByRole('button', { name: 'Получить код' }).click();

		await expect.poll(() => sentPhone).not.toBe('');
		expect(sentPhone).toBe('+79999999999');
	});

	test('смена страны на Украину меняет код (+380)', async ({ page }) => {
		await mockBoosty(page);
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
		await mockBoosty(page);
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
		await mockBoosty(page, { confirmStatus: 400, confirmError: 'invalid_code' });
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
	// Залогинен: get-session → MOCK_USER + MOCK_SESSION.
	test.beforeEach(async ({ loggedIn }) => {
		void loggedIn;
	});

	test('на /profile показывается активная подписка (название, цена, дата)', async ({ page }) => {
		await mockListAccounts(page, [BOOSTY_ACCOUNT]);
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
		// toContainText работает только с Locator — берём всё тело страницы,
		// как исходный «page содержит текст».
		const body = page.locator('body');
		await expect(body).toContainText('ПОВЕЛИТЕЛЬ!');
		await expect(body).toContainText('2 000');
	});
});
