/**
 * Page Object «менеджер загрузок» (src/routes/downloads/+page.svelte).
 *
 * Страница собирается из секций «Активные загрузки и очередь» и «Сохраненные
 * тома»; группы — аккордеоны тома (DownloadVolumeGroup), строки глав —
 * DownloadChapterRow (data-slot="item"). Точные тексты/статусы сверены с
 * компонентами src/lib/components/downloads/*.
 *
 * Селекторы — по ролям / точным текстам / data-slot, БЕЗ CSS-классов. Содержит
 * только селекторы и действия; ассерты остаются в тестах.
 */

import type { Locator, Page } from '@playwright/test';
import { openPage } from '../fixtures/utils';

/** Заголовок раздела страницы загрузок (см. src/lib/route-titles.ts). */
export const DOWNLOADS_TITLE = 'Загрузки';

/** Заголовки секций и пустых состояний — точные тексты из +page.svelte/empty. */
export const ACTIVE_SECTION = 'Активные загрузки и очередь';
export const SAVED_SECTION = 'Сохраненные тома';
export const QUEUE_EMPTY_TITLE = 'Очередь пуста';
export const QUEUE_EMPTY_DESC = 'Нет активных или запланированных загрузок.';
export const NO_DOWNLOADS_TITLE = 'Нет загрузок';
export const NO_DOWNLOADS_DESC = 'У вас пока нет полностью скачанных глав.';

export class DownloadsPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	/** Перейти на /downloads свежей навигацией (гость, пустые состояния/засев). */
	async goto(): Promise<void> {
		await openPage(this.page, '/downloads');
	}

	/**
	 * Перейти в «Загрузки» из десктопного сайдбара (SPA-навигация, без
	 * перезагрузки) — сохраняет состояние менеджера загрузок и «висящие»
	 * аудио-запросы, зарегистрированные на текущей странице.
	 */
	async openFromVolumeNav(): Promise<void> {
		await this.page
			.locator('aside')
			.getByRole('link', { name: DOWNLOADS_TITLE, exact: true })
			.click();
		await this.page.waitForURL(/\/downloads$/);
	}

	// ─── Заголовки / пустые состояния ───────────────────────────────────────────

	/** Заголовок раздела (h1 через PageHeader). */
	get heading(): Locator {
		return this.page.getByRole('heading', { name: DOWNLOADS_TITLE, level: 1 });
	}

	/** Заголовок секции активной очереди (h2). */
	get activeHeading(): Locator {
		return this.page.getByRole('heading', { name: ACTIVE_SECTION, level: 2 });
	}

	/** Заголовок секции «Сохраненные тома» (h2). */
	get savedHeading(): Locator {
		return this.page.getByRole('heading', { name: SAVED_SECTION, level: 2 });
	}

	/** Пустое состояние «Очередь пуста». */
	get queueEmptyText(): Locator {
		return this.page.getByText(QUEUE_EMPTY_TITLE, { exact: true });
	}

	/** Пустое состояние «Нет активных или запланированных загрузок.» */
	get queueEmptyDescription(): Locator {
		return this.page.getByText(QUEUE_EMPTY_DESC, { exact: true });
	}

	/** Пустое состояние «Нет загрузок» (нет сохранённых томов). */
	get noDownloadsText(): Locator {
		return this.page.getByText(NO_DOWNLOADS_TITLE, { exact: true });
	}

	/** Пустое состояние «У вас пока нет полностью скачанных глав.» */
	get noDownloadsDescription(): Locator {
		return this.page.getByText(NO_DOWNLOADS_DESC, { exact: true });
	}

	// ─── Аккордеоны томов / подписи-счётчики ────────────────────────────────────

	/** Подпись-счётчик группы («N глав в очереди» / «Доступно оффлайн: N глав»). */
	groupSubtitle(text: string): Locator {
		return this.page.getByText(text, { exact: true });
	}

	/** Раскрыть аккордеон тома, кликая по подписи-счётчику внутри триггера. */
	async expandGroup(subtitle: string): Promise<void> {
		await this.groupSubtitle(subtitle).click();
	}

	// ─── Строки глав (data-slot="item") ─────────────────────────────────────────

	/** Строка главы в раскрытой группе (и активной, и сохранённой). */
	chapterRow(chapterTitle: string): Locator {
		return this.page.locator('[data-slot="item"]').filter({ hasText: chapterTitle });
	}

	/** Кнопка «Отменить главу» в строке (активная/очередь). */
	cancelChapterButton(chapterTitle: string): Locator {
		return this.chapterRow(chapterTitle).getByRole('button', { name: 'Отменить главу' });
	}

	/** Кнопка «Удалить главу» в строке (сохранённый том). */
	deleteChapterButton(chapterTitle: string): Locator {
		return this.chapterRow(chapterTitle).getByRole('button', { name: 'Удалить главу' });
	}

	// ─── Кнопки секций ──────────────────────────────────────────────────────────

	/** Кнопка «Очистить очередь» (активная секция). */
	get clearQueueButton(): Locator {
		return this.page.getByRole('button', { name: 'Очистить очередь', exact: true });
	}

	/** Кнопка «Отменить том» в заголовке аккордеона (активная секция). */
	get cancelVolumeButton(): Locator {
		return this.page.getByRole('button', { name: 'Отменить том', exact: true });
	}

	/** Кнопка «Удалить том» в заголовке аккордеона (сохранённый том). */
	get deleteVolumeButton(): Locator {
		return this.page.getByRole('button', { name: 'Удалить том', exact: true });
	}
}
