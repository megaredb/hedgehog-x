/**
 * Page Object «страница книги» (src/routes/books/[bookId]/+page.svelte).
 *
 * Страница отдаёт список томов книги, читая их из Dexie (данные кладёт туда
 * фоновая синхронизация из +layout.ts при моке /api/books/**). Вид томов
 * переключается кнопками «Сетка»/«Список» (aria-label); описания томов
 * рендерятся только в режиме «Список».
 *
 * Селекторы — по ролям / текстам / aria-label, БЕЗ CSS-классов. Содержит только
 * селекторы и действия; ассерты остаются в тестах.
 */

import type { Locator, Page } from '@playwright/test';
import { openPage } from '../fixtures/utils';

export class BookPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	/** Перейти на страницу книги и погасить CSS-анимации (см. openPage). */
	async goto(bookId: string): Promise<void> {
		await openPage(this.page, `/books/${bookId}`);
	}

	/** Заголовок книги (h1). */
	titleHeading(title: string): Locator {
		return this.page.getByRole('heading', { name: title, level: 1 });
	}

	/** Бейдж «Том N» поверх обложки тома (в карточке тома). */
	volumeBadge(volumeNumber: number): Locator {
		return this.page.getByText(`Том ${volumeNumber}`, { exact: true });
	}

	/** Название тома (h2 в карточке тома). */
	volumeTitleHeading(title: string): Locator {
		return this.page.getByRole('heading', { name: title, level: 2 });
	}

	/** Описание тома — показывается только в режиме «Список». */
	volumeDescription(text: string): Locator {
		return this.page.getByText(text, { exact: true });
	}

	/** Кнопка-переключатель вида (aria-label «Сетка»/«Список»). */
	viewToggle(name: 'Сетка' | 'Список'): Locator {
		return this.page.getByRole('button', { name, exact: true });
	}

	/** Переключить вид списка томов на «Сетка» или «Список». */
	async switchView(name: 'Сетка' | 'Список'): Promise<void> {
		await this.viewToggle(name).click();
	}
}
