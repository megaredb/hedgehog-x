import { test, expect } from '@playwright/test';

test('каталог показывает книги и фильтрует по поиску', async ({ page }) => {
	await page.goto('/books');
	await expect(page.getByRole('heading', { name: 'Каталог', exact: true })).toBeVisible();
	await expect(page.getByText('Реинкарнация безработного').first()).toBeVisible();
	await page.getByPlaceholder('Поиск...').fill('Повелитель');
	await expect(page.getByText('Повелитель').first()).toBeVisible();
	await expect(page.getByText('Реинкарнация безработного')).toHaveCount(0);
});
