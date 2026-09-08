import { test, expect } from './fixtures/test';
import { openPage } from './fixtures/utils';

/**
 * E2E: главная страница (/) — витрина книг из mockShowcase.
 *
 * Проверяем scroll-snap-витрину без проверки видео/скролла:
 *  1. Секции книг рендерятся (первый заголовок виден).
 *  2. На первом элементе есть индикатор «Пролистать вниз», «вверх» — нет.
 *  3. Клик по «Пролистать вниз» переключает состояние (появляется «вверх»).
 *  4. URL-параметр ?book= меняется после листания.
 *
 * Стабильность: состояние индикаторов и URL управляются currentIndex
 * (клик-хендлеры меняют его синхронно), поэтому ассерты не зависят от
 * реального завершения плавного скролла. Бесконечная CSS-анимация
 * `animate-bounce` на индикаторах глушится инъекцией стилей ПОСЛЕ загрузки
 * (addInitScript срабатывает до появления DOM, поэтому addStyleTag).
 */

test.describe('Главная: витрина книг (mockShowcase)', () => {
	test.beforeEach(async ({ guest }) => {
		void guest;
	});

	test('секции книг рендерятся; на первой виден «Пролистать вниз», «вверх» — нет', async ({
		page
	}) => {
		await openPage(page, '/');

		// Обе книги витрины отрисованы (h1-заголовки секций)
		await expect(page.getByRole('heading', { name: 'Реинкарнация безработного' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Повелитель' })).toHaveCount(1);

		// Первый элемент: индикатор вниз есть, вверх отсутствует
		await expect(page.getByTitle('Пролистать вниз')).toBeVisible();
		await expect(page.getByTitle('Пролистать вверх')).toHaveCount(0);
	});

	test('клик по «Пролистать вниз» включает «Пролистать вверх» и меняет ?book=', async ({
		page
	}) => {
		await openPage(page, '/');
		await expect(page).not.toHaveURL(/book=/);

		await page.getByTitle('Пролистать вниз').click();

		// Состояние переключилось: вниз скрыт, вверх показан
		await expect(page.getByTitle('Пролистать вверх')).toBeVisible();
		await expect(page.getByTitle('Пролистать вниз')).toHaveCount(0);

		// URL получил параметр второй книги витрины
		await expect(page).toHaveURL(/book=overlord/);
	});

	test('клик по «Пролистать вверх» возвращает к первой книге', async ({ page }) => {
		await openPage(page, '/?book=overlord');
		// Стартовый индекс берётся из URL: показывается вторая книга
		await expect(page.getByTitle('Пролистать вверх')).toBeVisible();

		await page.getByTitle('Пролистать вверх').click();

		await expect(page.getByTitle('Пролистать вниз')).toBeVisible();
		await expect(page.getByTitle('Пролистать вверх')).toHaveCount(0);
		await expect(page).toHaveURL(/book=mushoku_tensei/);
	});
});
