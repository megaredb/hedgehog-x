/**
 * Page Object «страница тома» (src/routes/books/[bookId]/[volumeId]/+page.svelte).
 *
 * Страница рендерит список глав тома (данные из Dexie, куда их кладёт фоновая
 * синхронизация при моке /api/books/**) и позволяет запустить воспроизведение
 * (клик по строке главы → очередь в audioStore → GlobalPlayer) либо начать
 * офлайн-загрузку («Скачать все» / кнопка у главы).
 *
 * Используется фичами catalog/player/downloads (общий шаг «открыть том и
 * получить очередь/глав»). Селекторы — роли/aria-label/тексты, БЕЗ CSS-классов.
 * Содержит только селекторы и действия; ассерты остаются в тестах.
 */

import type { Locator, Page } from '@playwright/test';
import { openPage } from '../fixtures/utils';

/** Префиксы aria-label строки главы (см. handlePlayChapter в +page.svelte). */
const PLAY_PREFIX = 'Воспроизвести: ';
const PAUSE_PREFIX = 'Пауза: ';

export class VolumePage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	/** Перейти на страницу тома и погасить CSS-анимации (см. openPage). */
	async goto(bookId: string, volumeId: string): Promise<void> {
		await openPage(this.page, `/books/${bookId}/${volumeId}`);
	}

	// ─── Заголовки ──────────────────────────────────────────────────────────────

	/** Заголовок тома (h1). */
	heading(title: string): Locator {
		return this.page.getByRole('heading', { name: title, level: 1 });
	}

	/** Заголовок секции списка глав (h2 «Список глав»). */
	get listHeading(): Locator {
		return this.page.getByRole('heading', { name: 'Список глав', level: 2 });
	}

	// ─── Строки глав / воспроизведение ──────────────────────────────────────────

	/** Кнопка строки главы в состоянии «воспроизвести» (aria-label). */
	playButton(chapterTitle: string): Locator {
		return this.page.getByRole('button', {
			name: `${PLAY_PREFIX}${chapterTitle}`,
			exact: true
		});
	}

	/** Кнопка строки главы в состоянии «пауза» (глава сейчас играет). */
	pauseChapterButton(chapterTitle: string): Locator {
		return this.page.getByRole('button', {
			name: `${PAUSE_PREFIX}${chapterTitle}`,
			exact: true
		});
	}

	/** Строка главы (<li>), содержащая кнопку «Воспроизвести: <название>». */
	chapterRow(chapterTitle: string): Locator {
		return this.page.locator('li').filter({ has: this.playButton(chapterTitle) });
	}

	/** Кнопка «Скачать» у главы (Download.svelte) — вторая кнопка строки. */
	downloadChapterButton(chapterTitle: string): Locator {
		return this.chapterRow(chapterTitle).getByRole('button').last();
	}

	/** Клик по строке главы запускает воспроизведение (клик авто-ждёт появления). */
	async play(chapterTitle: string): Promise<void> {
		await this.playButton(chapterTitle).click();
	}

	/** Скачать одну главу кнопкой у строки (кладёт в очередь загрузок). */
	async downloadChapter(chapterTitle: string): Promise<void> {
		await this.downloadChapterButton(chapterTitle).click();
	}

	// ─── Кнопки тома (шапка списка глав) ───────────────────────────────────────

	/** Кнопка «Скачать все» — поставить весь том в очередь загрузок. */
	get downloadAllButton(): Locator {
		return this.page.getByRole('button', { name: 'Скачать все', exact: true });
	}

	/** Скачать весь том (клик по «Скачать все»). */
	async downloadAll(): Promise<void> {
		await this.downloadAllButton.click();
	}

	/** Кнопка «Отменить (n/total)» — появляется, пока том скачивается. */
	get cancelVolumeProgressButton(): Locator {
		return this.page.getByRole('button', { name: /Отменить \(\d+\/\d+\)/ });
	}

	/** Метка «Все главы загружены» (том полностью в офлайне). */
	get fullyDownloadedText(): Locator {
		return this.page.getByText('Все главы загружены', { exact: true });
	}
}
