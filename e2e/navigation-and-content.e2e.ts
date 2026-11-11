import { test, expect } from '@playwright/test';

test.describe('Навигация и новые разделы сайта (PWA)', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('hedgehog-welcome-modal-dismissed', 'true');
		});
	});

	test('страница /community отображает социальные сети и преимущества', async ({ page }) => {
		await page.goto('/community');
		await expect(page.getByRole('heading', { name: 'Сообщество' })).toBeVisible();
		await expect(page.getByText('Хотите узнать больше об авторе?')).toBeVisible();

		// Проверка ссылок на соцсети
		await expect(page.getByRole('link', { name: 'VKontakte' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Overlord' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Mushoku Tensei' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Discord' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Boosty' })).toBeVisible();

		// Проверка преимуществ
		await expect(page.getByRole('heading', { name: 'Уведомления' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Общение' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Эксклюзивы' })).toBeVisible();
	});

	test('страница /support отображает реквизиты, карту, TON и QR коды', async ({ page }) => {
		await page.goto('/support');
		await expect(page.getByRole('heading', { name: 'Поддержать автора' })).toBeVisible();

		// Карта и адрес TON
		await expect(page.getByText('4817 7603 3434 7832')).toBeVisible();
		await expect(page.getByText(/UQDoqpcudSDCZGqKWCoLDT008_BNhSKBUao_G5MZR9jcpf-i/)).toBeVisible();

		// QR коды для перевода
		await expect(page.getByRole('button', { name: 'QR-код карты' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'QR-код TON' })).toBeVisible();
	});

	test('неавторизованный пользователь при переходе в /admin перенаправляется на /auth', async ({
		page
	}) => {
		await page.goto('/admin');
		await expect(page).toHaveURL(/\/auth/);
	});
});
