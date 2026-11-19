import { test, expect, type Page } from '@playwright/test';

const VOLUME_URL = '/books/overlord/overlord_vol_1';
const BOOK_URL = '/books/overlord';

type Counts = {
	progress: number;
	bookmarks: number;
	volumeLikes: number;
	chapters: number;
	owner: string | null;
};

function authPayload(userId: string, options: { isNewUser?: boolean; userName?: string } = {}) {
	return {
		authenticated: true,
		userId,
		userName: options.userName ?? 'Тестовый пользователь',
		isNewUser: options.isNewUser ?? false,
		chapterLikes: [],
		volumeLikes: [],
		listeningProgress: [],
		bookmarks: []
	};
}

async function openVolume(page: Page) {
	await page.goto(VOLUME_URL);
	await expect(page.getByText('Глава 1: Конец и начало')).toBeVisible({ timeout: 15000 });
}

async function readCounts(page: Page): Promise<Counts> {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open('HedgehogDB');
			req.onerror = () => reject(req.error);
			req.onsuccess = () => resolve(req.result);
		});

		const count = (store: string) =>
			new Promise<number>((resolve, reject) => {
				const tx = db.transaction(store, 'readonly');
				const req = tx.objectStore(store).count();
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});

		const owner = await new Promise<string | null>((resolve, reject) => {
			const tx = db.transaction('meta', 'readonly');
			const req = tx.objectStore('meta').get('syncOwner');
			req.onsuccess = () => resolve(req.result?.userId ?? null);
			req.onerror = () => reject(req.error);
		});

		const result = {
			progress: await count('progress'),
			bookmarks: await count('bookmarks'),
			volumeLikes: await count('volumeLikes'),
			chapters: await count('chapters'),
			owner
		};
		db.close();
		return result;
	});
}

async function seedGuestData(page: Page) {
	await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open('HedgehogDB');
			req.onerror = () => reject(req.error);
			req.onsuccess = () => resolve(req.result);
		});

		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(['progress', 'bookmarks', 'volumeLikes'], 'readwrite');
			tx.objectStore('progress').put({
				chapterId: 'overlord_v1_c1',
				progressSeconds: 77,
				isCompleted: false,
				updatedAt: Date.now()
			});
			tx.objectStore('bookmarks').put({
				id: 'e2e-sync-bookmark',
				chapterId: 'overlord_v1_c1',
				timestampSeconds: 77,
				note: 'e2e',
				createdAt: Date.now()
			});
			tx.objectStore('volumeLikes').put({
				volumeId: 'overlord_vol_1',
				createdAt: Date.now()
			});
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	});
}

async function addPendingProgress(page: Page) {
	await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open('HedgehogDB');
			req.onerror = () => reject(req.error);
			req.onsuccess = () => resolve(req.result);
		});

		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction('syncQueue', 'readwrite');
			tx.objectStore('syncQueue').add({
				action: 'UPDATE_PROGRESS',
				payload: [{ chapterId: 'overlord_v1_c1', progressSeconds: 88, isCompleted: false }],
				timestamp: Date.now()
			});
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	});
}

