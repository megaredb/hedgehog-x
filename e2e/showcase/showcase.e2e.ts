/**
 * E2E: главная-витрина (/) — новый стиль:
 *  - page-object через фикстуру (ShowcasePage + showcasePage из showcase.fixtures);
 *  - data-driven кейсы из showcase.cases.ts (прямой вход ?book=, секции витрины);
 *  - стабильность: состояние индикаторов, nav-панели, CTA и URL управляются
 *    currentIndex (клик-хендлеры меняют его синхронно), поэтому ассерты не
 *    зависят от реального завершения плавного скролла; бесконечная CSS-анимация
 *    на индикаторах и переключение видеофона глушатся переходом через openPage.
 *
 * Покрытие перенесено из старого плоского e2e/showcase.e2e.ts (удалён) без
 * потери ни одного ассерта + добавлены: <title>, описания секций, CTA-ветки
 * («Скоро»/«Слушать» через засев Dexie), nav-панель (sr-only «Вверх»/«Вниз»),
 * переключатель видеофона с persist в localStorage, прямой вход ?book=.
 */

import { test, expect } from './showcase.fixtures';
import { segmentTitle } from '../../src/lib/route-titles';
import { showcaseEntryCases, showcaseSectionCases } from './showcase.cases';
import { seedShowcaseBook } from './showcase.helpers';

