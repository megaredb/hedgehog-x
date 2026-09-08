/**
 * E2E: «Вход через Boosty» (телефон + SMS-код) — новый стиль:
 *  - page-object BoostyPage (e2e/boosty/boosty.page.ts) для модалки: кастомный
 *    select страны, поле телефона, кнопка «Получить код», автоподтверждение кода;
 *  - секция подписки на /profile проверяется через общий ProfilePage
 *    (e2e/profile/profile.page.ts), чтобы не дублировать локаторы подписки.
 *
 * Покрытие перенесено из старого плоского e2e/boosty-login.e2e.ts (удалён) без
 * потери ни одного ассерта. Реальная отправка SMS/подтверждение не выполняются:
 * API /api/boosty/{phone-codes,send-code,confirm-code,subscription} мокаются.
 */

import { test, expect } from '../fixtures/test';
import { mockBoosty, mockListAccounts, mockBoostySubscription } from '../fixtures/mocks';
import { BOOSTY_ACCOUNT } from '../fixtures/data';
import { BoostyPage } from './boosty.page';
import { ProfilePage } from '../profile/profile.page';

/** Россия выбрана по умолчанию (dialCode +7). */
const RU_DIAL = '+7';
/** Украина — dialCode +380 (для ветки смены страны). */
const UA_DIAL = '+380';
/** Национальный номер RU без кода страны (конкатенируется компонентом). */
const RU_PHONE = '9999999999';

test.describe('Вход через Boosty (телефон + SMS)', () => {
	// Гость: get-session → null (страница входа доступна без сессии).
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	/** Открыть модалку входа Boosty (общий шаг — см. BoostyPage.openFromAuth). */
	async function openBoosty(page: import('@playwright/test').Page): Promise<BoostyPage> {
		const boosty = new BoostyPage(page);
		await boosty.openFromAuth();
		return boosty;
	}

	test('кастомный select: Россия выбрана по умолчанию, русское название и флаг', async ({
		page
	}) => {
		await mockBoosty(page);
		const boosty = await openBoosty(page);
		const dialog = boosty.dialog;
		await expect(dialog).toContainText('Вход через Boosty');

		// Триггер select показывает 🇷🇺 +7 Россия (русское название).
		const trigger = boosty.countryTrigger(RU_DIAL);
		await expect(trigger).toBeVisible();
		await expect(trigger).toContainText('Россия');

		// Открываем список, ищем по-русски.
		await trigger.click();
		const search = boosty.countrySearch;
		await expect(search).toBeVisible();
		await search.fill('Укра');
		await expect(boosty.countryOption('Украина')).toBeVisible();
		await boosty.countryOption('Украина').click();
		await expect(boosty.countryTrigger(UA_DIAL)).toBeVisible();
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
		const boosty = await openBoosty(page);
		// Россия по умолчанию (+7): вводим национальный номер без кода страны
		// (компонент сам конкатенирует dialCode + номер: dial + digits).
		const phoneInput = boosty.phoneInput;
		await expect(phoneInput).toBeEnabled();
		await phoneInput.fill(RU_PHONE);
		await boosty.getCodeButton.click();

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
		const boosty = await openBoosty(page);
		await boosty.selectCountry(RU_DIAL, 'Укра', 'Украина');
		await boosty.phoneInput.fill('501234567');
		await boosty.sendCode();
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
		const boosty = await openBoosty(page);
		await boosty.phoneInput.fill(RU_PHONE);
		await boosty.sendCode();

		const codeInput = boosty.codeInput;
		await expect(codeInput).toBeVisible();
		// Фокус сразу на поле кода.
		await expect(codeInput).toBeFocused();
		// Кнопки «Войти через Boosty» на шаге кода нет.
		await expect(boosty.dialog.getByRole('button', { name: /Войти через Boosty/i })).toHaveCount(0);

		await codeInput.fill('123456');
		await expect.poll(() => confirmCount).toBe(1);
		const b = confirmBody as { smsCode?: string; phone?: string; deviceId?: string };
		expect(b.smsCode).toBe('123456');
		expect(b.phone).toBe('+79999999999');
	});

	test('неверный код: сообщение об ошибке и поле можно ввести заново', async ({ page }) => {
		await mockBoosty(page, { confirmStatus: 400, confirmError: 'invalid_code' });
		const boosty = await openBoosty(page);
		await boosty.phoneInput.fill(RU_PHONE);
		await boosty.sendCode();

		const codeInput = boosty.codeInput;
		await expect(codeInput).toBeVisible();
		await codeInput.fill('000000');
		// Ошибка: текст + поле красное (destructive) + фокус снова на поле.
		await expect(boosty.dialog).toContainText('не подошёл');
		await expect(codeInput).toBeFocused();
	});
});

test.describe('Подписка HEDGEHOG.INC в Boosty', () => {
	// Залогинен: get-session → MOCK_USER + MOCK_SESSION.
	test.beforeEach(async ({ loggedIn }) => {
		void loggedIn;
	});

	test('на /profile показывается активная подписка (название, цена)', async ({ page }) => {
		await mockListAccounts(page, [BOOSTY_ACCOUNT]);
		await mockBoostySubscription(page, {
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
		});
		const profile = new ProfilePage(page);
		await profile.goto();
		await expect(profile.subscription).toBeVisible();
		await expect(profile.subscription).toContainText('ПОВЕЛИТЕЛЬ!');
		await expect(profile.subscription).toContainText('2 000');
	});
});
