/**
 * E2E: главная-витрина (/) — новый стиль:
 *  - page-object ShowcasePage (e2e/showcase/showcase.page.ts): переходы, секции
 *    книг, индикаторы «Пролистать вверх/вниз»;
 *  - стабильность: состояние индикаторов и URL управляются currentIndex
 *    (клик-хендлеры меняют его синхронно), поэтому ассерты не зависят от
 *    реального завершения плавного скролла; бесконечная CSS-анимация на
 *    индикаторах глушится переходом через openPage (KILL_ANIMATIONS).
 *
 * Покрытие перенесено из старого плоского e2e/showcase.e2e.ts (удалён) без
 * потери ни одного ассерта.
 */

import { test, expect } from '../fixtures/test';
import { ShowcasePage } from './showcase.page';

test.describe('Главная: витрина книг (mockShowcase)', () => {
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	test('секции книг рендерятся; на первой виден «Пролистать вниз», «вверх» — нет', async ({
		page
	}) => {
		const showcase = new ShowcasePage(page);
		await showcase.goto();

		// Обе книги витрины отрисованы (h1-заголовки секций)
		await expect(showcase.sectionHeading('Реинкарнация безработного')).toBeVisible();
		await expect(showcase.sectionHeading('Повелитель')).toHaveCount(1);

		// Первый элемент: индикатор вниз есть, вверх отсутствует
		await expect(showcase.downIndicator).toBeVisible();
		await expect(showcase.upIndicator).toHaveCount(0);
	});

	test('клик по «Пролистать вниз» включает «Пролистать вверх» и меняет ?book=', async ({
		page
	}) => {
		const showcase = new ShowcasePage(page);
		await showcase.goto();
		await expect(page).not.toHaveURL(/book=/);

		await showcase.scrollDown();

		// Состояние переключилось: вниз скрыт, вверх показан
		await expect(showcase.upIndicator).toBeVisible();
		await expect(showcase.downIndicator).toHaveCount(0);

		// URL получил параметр второй книги витрины
		await expect(page).toHaveURL(/book=overlord/);
	});

	test('клик по «Пролистать вверх» возвращает к первой книге', async ({ page }) => {
		const showcase = new ShowcasePage(page);
		await showcase.goto('?book=overlord');
		// Стартовый индекс берётся из URL: показывается вторая книга
		await expect(showcase.upIndicator).toBeVisible();

		await showcase.scrollUp();

		await expect(showcase.downIndicator).toBeVisible();
		await expect(showcase.upIndicator).toHaveCount(0);
		await expect(page).toHaveURL(/book=mushoku_tensei/);
	});
});
