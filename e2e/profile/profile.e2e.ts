/**
 * E2E: страница профиля (/profile) — новый стиль:
 *  - page-object через фикстуру (ProfilePage из profile.page.ts + profilePage
 *    из profile.fixtures.ts);
 *  - data-driven кейсы из profile.cases.ts (данные, не логика);
 *  - тесты разбиты на `test.describe` по областям; тело подставляет кейс.
 *
 * Покрытие перенесено из старого плоского e2e/profile.e2e.ts (удалён) без потери
 * ни одного ассерта + добавлены новые ветки (последний вход по провайдерам,
 * варианты аватара карточки/строк, loading/error подписки, disabled на время
 * операции, <title>).
 *
 * API мокается (сессия/list-accounts/link-social/unlink-account/subscription/
 * user-delete), реальные OAuth/Boosty не задействуются.
 */

import type { Page } from '@playwright/test';
import { test, expect } from './profile.fixtures';
import { BASE_URL } from '../config';
import { segmentTitle } from '../../src/lib/route-titles';
import {
	mockBoosty,
	mockGetSession,
	mockListAccounts,
	mockBoostySubscription
} from '../fixtures/mocks';
import {
	BOOSTY_ACCOUNT,
	DISCORD_ACCOUNT,
	MOCK_SESSION,
	MOCK_USER,
	TELEGRAM_ACCOUNT,
	type MockLinkedAccount,
	type MockUser
} from '../fixtures/data';
import {
	cardAvatarCases,
	lastLoginCases,
	noSubscriptionCase,
	providerRowCases,
	subscriptionActiveCases,
	unlinkedRowCases
} from './profile.cases';

// ─── Локальные хелперы ────────────────────────────────────────────────────────

/** MOCK_USER + переопределения полей (для мока get-session). */
function buildUser(fields: Partial<MockUser>): MockUser {
	return { ...MOCK_USER, ...fields };
}

/** Счётчик вызовов /api/auth/list-accounts: 1-й возвращает only, дальше — withExtra. */
async function mockListAccountsSequential(
	page: Page,
	first: MockLinkedAccount[],
	after: MockLinkedAccount[]
): Promise<void> {
	let calls = 0;
	await page.route('**/api/auth/list-accounts', async (route) => {
		calls += 1;
		const body = calls <= 1 ? first : after;
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(body)
		});
	});
}

// ─── 1. Доступ и карточка профиля ─────────────────────────────────────────────

test.describe('профиль: доступ и карточка', () => {
	test('гость на /profile → редирект на /auth?from=…', async ({ page, guest, profilePage }) => {
		void guest;
		await profilePage.goto();
		await expect(page).toHaveURL(/\/auth\?from=/);
		await expect(page.getByRole('heading', { name: 'Вход в аккаунт' })).toBeVisible();
	});

	// Сценарий 2: залогиненный видит имя, ID и «последний вход: <платформа>».
	// Все ветки: Telegram/Discord/Boosty из user.lastLoginProvider + негативные
	// (поле не задано / значение не соответствует провайдеру → строки нет).
	for (const c of lastLoginCases) {
		test(`залогинен: карточка и «последний вход» — ${c.id}`, async ({ page, profilePage }) => {
			await mockGetSession(page, { user: buildUser(c.userFields), session: MOCK_SESSION });
			await mockListAccounts(page, []);
			await profilePage.goto();

			await expect(profilePage.heading).toBeVisible();
			await expect(profilePage.name(MOCK_USER.name)).toBeVisible();
			await expect(profilePage.userId(MOCK_USER.id)).toBeVisible();

			if (c.expectLastLogin) {
				await expect(profilePage.lastLogin(c.providerLabel)).toBeVisible();
			} else {
				await expect(profilePage.lastLoginAny).toHaveCount(0);
			}
		});
	}

	// Аватар карточки профиля: image → <img>, иначе — иконка.
	for (const c of cardAvatarCases) {
		test(`аватар карточки профиля — ${c.kind}`, async ({ page, profilePage }) => {
			await mockGetSession(page, { user: buildUser({ image: c.image }), session: MOCK_SESSION });
			await mockListAccounts(page, []);
			await profilePage.goto();

			if (c.kind === 'img') {
				await expect(profilePage.profileImage).toBeVisible();
				await expect(profilePage.profileImage).toHaveAttribute('src', c.image as string);
				await expect(profilePage.profileIcon).toHaveCount(0);
			} else {
				await expect(profilePage.profileImage).toHaveCount(0);
				await expect(profilePage.profileIcon).toBeVisible();
			}
		});
	}

	// <title> страницы согласован с ROUTE_TITLES.
	test('<title> профиля согласован с ROUTE_TITLES', async ({ page, profilePage }) => {
		await mockListAccounts(page, []);
		await profilePage.goto();
		await expect(page).toHaveTitle(`${segmentTitle('profile')} — HEDGEHOG.INC`);
	});
});

