/**
 * Page Object «главная-витрина» (src/routes/+page.svelte).
 *
 * Витрина построена на scroll-snap-секциях книг из mockShowcase. Управляется
 * currentIndex: индикаторы «Пролистать вверх/вниз» (кнопки с title), CTA-кнопки
 * секций (Button shadcn: при наличии книги в Dexie — ссылка «Слушать» на
 * /books/<id>, иначе disabled «Скоро»), вертикальная nav-панель (sr-only
 * «Вверх»/«Вниз») и переключатель видеофона (sr-only «Переключить видео», у
 * состояния title «Выключить/Включить видеофон»). Состояние и URL-параметр
 * ?book= управляются currentIndex (клик-хендлеры меняют его синхронно), поэтому
 * ассерты не зависят от реального завершения плавного скролла.
 *
 * Бесконечная CSS-анимация (animate-bounce на индикаторах) и переключение видео
 * глушатся переходом через openPage (KILL_ANIMATIONS), который добавляет стили
 * ПОСЛЕ goto.
 *
 * Селекторы — по ролям / заголовкам / title / sr-only, БЕЗ CSS-классов.
 * Содержит только селекторы и действия; ассерты остаются в тестах.
 */

import type { Locator, Page } from '@playwright/test';
import { VIDEO_BG_STORE_KEY } from '../../src/lib/constants';
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

	/** Описание книги (абзац <p> из ShowcaseItem) по точному тексту. */
	bookDescription(text: string): Locator {
		return this.page.getByText(text, { exact: true });
	}

	/**
	 * Секция книги (элемент <section> ShowcaseItem), отфильтрованная по её
	 * заголовку. Позволяет скоупить CTA-кнопку именно к этой книге — на экране
	 * всегда обе секции в DOM, но каждая со своим h1/кнопкой.
	 */
	section(title: string): Locator {
		return this.page.locator('section').filter({ hasText: title });
	}

	/** CTA-ссылка «Слушать» внутри секции (Button c href → <a>). */
	listenLink(title: string): Locator {
		return this.section(title).getByRole('link', { name: 'Слушать' });
	}

	/** CTA-кнопка «Скоро» внутри секции (Button disabled без href → <button>). */
	soonButton(title: string): Locator {
		return this.section(title).getByRole('button', { name: 'Скоро', exact: true });
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

	// ─── Вертикальная nav-панель (ShowcaseNav, sr-only) ────────────────────────

	/** Кнопка «Вверх» в nav-панели (sr-only, disabled на первой книге). */
	get navUp(): Locator {
		return this.page.getByRole('button', { name: 'Вверх', exact: true });
	}

	/** Кнопка «Вниз» в nav-панели (sr-only, disabled на последней книге). */
	get navDown(): Locator {
		return this.page.getByRole('button', { name: 'Вниз', exact: true });
	}

	// ─── Переключатель видеофона (ShowcaseNav) ─────────────────────────────────

	/**
	 * Переключатель видео: стабильный хук — sr-only «Переключить видео».
	 * Состояние видно по title кнопки (см. videoToggleOn/videoToggleOff) и по
	 * иконке (MonitorOff при показе / MonitorPlay при выключенном фоне).
	 */
	get videoToggle(): Locator {
		return this.page.getByRole('button', { name: 'Переключить видео', exact: true });
	}

	/** Кнопка переключателя в состоянии «видеофон включён» (title «Выключить видеофон»). */
	get videoToggleOn(): Locator {
		return this.page.getByTitle('Выключить видеофон');
	}

	/** Кнопка переключателя в состоянии «видеофон выключен» (title «Включить видеофон»). */
	get videoToggleOff(): Locator {
		return this.page.getByTitle('Включить видеофон');
	}

	/** Клик по переключателю видеофона (независимо от текущего состояния). */
	async toggleVideo(): Promise<void> {
		await this.videoToggle.click();
	}

	/** Прочитать текущее значение локальной настройки видеофона. */
	async videoPref(): Promise<string | null> {
		return this.page.evaluate((key) => localStorage.getItem(key), VIDEO_BG_STORE_KEY);
	}
}
