/**
 * Page Object «вход через Boosty» (модалка телефон + SMS-код).
 *
 * Модалка открывается кнопкой «Войти через Boosty» на /auth (BoostyLoginModal
 * поверх BaseModal → role=dialog). Внутри — кастомный select страны (поиск,
 * русские названия, флаг), поле национального номера, кнопка «Получить код»,
 * затем шаг ввода 6-значного кода с автоподтверждением.
 *
 * Селекторы сверены с src/lib/components/auth/BoostyLogin.svelte: по ролям /
 * точным текстам / id, БЕЗ CSS-классов. Содержит только селекторы и действия;
 * ассерты остаются в тестах.
 */

import type { Locator, Page } from '@playwright/test';
import { openPage } from '../fixtures/utils';

/** Подпись кнопки открытия модалки на /auth (метка способа из AUTH_PROVIDERS). */
export const BOOSTY_PROVIDER_LABEL = 'Boosty';
/** Заголовок модалки входа (title BoostyLoginModal на /auth). */
export const BOOSTY_LOGIN_TITLE = 'Вход через Boosty';

/** Плейсхолдер поля поиска страны в кастомном select. */
const COUNTRY_SEARCH_PLACEHOLDER = 'Поиск страны…';

export class BoostyPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// ─── Навигация ──────────────────────────────────────────────────────────────

	/**
	 * Открыть модалку входа Boosty с /auth (гость). Возвращает объект страницы
	 * после появления активной модалки. Повторный шаг для всех тестов входа.
	 */
	async openFromAuth(): Promise<void> {
		await openPage(this.page, '/auth');
		await this.page.getByRole('button', { name: `Войти через ${BOOSTY_PROVIDER_LABEL}` }).click();
	}

	// ─── Активная модалка ───────────────────────────────────────────────────────

	/** Активная модалка (role=dialog). */
	get dialog(): Locator {
		return this.page.getByRole('dialog');
	}

	/** Заголовок модалки «Вход через Boosty». */
	get heading(): Locator {
		return this.dialog.getByRole('heading', { name: BOOSTY_LOGIN_TITLE });
	}

	// ─── Кастомный select страны ────────────────────────────────────────────────

	/**
	 * Триггер select страны (Button с aria-label="{dialCode} {ruName}",
	 * например «+7 Россия»). Матчим по dialCode, чтобы ветка смены страны
	 * искала текущий триггер без хардкода точного имени.
	 */
	countryTrigger(dialCode: string): Locator {
		return this.dialog.getByRole('button', { name: new RegExp(escapeRegExp(dialCode)) });
	}

	/** Открыть список стран (клик по триггеру текущего кода). */
	async openCountryList(dialCode: string): Promise<void> {
		await this.countryTrigger(dialCode).click();
	}

	/** Поле поиска страны внутри открытого списка. */
	get countrySearch(): Locator {
		return this.dialog.getByPlaceholder(COUNTRY_SEARCH_PLACEHOLDER);
	}

	/** Вариант страны в списке (button с role=option) по подстроке ruName. */
	countryOption(namePart: string): Locator {
		return this.dialog.getByRole('option', { name: new RegExp(escapeRegExp(namePart)) });
	}

	/** Выбрать страну: открыть список, искать по ruName и кликнуть вариант. */
	async selectCountry(fromDial: string, search: string, namePart: string): Promise<void> {
		await this.openCountryList(fromDial);
		await this.countrySearch.fill(search);
		await this.countryOption(namePart).click();
	}

	// ─── Поле телефона и отправка кода ──────────────────────────────────────────

	/** Национальный номер (id boosty-phone, компонент сам добавит dialCode). */
	get phoneInput(): Locator {
		return this.dialog.locator('#boosty-phone');
	}

	/** Кнопка «Получить код» (отправка SMS на этапе телефона). */
	get getCodeButton(): Locator {
		return this.dialog.getByRole('button', { name: 'Получить код' });
	}

	// ─── Шаг кода ───────────────────────────────────────────────────────────────

	/** Поле 6-значного кода (input inputmode=numeric на шаге code). */
	get codeInput(): Locator {
		return this.dialog.locator('input[inputmode="numeric"]');
	}

	/** Получить код по введённому номеру (телефон уже заполнен). */
	async sendCode(): Promise<void> {
		await this.getCodeButton.click();
	}
}

/** Экранирует спецсимволы RegExp в строке (для getByRole по имени/опции). */
function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