// ─── 2. Способы входа (строки провайдеров) ───────────────────────────────────

test.describe('профиль: способы входа', () => {
	test.beforeEach(async ({ loggedIn }) => {
		void loggedIn;
	});

	test('залогинен: имя, ID юзера и ID способа Telegram', async ({ page, profilePage }) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT]);
		await profilePage.goto();

		await expect(profilePage.heading).toBeVisible();
		await expect(profilePage.name(MOCK_USER.name)).toBeVisible();
		await expect(profilePage.userId(MOCK_USER.id)).toBeVisible();
		// ID способа входа: «ID 123456789»
		await expect(page.getByText(`ID ${TELEGRAM_ACCOUNT.accountId}`)).toBeVisible();
	});

	// Ветки аватара/подписи привязанного способа (img / initial / icon).
	for (const c of providerRowCases) {
		test(`строка способа — ${c.id}`, async ({ page, profilePage }) => {
			await mockGetSession(page, { user: buildUser(c.userFields), session: MOCK_SESSION });
			await mockListAccounts(page, [c.account]);
			await profilePage.goto();

			// Способ привязан → кнопка «Отвязать».
			await expect(profilePage.unlinkButton(c.providerId)).toBeVisible();
			// Ветка аватара.
			if (c.avatar === 'img') {
				const img = profilePage.avatarImage(c.providerId);
				await expect(img).toBeVisible();
				await expect(img).toHaveAttribute('src', c.imgSrc as string);
				await expect(profilePage.brandIcon(c.providerId)).toHaveCount(0);
			} else if (c.avatar === 'initial') {
				await expect(profilePage.avatarImage(c.providerId)).toHaveCount(0);
				await expect(profilePage.brandIcon(c.providerId)).toHaveCount(0);
				await expect(profilePage.initial(c.providerId, c.initialChar as string)).toBeVisible();
			} else {
				await expect(profilePage.avatarImage(c.providerId)).toHaveCount(0);
				await expect(profilePage.brandIcon(c.providerId)).toBeVisible();
			}
			// Подпись строки.
			await expect(profilePage.subtitle(c.providerId, c.subtitle)).toBeVisible();
		});
	}

	// Непривязанные способы: описание + иконка + «Привязать».
	test('непривязанные способы: описание, иконка и кнопка «Привязать»', async ({
		page,
		profilePage
	}) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT]);
		await profilePage.goto();

		for (const u of unlinkedRowCases) {
			await expect(profilePage.brandIcon(u.providerId)).toBeVisible();
			await expect(profilePage.subtitle(u.providerId, u.description)).toBeVisible();
			await expect(profilePage.linkButton(u.providerId)).toBeVisible();
			await expect(profilePage.unlinkButton(u.providerId)).toHaveCount(0);
		}
	});

	// loading-состояние списка способов.
	test('пока загружаются способы, строк не видно (isLoading)', async ({ page, profilePage }) => {
		// list-accounts «висит» навсегда → accounts.isLoading остаётся true.
		await page.route('**/api/auth/list-accounts', () => {
			/* не завершаем запрос */
		});
		await profilePage.goto();

		await expect(profilePage.providersLoading).toBeVisible();
		await expect(profilePage.row('telegram-oidc')).toHaveCount(0);
	});

	// disabled-кнопок на время операции (accounts.isPending).
	test('во время привязки все кнопки (в т.ч. удаление) блокируются', async ({
		page,
		profilePage
	}) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT]);
		// link-social «висит» → accounts.isPending = 'link'.
		await page.route('**/api/auth/link-social', () => {
			/* не завершаем запрос */
		});
		await profilePage.goto();

		// До операции кнопка удаления активна.
		await expect(profilePage.deleteButton).toBeEnabled();

		await profilePage.link('discord');

		await expect(profilePage.deleteButton).toBeDisabled();
		await expect(profilePage.linkButton('discord')).toBeDisabled();
		await expect(profilePage.linkButton('boosty')).toBeDisabled();
		await expect(profilePage.unlinkButton('telegram-oidc')).toBeDisabled();
	});

	// Сценарий 5c: последний способ нельзя отвязать.
	test('единственный способ входа нельзя отвязать (disabled)', async ({ page, profilePage }) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT]);
		await profilePage.goto();

		await expect(profilePage.unlinkButton('telegram-oidc')).toBeDisabled();
		await expect(profilePage.linkButton('discord')).toBeEnabled();
	});

	// Сценарий 5a: отвязка с подтверждением (аккаунтId — внешний id провайдера).
	test('отвязать способ с подтверждением — уходит внешний accountId', async ({
		page,
		profilePage
	}) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT, DISCORD_ACCOUNT]);

		let unlinkBody: { providerId?: string; accountId?: string } | null = null;
		await page.route('**/api/auth/unlink-account', async (route) => {
			unlinkBody = (route.request().postDataJSON() ?? {}) as {
				providerId?: string;
				accountId?: string;
			};
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ status: true })
			});
		});

		await profilePage.goto();

		// Оба способа видны (их внешние ID).
		await expect(page.getByText(`ID ${DISCORD_ACCOUNT.accountId}`)).toBeVisible();
		await expect(page.getByText(`ID ${TELEGRAM_ACCOUNT.accountId}`)).toBeVisible();

		await expect(profilePage.unlinkButton('discord')).toBeEnabled();

		// Отвязка требует подтверждения в модалке.
		await profilePage.openUnlink('discord');
		const dialog = profilePage.dialog;
		await expect(dialog).toContainText('Отвязать Discord?');
		await dialog.getByRole('button', { name: 'Отвязать' }).click();

		// После отвязки Discord помечается как доступный для привязки.
		await expect(profilePage.linkButton('discord')).toBeVisible();

		// В тело уходит внешний id провайдера, а не внутренний id записи.
		await expect.poll(() => unlinkBody?.providerId).toBe('discord');
		expect(unlinkBody?.accountId).toBe(DISCORD_ACCOUNT.accountId);
	});

	// Сценарий 5b: «Отмена» закрывает модалку отвязки без вызова API.
	test('отмена отвязки закрывает модалку и не вызывает API', async ({ page, profilePage }) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT, DISCORD_ACCOUNT]);

		let unlinkCalled = 0;
		await page.route('**/api/auth/unlink-account', async (route) => {
			unlinkCalled += 1;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ status: true })
			});
		});

		await profilePage.goto();
		await profilePage.openUnlink('discord');
		const dialog = profilePage.dialog;
		await expect(dialog).toContainText('Отвязать Discord?');

		await dialog.getByRole('button', { name: 'Отмена' }).click();

		await expect(dialog).not.toBeVisible();
		await expect.poll(() => unlinkCalled).toBe(0);
		// Способ по-прежнему привязан.
		await expect(profilePage.unlinkButton('discord')).toBeVisible();
	});

	// Сценарий 3: привязка OAuth (Discord) → /link-social + редирект на провайдера.
	test('привязка Discord: POST /link-social с провайдером + редирект', async ({
		page,
		profilePage
	}) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT]);

		let linkProvider = '';
		await page.route('**/api/auth/link-social', async (route) => {
			linkProvider =
				((route.request().postDataJSON() ?? {}) as { provider?: string }).provider ?? '';
			const callback = encodeURIComponent(new URL('/api/auth/callback/discord', BASE_URL).href);
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					url: `https://discord.com/api/oauth2/authorize?response_type=code&client_id=1463632713943748925&redirect_uri=${callback}`,
					redirect: true,
					status: true
				})
			});
		});

		// Внешний host не навигируем на реальный discord.com.
		let externalUrl = '';
		await page.route('https://discord.com/**', async (route) => {
			externalUrl = route.request().url();
			await route.fulfill({
				status: 200,
				contentType: 'text/html',
				body: '<html><body></body></html>'
			});
		});

		await profilePage.goto();
		await profilePage.link('discord');

		await expect.poll(() => linkProvider).toBe('discord');
		await expect.poll(() => externalUrl).toContain('discord.com');
	});

	// Сценарий 4: привязка Boosty → BoostyLoginModal (SMS мокается) → способ появляется.
	test('привязка Boosty: модалка телефон+SMS, после подтверждения способ привязан', async ({
		page,
		profilePage
	}) => {
		// До привязки только Telegram; после перезагрузки list-accounts вернёт и Boosty.
		await mockListAccountsSequential(page, [TELEGRAM_ACCOUNT], [TELEGRAM_ACCOUNT, BOOSTY_ACCOUNT]);
		await mockBoosty(page);

		// Успешный confirm-code (mockBoosty сам успех не мокает).
		let confirmCalled = 0;
		await page.route('**/api/boosty/confirm-code', async (route) => {
			confirmCalled += 1;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true, user: { id: 'u1', name: 'Boosty', image: null } })
			});
		});

		await profilePage.goto();
		await expect(profilePage.linkButton('boosty')).toBeVisible();

		const dialog = await profilePage.openBoostyLink();
		await expect(dialog).toContainText('Привязать Boosty');

		await dialog.locator('#boosty-phone').fill('9999999999');
		await dialog.getByRole('button', { name: 'Получить код' }).click();

		const codeInput = dialog.locator('input[inputmode="numeric"]');
		await expect(codeInput).toBeVisible();
		await codeInput.fill('123456');
		await expect.poll(() => confirmCalled).toBe(1);

		// Успех → перезагрузка на /profile → повторный list-accounts вернул Boosty.
		await expect(page).toHaveURL('/profile');
		await expect(profilePage.unlinkButton('boosty')).toBeVisible();
		await expect(profilePage.linkButton('boosty')).toHaveCount(0);
	});
});

