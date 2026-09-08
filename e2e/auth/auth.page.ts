/**
 * Page Object «страница входа» (src/routes/auth/+page.svelte).
 *
 * Страница рендерит способ входа для гостя (кнопки «Войти через …» по
 * AUTH_PROVIDERS) либо, для залогиненного, карточку с именем и кнопкой «Выйти»
 * (signOutAndRedirect). Ошибки авторизации (отмена у провайдера, ошибка
 * sign-in/social) показываются в модалке «Не удалось войти» (BaseModal).
 *
 * Селекторы — по ролям / точным текстам / data-slot, БЕЗ CSS-классов. Содержит
 * только селекторы и действия; ассерты остаются в тестах.
 */

import type { Locator, Page } from '@playwright/test';
import { openPage } from '../fixtures/utils';

/** Заголовок страницы входа (см. ROUTE_TITLES.auth). */
export const AUTH_TITLE = 'Вход в аккаунт';

export class AuthPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// ─── Навигация ──────────────────────────────────────────────────────────────

	/** Перейти на /auth (можно с query, например ?error=access_denied). */
	async goto(path = '/auth'): Promise<void> {
		await openPage(this.page, path);
	}

	/** Заголовок страницы «Вход в аккаунт» (h1). */
	get heading(): Locator {
		return this.page.getByRole('heading', { name: AUTH_TITLE });
	}

	/** Подзаголовок-описание под h1 («Войдите через одну из платформ…»). */
	get description(): Locator {
		return this.page.getByText(/Войдите через одну из платформ/);
	}

	// ─── Способы входа (гость) ──────────────────────────────────────────────────

	/** Кнопка «Войти через <label>» (label = Telegram/Discord/Boosty). */
	providerButton(label: string): Locator {
		return this.page.getByRole('button', { name: `Войти через ${label}` });
	}

	/** Кнопка входа через Telegram (OIDC). */
	get telegramButton(): Locator {
		return this.providerButton('Telegram');
	}

	/** Кнопка входа через Discord (OAuth2). */
	get discordButton(): Locator {
		return this.providerButton('Discord');
	}

	/** Кнопка входа через Boosty (открывает модалку телефон+SMS). */
	get boostyButton(): Locator {
		return this.providerButton('Boosty');
	}

	// ─── Тултип согласия на передачу данных ─────────────────────────────────────

	/** Триггер тултипа «О передаче данных при входе» (bits-ui Tooltip). */
	get consentTrigger(): Locator {
		return this.page.getByText('О передаче данных при входе');
	}

	/** Открыть тултип согласия по наведению на триггер (авто-ожидание открытия). */
	async openConsent(): Promise<void> {
		await this.consentTrigger.hover();
	}

	/** Контент тултипа согласия (bits-ui Tooltip.Content → data-slot tooltip-content). */
	get consentContent(): Locator {
		return this.page.locator('[data-slot="tooltip-content"]');
	}

	// ─── Залогиненное состояние на /auth ───────────────────────────────────────

	/** Аватар (UserAvatar) в карточке залогиненного внутри <main>. */
	get avatar(): Locator {
		return this.page.getByRole('main').locator('[data-slot="avatar"]');
	}

	/**
	 * <img> аватара в карточке (data-slot avatar-image) — присутствует только
	 * когда у user есть image; иначе UserAvatar рисует инициал (fallback).
	 */
	get avatarImage(): Locator {
		return this.avatar.locator('[data-slot="avatar-image"]');
	}

	/** Инициал-фолбэк аватара (кружок с первой буквой имени, когда image нет). */
	avatarInitial(char: string): Locator {
		return this.avatar.getByText(char, { exact: true });
	}

	/** Ссылка «странице профиля» внизу карточки залогиненного (href = /profile). */
	get profileLink(): Locator {
		return this.page.getByRole('link', { name: 'странице профиля' });
	}

	/** Имя пользователя в карточке залогиненного (внутри <main>). */
	userName(name: string): Locator {
		return this.page.getByRole('main').getByText(name);
	}

	/** Кнопка «Выйти» в карточке залогиненного (signOutAndRedirect). */
	get signOutButton(): Locator {
		return this.page.getByRole('button', { name: 'Выйти' });
	}

	// ─── Модалки (ошибка авторизации / вход Boosty) ────────────────────────────

	/** Активная модалка (BaseModal → role=dialog). */
	get dialog(): Locator {
		return this.page.getByRole('dialog');
	}

	/** Кнопка внутри активной модалки по имени. */
	dialogButton(name: string): Locator {
		return this.dialog.getByRole('button', { name });
	}
}
