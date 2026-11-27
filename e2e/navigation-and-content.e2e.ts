import { test, expect } from '@playwright/test';

test.describe('Навигация и новые разделы сайта (PWA)', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {});
	});

	test('страница /community отображает социальные сети и преимущества', async ({ page }) => {
		await page.goto('/community');
		await expect(page.getByRole('heading', { name: 'Сообщество' })).toBeVisible();
		await expect(page.getByText('Хотите узнать больше об авторе?')).toBeVisible();

		// Проверка ссылок на соцсети (тексты карточек меняются, href устойчивее).
		await expect(page.locator('a[href="https://vk.com/hedgehoginc"]')).toBeVisible();
		await expect(page.locator('a[href="https://t.me/hedgehogincoverlord"]')).toBeVisible();
		await expect(page.locator('a[href="https://t.me/Mushoku_Tensei_AudioBook"]')).toBeVisible();
		await expect(page.locator('a[href="https://discord.gg/5dwmqrEwx"]')).toBeVisible();
		await expect(page.locator('a[href="https://boosty.to/hedgehoginc"]')).toBeVisible();

		// Проверка преимуществ
		await expect(page.getByRole('heading', { name: 'Уведомления' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Общение' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Эксклюзивы' })).toBeVisible();
	});

	test('страница /support отображает реквизиты и статический QR кошелька', async ({ page }) => {
		await page.goto('/support');
		await expect(page.getByRole('heading', { name: 'Поддержать автора' })).toBeVisible();

		// Номер карты отображается на странице.
		await expect(page.getByText('4817 7603 3434 7832')).toBeVisible();

		// TON-карточка открывает статический QR/адрес, без динамического инвойса.
		await page.getByRole('button', { name: 'Открыть QR-код кошелька' }).click();
		await expect(page.getByText('Скопируйте адрес или сканируйте QR-код.').first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Показать QR-код' })).toBeVisible();
		await expect(page.getByText('Создать платёж')).toHaveCount(0);
		await expect(page.getByText('TON Connect')).toHaveCount(0);
	});

	test('главная в мобильном альбомном режиме не имеет горизонтального скролла', async ({
		page
	}) => {
		await page.setViewportSize({ width: 844, height: 390 });
		await page.goto('/');
		await expect(page.locator('h1').first()).toBeVisible();
		await expect(page.getByRole('link', { name: 'Слушать' }).first()).toBeVisible();
		await expect(page.locator('.showcase-all-books')).toBeHidden();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});

	test('неавторизованный пользователь при переходе в /admin перенаправляется на /auth', async ({
		page
	}) => {
		await page.goto('/admin');
		await expect(page).toHaveURL(/\/auth/);
	});
});