// ─── 3. Подписка HEDGEHOG.INC в Boosty ───────────────────────────────────────

test.describe('профиль: подписка Boosty', () => {
	test.beforeEach(async ({ loggedIn }) => {
		void loggedIn;
	});

	// Все активные ветки (level/цена/период/пауза/оплата ожидается/действует до/«—»).
	for (const c of subscriptionActiveCases) {
		test(`подписка — ${c.id}`, async ({ page, profilePage }) => {
			await mockListAccounts(page, [BOOSTY_ACCOUNT]);
			await mockBoostySubscription(page, c.body);
			await profilePage.goto();

			const sub = profilePage.subscription;
			await expect(sub).toBeVisible();
			for (const s of c.expect) {
				await expect(sub).toContainText(s);
			}
			for (const s of c.notExpect) {
				await expect(sub).not.toContainText(s);
			}
		});
	}

	// Нет подписки → текст + ссылка «Оформить на boosty.to».
	test('подписка — нет подписки, есть ссылка на boosty.to', async ({ page, profilePage }) => {
		await mockListAccounts(page, [BOOSTY_ACCOUNT]);
		await mockBoostySubscription(page, noSubscriptionCase.body);
		await profilePage.goto();

		const sub = profilePage.subscription;
		await expect(sub).toBeVisible();
		await expect(sub).toContainText('Активной подписки на HEDGEHOG.INC нет.');

		const link = sub.getByRole('link', { name: 'Оформить на boosty.to' });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', noSubscriptionCase.boostyLink as string);
	});

	// Загружается (subscription-запрос «висит»).
	test('подписка — «загружаем статус…» пока ответа нет', async ({ page, profilePage }) => {
		await mockListAccounts(page, [BOOSTY_ACCOUNT]);
		await page.route('**/api/boosty/subscription', () => {
			/* не завершаем запрос */
		});
		await profilePage.goto();

		await expect(profilePage.subscription).toContainText('Загружаем статус…');
	});

	// Ошибка загрузки подписки.
	test('подписка — ошибка загрузки показывается', async ({ page, profilePage }) => {
		await mockListAccounts(page, [BOOSTY_ACCOUNT]);
		await mockBoostySubscription(page, {
			linked: true,
			subscribed: false,
			levelName: null,
			priceRub: null,
			periodMonths: null,
			nextPayTime: null,
			onTime: null,
			isFeePaid: false,
			isPaused: false,
			error: 'Сервис Boosty временно недоступен'
		});
		await profilePage.goto();

		await expect(profilePage.subscription).toContainText('Сервис Boosty временно недоступен');
	});
});

