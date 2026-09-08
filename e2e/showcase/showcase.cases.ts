/**
 * Data-driven кейсы для тестов главной-витрины (/).
 *
 * Массивы — это ДАННЫЕ (query / ожидаемый стартовый слайд), а не логика. Тесты в
 * showcase.e2e.ts прокручивают их циклом `for (const c of cases) test(...)`.
 *
 * Книги витрины берутся из src/lib/data/mockShowcase.ts, чтобы не дублировать
 * заголовки/описания (порядок: index 0 = mushoku_tensei «Реинкарнация
 * безработного», index 1 = overlord «Повелитель»).
 */

import { showcaseBooks } from '../../src/lib/data/mockShowcase';

// ─── Прямой вход по ?book= ─────────────────────────────────────────────────────

export interface ShowcaseEntryCase {
	/** slug кейса (для имени теста). */
	id: string;
	/** query для goto('/' + query), например '?book=overlord'. */
	query: string;
	/** Ожидаемый стартовый индекс (слайд, на котором витрина стартует). */
	startIndex: number;
}

/**
 * Ветки прямого входа на слайд:
 *  - `?book=overlord` (id второй книги витрины) → старт на 2-м слайде (index 1);
 *  - `?book=unknown` (нет в витрине) → фолбэк на 1-й слайд (index 0).
 */
export const showcaseEntryCases: ShowcaseEntryCase[] = [
	{ id: 'known-overlord', query: '?book=overlord', startIndex: 1 },
	{ id: 'unknown-book', query: '?book=unknown', startIndex: 0 }
];

// ─── Секции витрины (заголовки/описания из mockShowcase) ──────────────────────

export interface ShowcaseSectionCase {
	/** index книги в витрине (для сверки с ?book= и индикаторами). */
	index: number;
	/** id книги (mockShowcase). */
	id: string;
	/** h1 секции (book.title). */
	title: string;
	/** Описание книги (абзац <p> секции). */
	description: string;
}

/** Обе книги витрины — их заголовки и описания (для проверки «секции рендерятся»). */
export const showcaseSectionCases: ShowcaseSectionCase[] = showcaseBooks.map((book, index) => ({
	index,
	id: book.id,
	title: book.title,
	description: book.description
}));
