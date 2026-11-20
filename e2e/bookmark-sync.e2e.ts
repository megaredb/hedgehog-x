import { test, expect, type Page } from '@playwright/test';

const VOLUME_URL = '/books/overlord/overlord_vol_1';
const BOOKMARKS_URL = '/bookmarks';

async function openVolume(page: Page) {
	await page.goto(VOLUME_URL, { waitUntil: 'domcontentloaded' });
	await expect(page.getByText(/Глава 1: Конец и начало|Пролог/)).toBeVisible({ timeout: 15000 });
}

async function queueCount(page: Page): Promise<number> {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open('HedgehogDB');
			req.onerror = () => reject(req.error);
			req.onsuccess = () => resolve(req.result);
		});
		const count = await new Promise<number>((resolve, reject) => {
			const tx = db.transaction('syncQueue', 'readonly');
			const req = tx.objectStore('syncQueue').count();
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		db.close();
		return count;
	});
}

test.describe('P0-03: bookmark offline queue', () => {
	test('offline bookmark is sent when the browser goes back online', async ({ page, context }) => {
		let posted: Record<string, unknown> | null = null;

		await page.route('**/api/user/sync', async (route) => {
			if (route.request().method() === 'POST') {
				posted = route.request().postDataJSON() as Record<string, unknown>;
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true })
				});
				return;
			}
			await route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Unauthorized' })
			});
		});

		await openVolume(page);
		await page
			.getByRole('button', { name: /Воспроизвести: (?:\d+\. )?(Глава 1|Пролог)/ })
			.first()
			.click();
		await page.waitForTimeout(1200);

		const note = 'offline-sync-' + Date.now();
		await context.setOffline(true);
		await page.locator('button[title="Добавить закладку"]:visible').first().click();
		await page.getByText('Новая закладка').waitFor({ state: 'visible' });
		await page.locator('#bookmark-note').fill(note);
		await page.getByRole('button', { name: 'Сохранить закладку' }).click();
		await page.waitForTimeout(900);

		expect(await queueCount(page)).toBeGreaterThan(0);

		await context.setOffline(false);
		await expect.poll(() => posted?.bookmarkUpdates, { timeout: 10000 }).toBeTruthy();
		await expect.poll(() => queueCount(page), { timeout: 10000 }).toBe(0);

		const updates =
			(posted as { bookmarkUpdates?: Array<Record<string, unknown>> }).bookmarkUpdates ?? [];
		expect(updates).toHaveLength(1);
		expect(updates[0]).toMatchObject({
			action: 'upsert',
			chapterId: 'overlord_v1_c1',
			note
		});

		await page.goto(BOOKMARKS_URL);
		await expect(page.getByText(note)).toBeVisible();
	});
});