test.describe('P0-01: local user data safety', () => {
	test('guest request to /api/user/sync returns 401', async ({ request }) => {
		const res = await request.get('/api/user/sync');
		expect(res.status()).toBe(401);
	});

	test('guest progress/bookmarks/likes survive book navigation', async ({ page }) => {
		await openVolume(page);
		await seedGuestData(page);
		await page.goto(BOOK_URL);
		await expect.poll(async () => (await readCounts(page)).progress).toBe(1);
		const counts = await readCounts(page);
		expect(counts.bookmarks).toBe(1);
		expect(counts.volumeLikes).toBe(1);
	});

	test('offline sync failure does not wipe local data', async ({ page }) => {
		await page.route('**/api/user/sync', (route) => route.abort());
		await openVolume(page);
		await seedGuestData(page);
		await page.goto(BOOK_URL);
		await expect.poll(async () => (await readCounts(page)).progress).toBe(1);
		const counts = await readCounts(page);
		expect(counts.bookmarks).toBe(1);
		expect(counts.volumeLikes).toBe(1);
	});

	test('same user + empty server + empty queue replaces local data', async ({ page }) => {
		await page.route('**/api/user/sync', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(authPayload('user-a'))
			})
		);

		await openVolume(page);
		await expect.poll(async () => (await readCounts(page)).owner).toBe('user-a');
		await seedGuestData(page);

		await page.goto(BOOK_URL);
		await expect.poll(async () => (await readCounts(page)).progress).toBe(0);
		const counts = await readCounts(page);
		expect(counts.bookmarks).toBe(0);
		expect(counts.volumeLikes).toBe(0);
		expect(counts.owner).toBe('user-a');
	});

	test('pending mutations prevent an authoritative purge', async ({ page }) => {
		await page.route('**/api/user/sync', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(authPayload('user-a'))
			})
		);

		await openVolume(page);
		await expect.poll(async () => (await readCounts(page)).owner).toBe('user-a');
		await seedGuestData(page);
		await addPendingProgress(page);

		await page.goto(BOOK_URL);
		await expect.poll(async () => (await readCounts(page)).progress).toBe(1);
	});

	test('switching users clears the previous owner data', async ({ page }) => {
		let currentUser = 'user-a';
		await page.route('**/api/user/sync', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(authPayload(currentUser))
			})
		);

		await openVolume(page);
		await expect.poll(async () => (await readCounts(page)).owner).toBe('user-a');
		await seedGuestData(page);

		currentUser = 'user-b';
		await page.goto(BOOK_URL);
		await expect.poll(async () => (await readCounts(page)).owner).toBe('user-b');
		const counts = await readCounts(page);
		expect(counts.progress).toBe(0);
		expect(counts.bookmarks).toBe(0);
		expect(counts.volumeLikes).toBe(0);
	});

	test('guest data is uploaded before adopting an authenticated owner', async ({ page }) => {
		let authenticated = false;
		let posted: Record<string, unknown> | null = null;

		await page.route('**/api/user/sync', async (route) => {
			const method = route.request().method();
			if (method === 'GET') {
				if (!authenticated) {
					await route.fulfill({
						status: 401,
						contentType: 'application/json',
						body: JSON.stringify({ error: 'Unauthorized' })
					});
					return;
				}
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(authPayload('user-a'))
				});
				return;
			}

			posted = route.request().postDataJSON() as Record<string, unknown>;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
		});

		await openVolume(page);
		await seedGuestData(page);

		authenticated = true;
		await page.goto(BOOK_URL);
		await expect(page.getByText('Перенести локальные данные?')).toBeVisible();
		await page.getByRole('button', { name: 'Перенести в аккаунт' }).click();
		await expect.poll(async () => (await readCounts(page)).owner).toBe('user-a');
		await expect.poll(() => posted?.progressUpdates).toBeTruthy();
		expect(Array.isArray((posted as { progressUpdates?: unknown[] }).progressUpdates)).toBe(true);
		expect((await readCounts(page)).progress).toBe(1);
	});

	test('new account auto-adopts guest data without a consent modal', async ({ page }) => {
		let authenticated = false;
		let posted: Record<string, unknown> | null = null;

		await page.route('**/api/user/sync', async (route) => {
			if (route.request().method() === 'GET' && !authenticated) {
				await route.fulfill({
					status: 401,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Unauthorized' })
				});
				return;
			}
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(authPayload('user-new', { isNewUser: true }))
				});
				return;
			}
			posted = route.request().postDataJSON() as Record<string, unknown>;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
		});

		await openVolume(page);
		await seedGuestData(page);
		authenticated = true;
		await page.goto(BOOK_URL);
		await expect.poll(async () => (await readCounts(page)).owner).toBe('user-new');
		await expect.poll(() => posted?.progressUpdates).toBeTruthy();
		await expect(page.getByText('Перенести локальные данные?')).not.toBeVisible();
	});

	test('existing account can decline guest data: nothing is mixed or uploaded', async ({
		page
	}) => {
		let authenticated = false;
		let posted: Record<string, unknown> | null = null;

		await page.route('**/api/user/sync', async (route) => {
			if (route.request().method() === 'GET' && !authenticated) {
				await route.fulfill({
					status: 401,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Unauthorized' })
				});
				return;
			}
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(authPayload('user-a'))
				});
				return;
			}
			posted = route.request().postDataJSON() as Record<string, unknown>;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
		});

		await openVolume(page);
		await seedGuestData(page);
		authenticated = true;
		await page.goto(BOOK_URL);
		await expect(page.getByText('Перенести локальные данные?')).toBeVisible();
		await page.getByRole('button', { name: 'Не переносить' }).click();
		await expect.poll(async () => (await readCounts(page)).owner).toBe('user-a');
		expect(await readCounts(page)).toMatchObject({ progress: 0, bookmarks: 0, volumeLikes: 0 });
		expect(posted).toBeNull();
	});
});