// ─── 4. Удаление аккаунта ─────────────────────────────────────────────────────

test.describe('профиль: удаление аккаунта', () => {
	test.beforeEach(async ({ loggedIn }) => {
		void loggedIn;
	});

	// Счётчик вызовов /api/user/delete.
	async function mockUserDelete(page: Page, onDelete: () => void): Promise<void> {
		await page.route('**/api/user/delete', async (route) => {
			onDelete();
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true })
			});
		});
	}

	// Сценарий 7: четырёхступенчатое подтверждение и один вызов API.
	test('удаление требует 4 шагов подтверждения и вызывает API один раз', async ({
		page,
		profilePage
	}) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT]);
		let deleteCalled = 0;
		await mockUserDelete(page, () => {
			deleteCalled += 1;
		});

		await profilePage.goto();
		const dialog = await profilePage.openDeleteModal();

		await expect(dialog).toContainText('Удалить аккаунт');
		await dialog.getByRole('button', { name: 'Удалить аккаунт' }).last().click();
		await expect(dialog).toContainText('Точно удалить?');
		await dialog.getByRole('button', { name: 'Точно удалить?' }).click();
		await expect(dialog).toContainText('Да, удалить навсегда');
		await dialog.getByRole('button', { name: 'Да, удалить навсегда' }).click();
		await expect(dialog).toContainText('Удалить безвозвратно');
		await dialog.getByRole('button', { name: 'Удалить безвозвратно' }).click();

		await expect.poll(() => deleteCalled).toBe(1);
	});

	// Отмена (пул текстов) закрывает модалку без вызова API.
	test('кнопка «отмена» закрывает модалку без удаления', async ({ page, profilePage }) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT]);
		let deleteCalled = 0;
		await mockUserDelete(page, () => {
			deleteCalled += 1;
		});

		await profilePage.goto();
		const dialog = await profilePage.openDeleteModal();
		await expect(dialog).toBeVisible();

		await profilePage.cancelDelete();

		await expect(dialog).not.toBeVisible();
		await expect.poll(() => deleteCalled).toBe(0);
	});

	// Закрытие по оверлею позволяет открыть модалку снова.
	test('закрытие по оверлею позволяет открыть модалку снова', async ({ page, profilePage }) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT]);
		let deleteCalled = 0;
		await mockUserDelete(page, () => {
			deleteCalled += 1;
		});

		await profilePage.goto();
		const dialog = await profilePage.openDeleteModal();
		await expect(dialog).toBeVisible();

		// Клик по краю оверлея (data-slot хука) закрывает модалку.
		await profilePage.dialogOverlay.click({ position: { x: 5, y: 5 } });
		await expect(dialog).not.toBeVisible();

		// Повторно открывается без перезагрузки.
		const dialog2 = await profilePage.openDeleteModal();
		await expect(dialog2).toBeVisible();
		await expect(dialog2).toContainText('Удалить аккаунт');

		// Закрываем — delete API не вызывался.
		await profilePage.cancelDelete();
		await expect(dialog2).not.toBeVisible();
		await expect.poll(() => deleteCalled).toBe(0);
	});

	// Подтверждение каждый шаг на новом месте (4 шага).
	test('кнопка подтверждения каждый раз на новом месте (4 шага)', async ({ page, profilePage }) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT]);
		let deleteCalled = 0;
		await mockUserDelete(page, () => {
			deleteCalled += 1;
		});

		await profilePage.goto();
		const dialog = await profilePage.openDeleteModal();

		/** Позиция кнопки с данным текстом среди всех 4 кнопок модалки. */
		async function confirmPosition(label: string): Promise<number> {
			const texts = await dialog
				.locator('button')
				.allTextContents()
				.then((all) => all.map((t) => t.trim()).filter((t) => t !== '' && t !== 'Удаление…'));
			expect(texts).toHaveLength(4);
			const idx = texts.indexOf(label);
			expect(idx).toBeGreaterThanOrEqual(0);
			return idx;
		}

		const labels = [
			'Удалить аккаунт',
			'Точно удалить?',
			'Да, удалить навсегда',
			'Удалить безвозвратно'
		];
		const positions: number[] = [];
		for (let step = 0; step < labels.length; step++) {
			const pos = await confirmPosition(labels[step]);
			positions.push(pos);
			if (positions.length > 1) {
				expect(pos).not.toBe(positions[positions.length - 2]);
			}
			if (step < labels.length - 1) {
				await dialog.getByRole('button', { name: labels[step] }).click();
				await expect(dialog).toContainText(labels[step + 1]);
			}
		}

		// Финальный шаг → реальное удаление.
		await dialog.getByRole('button', { name: 'Удалить безвозвратно' }).click();
		await expect.poll(() => deleteCalled).toBe(1);
	});

	// После удаления аккаунта — переход на главную.
	test('после удаления аккаунта пользователь переходит на главную', async ({
		page,
		profilePage
	}) => {
		await mockListAccounts(page, [TELEGRAM_ACCOUNT]);
		await mockUserDelete(page, () => undefined);

		await profilePage.goto();
		const dialog = await profilePage.openDeleteModal();
		await dialog.getByRole('button', { name: 'Удалить аккаунт' }).last().click();
		await dialog.getByRole('button', { name: 'Точно удалить?' }).click();
		await dialog.getByRole('button', { name: 'Да, удалить навсегда' }).click();
		await dialog.getByRole('button', { name: 'Удалить безвозвратно' }).click();

		await expect(page).toHaveURL('/');
	});
});
