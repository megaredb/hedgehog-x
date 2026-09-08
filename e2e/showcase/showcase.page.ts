/**
 * Page Object «главная-витрина» (src/routes/+page.svelte).
 *
 * Витрина построена на scroll-snap-секциях книг из mockShowcase. Сверху/снизу
 * рендерятся индикаторы «Пролистать вверх/вниз» (кнопки с title), состояние и
 * URL-параметр ?book= управляются currentIndex. Бесконечная CSS-анимация
 * `animate-bounce` на индикаторах глушится переходом через openPage
 * (KILL_ANIMATIONS), который добавляет стили ПОСЛЕ goto.
 *
 * Селекторы — по ролям / заголовкам / title, БЕЗ CSS-классов. Содержит только
 * селекторы и действия; ассерты остаются в тестах.
 */

import type { Locator, Page } from '@playwright/test';
import { openPage } from '../fixtures/utils';

export class ShowcasePage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// ─── Навигация ──────────────────────────────────────────────────────────────

	/** Перейти на витрину (с гашением анимаций через openPage). */
	async goto(query = ''): Promise<void> {
		await openPage(this.page, `/${query}`);
	}

	// ─── Секции книг ────────────────────────────────────────────────────────────

	/** Заголовок секции книги по названию (h1 из ShowcaseItem). */
	sectionHeading(title: string): Locator {
		return this.page.getByRole('heading', { name: title });
	}

	// ─── Индикаторы прокрутки ──────────────────────────────────────────────────

	/** Кнопка-индикатор «Пролистать вниз» (title, есть на всех, кроме последней). */
	get downIndicator(): Locator {
		return this.page.getByTitle('Пролистать вниз');
	}

	/** Кнопка-индикатор «Пролистать вверх» (title, есть на всех, кроме первой). */
	get upIndicator(): Locator {
		return this.page.getByTitle('Пролистать вверх');
	}

	/** Клик по «Пролистать вниз» (листает к следующей книге). */
	async scrollDown(): Promise<void> {
		await this.downIndicator.click();
	}

	/** Клик по «Пролистать вверх» (возвращает к предыдущей книге). */
	async scrollUp(): Promise<void> {
		await this.upIndicator.click();
	}
}