test.describe('Главная: витрина книг (mockShowcase)', () => {
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	// ─── <title> и заголовки секций ────────────────────────────────────────────

	test('<title> витрины = «Главная — HEDGEHOG.INC»', async ({ showcasePage }) => {
		await showcasePage.goto();
		await expect(showcasePage.page).toHaveTitle(`${segmentTitle('')} — HEDGEHOG.INC`);
	});

	// Обе книги витрины отрисованы: h1 + описание из mockShowcase.
	for (const c of showcaseSectionCases) {
		test(`секция «${c.title}» рендерит h1 и описание`, async ({ showcasePage }) => {
			await showcasePage.goto();
			await expect(showcasePage.sectionHeading(c.title)).toHaveCount(1);
			await expect(showcasePage.bookDescription(c.description)).toHaveCount(1);
		});
	}

	test('обе секции видны на первой книге; индикатор «вниз» есть, «вверх» — нет', async ({
		showcasePage
	}) => {
		await showcasePage.goto();

		// Обе книги витрины отрисованы (h1-заголовки секций)
		await expect(showcasePage.sectionHeading('Реинкарнация безработного')).toBeVisible();
		await expect(showcasePage.sectionHeading('Повелитель')).toHaveCount(1);

		// Первый элемент: индикатор вниз есть, вверх отсутствует
		await expect(showcasePage.downIndicator).toBeVisible();
		await expect(showcasePage.upIndicator).toHaveCount(0);
	});

	// ─── Плавающие индикаторы «Пролистать вверх/вниз» ─────────────────────────

	test('клик по «Пролистать вниз» включает «Пролистать вверх» и меняет ?book=', async ({
		page,
		showcasePage
	}) => {
		await showcasePage.goto();
		await expect(page).not.toHaveURL(/book=/);

		await showcasePage.scrollDown();

		// Состояние переключилось: вниз скрыт, вверх показан
		await expect(showcasePage.upIndicator).toBeVisible();
		await expect(showcasePage.downIndicator).toHaveCount(0);

		// URL получил параметр второй книги витрины
		await expect(page).toHaveURL(/book=overlord/);
	});

	test('клик по «Пролистать вверх» возвращает к первой книге', async ({ page, showcasePage }) => {
		await showcasePage.goto('?book=overlord');
		// Стартовый индекс берётся из URL: показывается вторая книга
		await expect(showcasePage.upIndicator).toBeVisible();

		await showcasePage.scrollUp();

		await expect(showcasePage.downIndicator).toBeVisible();
		await expect(showcasePage.upIndicator).toHaveCount(0);
		await expect(page).toHaveURL(/book=mushoku_tensei/);
	});

	// ─── Прямой вход по ?book= ─────────────────────────────────────────────────

	for (const c of showcaseEntryCases) {
		test(`прямой вход ${c.query} стартует на ${c.startIndex === 0 ? '1-м' : '2-м'} слайде`, async ({
			showcasePage
		}) => {
			await showcasePage.goto(c.query);

			if (c.startIndex === 0) {
				// 1-й слайд: «Пролистать вниз» есть, «вверх» — нет.
				await expect(showcasePage.downIndicator).toBeVisible();
				await expect(showcasePage.upIndicator).toHaveCount(0);
			} else {
				// 2-й слайд: «Пролистать вверх» есть, «вниз» — нет.
				await expect(showcasePage.upIndicator).toBeVisible();
				await expect(showcasePage.downIndicator).toHaveCount(0);
			}
		});
	}

	// ─── CTA-ветки секций («Скоро» / «Слушать») ───────────────────────────────

	test('по умолчанию в секции disabled-кнопка «Скоро», «Слушать» нет', async ({ showcasePage }) => {
		await showcasePage.goto();

		for (const c of showcaseSectionCases) {
			await expect(showcasePage.soonButton(c.title)).toBeDisabled();
			await expect(showcasePage.listenLink(c.title)).toHaveCount(0);
		}
	});

	test('книга в каталоге (Dexie) → «Слушать» ведёт на /books/<id>', async ({
		page,
		showcasePage
	}) => {
		// Засев книги витрины (первой: mushoku_tensei) прямо в Dexie → CTA «Слушать».
		const target = showcaseSectionCases[0];
		await showcasePage.goto();
		await seedShowcaseBook(page, target.id);
		// Полный перезаход: ShowcaseItem читает книгу из Dexie при старте.
		await showcasePage.goto();

		// У засеянной книги — активная ссылка «Слушать», у второй — «Скоро».
		await expect(showcasePage.listenLink(target.title)).toBeVisible();
		await expect(showcasePage.soonButton(showcaseSectionCases[1].title)).toBeDisabled();

		// Клик ведёт на /books/<id>.
		await showcasePage.listenLink(target.title).click();
		await expect(page).toHaveURL(new RegExp(`/books/${target.id}`));
	});

	// ─── Nav-панель (sr-only «Вверх»/«Вниз») ───────────────────────────────────

	test('nav-панель: на 1-м слайде «Вверх» disabled, «Вниз» enabled', async ({ showcasePage }) => {
		await showcasePage.goto();

		await expect(showcasePage.navUp).toBeDisabled();
		await expect(showcasePage.navDown).toBeEnabled();
	});

	test('nav «Вниз» листает на 2-ю книгу (?book=overlord); «Вверх» — обратно', async ({
		page,
		showcasePage
	}) => {
		await showcasePage.goto();
		await expect(showcasePage.navUp).toBeDisabled();
		await expect(showcasePage.navDown).toBeEnabled();

		// Вниз → вторая книга.
		await showcasePage.navDown.click();
		await expect(page).toHaveURL(/book=overlord/);
		await expect(showcasePage.navUp).toBeEnabled();
		await expect(showcasePage.navDown).toBeDisabled();

		// Вверх → возврат к первой.
		await showcasePage.navUp.click();
		await expect(page).toHaveURL(/book=mushoku_tensei/);
		await expect(showcasePage.navDown).toBeEnabled();
		await expect(showcasePage.navUp).toBeDisabled();
	});

	// ─── Переключатель видеофона ───────────────────────────────────────────────

	test('переключатель видео: выкл.→localStorage=false, reload сохраняет, вкл.→true', async ({
		showcasePage
	}) => {
		await showcasePage.goto();

		// По умолчанию видеофон включён.
		await expect(showcasePage.videoToggleOn).toBeVisible();
		await expect(showcasePage.videoToggleOff).toHaveCount(0);

		// Выключили → состояние сменилось и записан 'false'.
		await showcasePage.toggleVideo();
		await expect(showcasePage.videoToggleOff).toBeVisible();
		await expect(showcasePage.videoToggleOn).toHaveCount(0);
		// Значение записано под ключом VIDEO_BG_STORE_KEY.
		expect(await showcasePage.videoPref()).toBe('false');

		// reload (перезаход через goto): настройка восстановилась из localStorage — выключено.
		await showcasePage.goto();
		await expect(showcasePage.videoToggleOff).toBeVisible();
		await expect(showcasePage.videoToggleOn).toHaveCount(0);

		// Включили обратно → 'true'.
		await showcasePage.toggleVideo();
		await expect(showcasePage.videoToggleOn).toBeVisible();
		expect(await showcasePage.videoPref()).toBe('true');
	});
});
