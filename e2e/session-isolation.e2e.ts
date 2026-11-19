import { test, expect, type Page } from '@playwright/test';

const mockUser = {
	id: 'user-a',
	name: 'Пользователь A',
	email: 'a@example.test',
	image: null,
	emailVerified: false,
	createdAt: new Date(Date.now() - 86_400_000).toISOString(),
	updatedAt: new Date().toISOString()
};

const mockSession = {
	id: 'session-a',
	userId: 'user-a',
	token: 'mock-token',
	expiresAt: new Date(Date.now() + 3600_000).toISOString(),
	createdAt: new Date(Date.now() - 60_000).toISOString(),
	updatedAt: new Date().toISOString()
};

const VOLUME_URL = '/books/overlord/overlord_vol_1';

async function openVolume(page: Page) {
	await page.goto(VOLUME_URL);
	await expect(page.getByText('Глава 1: Конец и начало')).toBeVisible({ timeout: 15000 });
}

type LocalState = {
	progress: number;
	bookmarks: number;
	volumeLikes: number;
	owner: string | null;
	queue: number;
};

async function mockLoggedIn(page: Page) {
	let signedOut = false;
	await page.addInitScript(() => {});
	await page.route('**/api/auth/get-session', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(signedOut ? null : { session: mockSession, user: mockUser })
		});
	});
	await page.route('**/api/auth/sign-out', async (route) => {
		signedOut = true;
		await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});
	await page.route('**/api/user/sync', async (route) => {
		if (route.request().method() === 'POST') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				authenticated: true,
				userId: mockUser.id,
				userName: mockUser.name,
				isNewUser: false,
				chapterLikes: [],
				volumeLikes: [],
				listeningProgress: [],
				bookmarks: []
			})
		});
	});
}

async function seedLocalState(page: Page, owner: string | null, queueOwner: string | null = owner) {
	await page.evaluate(
		async ({ owner, queueOwner }) => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open('HedgehogDB');
				req.onerror = () => reject(req.error);
				req.onsuccess = () => resolve(req.result);
			});

			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(
					['progress', 'bookmarks', 'volumeLikes', 'meta', 'syncQueue'],
					'readwrite'
				);
				tx.objectStore('progress').put({
					chapterId: 'overlord_v1_c1',
					progressSeconds: 42,
					isCompleted: false,
					updatedAt: Date.now()
				});
				tx.objectStore('bookmarks').put({
					id: 'isolation-bookmark',
					chapterId: 'overlord_v1_c1',
					timestampSeconds: 42,
					note: 'isolation',
					createdAt: Date.now()
				});
				tx.objectStore('volumeLikes').put({
					volumeId: 'overlord_vol_1',
					createdAt: Date.now()
				});
				tx.objectStore('meta').put({
					key: 'syncOwner',
					userId: owner,
					updatedAt: Date.now()
				});
				tx.objectStore('syncQueue').add({
					action: 'LIKE_VOLUME',
					payload: { id: 'overlord_vol_1', volumeId: 'overlord_vol_1' },
					timestamp: Date.now(),
					ownerUserId: queueOwner
				});
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
			db.close();
		},
		{ owner, queueOwner }
	);
}

async function readLocalState(page: Page): Promise<LocalState> {
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
			owner,
			queue: await count('syncQueue')
		};
		db.close();
		return result;
	});
}

test.describe('P0-05: session isolation', () => {
	test('authenticated /bookmarks loads server data without opening a book', async ({ page }) => {
		await page.addInitScript(() => {});
		await page.route('**/api/auth/get-session', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ session: mockSession, user: mockUser })
			});
		});
		await page.route('**/api/user/sync', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
				return;
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					authenticated: true,
					userId: mockUser.id,
					userName: mockUser.name,
					isNewUser: false,
					chapterLikes: [],
					volumeLikes: [],
					listeningProgress: [],
					bookmarks: [
						{
							id: 'server-only-bookmark',
							chapterId: 'overlord_v1_c1',
							timestampSeconds: 12,
							note: 'server-only-note',
							createdAt: Date.now()
						}
					]
				})
			});
		});

		await page.goto('/bookmarks');
		await expect(page.getByText('server-only-note')).toBeVisible({ timeout: 15000 });
	});
	test('online logout flushes, clears local data/queue/owner, and navigates home', async ({
		page
	}) => {
		await mockLoggedIn(page);
		await page.goto('/auth');
		await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
		await seedLocalState(page, 'user-a');

		await page.getByRole('button', { name: 'Выйти' }).click();
		await expect(page).toHaveURL('/');
		await expect
			.poll(async () => {
				const state = await readLocalState(page);
				return [state.progress, state.bookmarks, state.volumeLikes, state.owner, state.queue];
			})
			.toEqual([0, 0, 0, null, 0]);
	});

	test('logout clears local data, queue and owner even offline', async ({ page, context }) => {
		await mockLoggedIn(page);
		await page.goto('/auth');
		await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
		await seedLocalState(page, 'user-a');

		await context.setOffline(true);
		await page.getByRole('button', { name: 'Выйти' }).click();

		await expect
			.poll(async () => {
				const state = await readLocalState(page);
				return [state.progress, state.bookmarks, state.volumeLikes, state.owner, state.queue];
			})
			.toEqual([0, 0, 0, null, 0]);
	});

	test('revoked/expired session on reload clears previous local data', async ({ page }) => {
		let active = true;
		await page.addInitScript(() => {});
		await page.route('**/api/auth/get-session', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(active ? { session: mockSession, user: mockUser } : null)
			});
		});
		await page.goto('/auth');
		await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
		await seedLocalState(page, 'user-a');

		active = false;
		await page.reload();
		await expect
			.poll(async () => {
				const state = await readLocalState(page);
				return [state.progress, state.bookmarks, state.volumeLikes, state.owner, state.queue];
			})
			.toEqual([0, 0, 0, null, 0]);
	});

	test('guest queue is never sent under a different owner', async ({ page, context }) => {
		let posted = false;
		await page.route('**/api/user/sync', async (route) => {
			if (route.request().method() === 'POST') posted = true;
			await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		});
		await openVolume(page);
		await seedLocalState(page, null, 'user-a');

		await context.setOffline(true);
		await page.waitForTimeout(300);
		await context.setOffline(false);
		await page.waitForTimeout(1200);

		expect(posted).toBe(false);
		expect((await readLocalState(page)).queue).toBe(1);
	});
});
