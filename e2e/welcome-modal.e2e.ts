import { test, expect } from '@playwright/test';

/**
 * E2E: тестовое приветственное модальное окно.
 * Окно должно появляться при открытии сайта и закрываться кнопкой.
 */
test.describe('Welcome modal', () => {
	test('появляется при открытии сайта и закрывается', async ({ page }) => {
		// У каждого теста Playwright изолированный контекст: localStorage пуст.
		// Не чистим storage через addInitScript — он сбрасывается и на reload,
		// что ломает проверку «не показывать больше».
		await page.goto('/');

		// Даём окну время открыться (openDelay 400 мс)
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		await expect(dialog).toContainText('Добро пожаловать в HEDGEHOG.INC');
		await expect(dialog).toContainText('Не показывать больше');

		// Закрываем через основную кнопку
		await page.getByRole('button', { name: 'Начать прослушивание' }).click();
		await expect(dialog).not.toBeVisible();

		// После закрытия сайт остаётся доступным
		await expect(page.getByRole('main')).toBeVisible();
	});

	test('«Не показывать больше» запоминается после перезагрузки', async ({ page }) => {
		await page.goto('/');

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		// Отмечаем чекбокс и закрываем
		await dialog.getByRole('checkbox').check();
		await page.getByRole('button', { name: 'Начать прослушивание' }).click();
		await expect(dialog).not.toBeVisible();

		// Перезагружаем страницу — окно не должно появиться снова
		await page.reload();
		await expect(page.getByRole('dialog')).not.toBeVisible();
		await expect(page.getByRole('main')).toBeVisible();
	});
});
