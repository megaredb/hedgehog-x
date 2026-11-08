import { test, expect } from '@playwright/test';

/**
 * E2E: закладка как фрагмент — можно указать конец, а не только начало.
 * Проверяем валидацию поля «Конец» и отображение диапазона в списке закладок.
 */

function addSeconds(timecode: string, secondsToAdd: number): string {
	const parts = timecode.split(':').map(Number);
	const total = parts.reduce((acc, part) => acc * 60 + part, 0) + secondsToAdd;
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const paddedS = String(s).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${paddedS}` : `${m}:${paddedS}`;
}

async function openBookmarkDialog(page: import('@playwright/test').Page) {
	await page.goto('/books/mushoku_tensei/mushoku_tensei_vol_1?ch=mushoku_tensei_v1_c1&t=986');
	await page.waitForSelector('.global-audio-player');
	await page.getByTitle('Добавить закладку').first().click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('heading', { name: 'Новая закладка' })).toBeVisible();
	return dialog;
}

test.describe('Закладки: конец фрагмента', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('hedgehog-welcome-modal-dismissed', 'true');
		});
	});

	test('сохраняет конец закладки и показывает диапазон в списке', async ({ page }) => {
		const dialog = await openBookmarkDialog(page);
		const endInput = dialog.locator('#bookmark-end');
		const nowButton = dialog.getByRole('button', {
			name: 'Подставить текущую позицию плеера'
		});

		await nowButton.click();
		await expect.poll(() => endInput.inputValue()).not.toBe('');
		const end = addSeconds(await endInput.inputValue(), 30);
		await endInput.fill(end);

		await expect(dialog.locator('span.tabular-nums').first()).toContainText('–');
		await expect(dialog.locator('p.text-destructive')).toHaveCount(0);

		await dialog.locator('#bookmark-note').fill('Фрагмент для теста');
		await dialog.getByRole('button', { name: 'Сохранить закладку' }).click();
		await expect(dialog).toBeHidden();

		await page.goto('/bookmarks');
		await expect(page.getByRole('heading', { name: 'Закладки', exact: true })).toBeVisible();
		await expect(page.getByText('Фрагмент для теста')).toBeVisible();
		await expect(page.getByText(new RegExp(`\\d+:\\d{2}–${end}$`))).toBeVisible();
	});

	test('не даёт сохранить некорректный конец', async ({ page }) => {
		const dialog = await openBookmarkDialog(page);
		const endInput = dialog.locator('#bookmark-end');

		await endInput.fill('abc');
		await expect(
			dialog.getByText('Неверный формат времени. Используйте мм:сс или ч:мм:сс.')
		).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Сохранить закладку' })).toBeDisabled();

		await endInput.fill('0:00');
		await expect(dialog.getByText('Конец должен быть позже начала.')).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Сохранить закладку' })).toBeDisabled();
	});
});
