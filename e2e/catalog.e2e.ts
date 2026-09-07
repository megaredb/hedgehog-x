import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/test';
import { MOCK_CATALOG } from './fixtures/data';

/**
 * E2E: каталог аудиокниг (страницы /books/book-1 и /books/book-1/:volumeId).
 *
 * Данные берутся из MOCK_CATALOG (e2e/fixtures/data.ts), который мокает
 * GET /api/books и GET /api/books/:bookId (фикстура `catalog`). Страницы
 * читают данные из Dexie после фоновой синхронизации в +layout.ts, поэтому
 * ассерты ждут появления контента (expect авто-ретрят).
 *
 * Покрытие:
 *  1. Страница книги: заголовок книги + список томов (обложки/бейджи/названия).
 *  2. Переключатель «Сетка»/«Список» (aria-label) меняет вид: описания томов
 *     показываются только в режиме «Список».
 *  3. Страница тома: список глав с названиями и длительностями (m:ss,
 *     формат совпадает с formatDuration из src/lib/html-audio.ts).
 *  4. Клик по главе запускает воспроизведение: появляется GlobalPlayer
 *     (кнопки «Пауза»/«Следующий» + заголовок главы в плеере).
 *
 * Селекторы — роли/aria-label/тексты, без CSS-классов. Бесконечные
 * CSS-анимации глушатся addStyleTag ПОСЛЕ goto (см. e2e/showcase.e2e.ts).
 */

const KILL_ANIMATIONS =
	'*,*::before,*::after{animation:none !important;transition:none !important;scroll-behavior:auto !important}';

const VOLUME_1 = MOCK_CATALOG.volumes.find((v) => v.id === 'book-1-vol-1')!;
const VOLUME_2 = MOCK_CATALOG.volumes.find((v) => v.id === 'book-1-vol-2')!;

/** Длительность в m:ss — та же арифметика, что в formatDuration компонента. */
function formatMss(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * «Герметичный» мок HTMLMediaElement живёт в фикстуре `audio`
 * (e2e/fixtures/mocks.ts → mockAudio): load()/src/pause() — no-op, play() эмитит
 * 'play'/'playing', поэтому состояние воспроизведения (isPlaying) ведётся только
 * audioStore и не зависит от нестабильного реального медиа-пайплайна. В тестах
 * с воспроизведением включается фикстура `audio` (см. ниже).
 */

/** Переход на страницу и отключение CSS-анимаций/переходов ПОСЛЕ загрузки. */
async function openPage(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await page.addStyleTag({ content: KILL_ANIMATIONS });
}

test.describe('Каталог: страница книги /books/book-1', () => {
	test.beforeEach(async ({ catalog }) => {
		void catalog;
	});

	test('рендерит заголовок книги и список томов (сетка по умолчанию)', async ({ page }) => {
		await openPage(page, '/books/book-1');

		// Заголовок книги из MOCK_CATALOG
		await expect(page.getByRole('heading', { name: MOCK_CATALOG.title, level: 1 })).toBeVisible();

		// Оба тома: бейдж «Том N» + название тома
		await expect(page.getByText('Том 1', { exact: true })).toBeVisible();
		await expect(page.getByText('Том 2', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: VOLUME_1.title, level: 2 })).toBeVisible();
		await expect(page.getByRole('heading', { name: VOLUME_2.title, level: 2 })).toBeVisible();
	});

	test('переключатель «Сетка»/«Список» переключает вид списка томов', async ({ page }) => {
		await openPage(page, '/books/book-1');
		await expect(page.getByRole('heading', { name: VOLUME_1.title, level: 2 })).toBeVisible();

		const volumeDescription = page.getByText(VOLUME_1.description!, { exact: true });

		// По умолчанию «Сетка» — описания томов не рендерятся
		await expect(volumeDescription).toHaveCount(0);

		// «Список» — появляются описания обоих томов
		await page.getByRole('button', { name: 'Список', exact: true }).click();
		await expect(volumeDescription).toBeVisible();
		await expect(page.getByText(VOLUME_2.description!, { exact: true })).toBeVisible();

		// Обратно в «Сетку» — описания снова скрыты
		await page.getByRole('button', { name: 'Сетка', exact: true }).click();
		await expect(volumeDescription).toHaveCount(0);
	});
});

test.describe('Каталог: страница тома /books/book-1/book-1-vol-1', () => {
	test.beforeEach(async ({ catalog }) => {
		void catalog;
	});

	test('переход на том рендерит главы с названиями и длительностями m:ss', async ({ page }) => {
		await openPage(page, `/books/${MOCK_CATALOG.id}/${VOLUME_1.id}`);

		// Заголовок тома и заголовок секции глав
		await expect(page.getByRole('heading', { name: VOLUME_1.title, level: 1 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Список глав', level: 2 })).toBeVisible();

		// Каждая глава: кнопка «Воспроизвести: <название>» и длительность m:ss
		for (const chapter of VOLUME_1.chapters) {
			await expect(
				page.getByRole('button', { name: `Воспроизвести: ${chapter.title}`, exact: true })
			).toBeVisible();
			await expect(
				page.getByText(formatMss(chapter.durationSeconds), { exact: true })
			).toBeVisible();
		}

		// Главы другого тома на этой странице отсутствуют
		await expect(
			page.getByRole('button', {
				name: `Воспроизвести: ${VOLUME_2.chapters[0].title}`,
				exact: true
			})
		).toHaveCount(0);
	});

	test('клик по главе запускает воспроизведение: появляется GlobalPlayer', async ({
		page,
		catalog,
		audio
	}) => {
		// Фикстуры включаются «перечислением»: catalog мокает /api/books/**,
		// audio — герметичный HTMLMediaElement (см. mockAudio в fixtures/mocks.ts).
		void catalog;
		void audio;
		await openPage(page, `/books/${MOCK_CATALOG.id}/${VOLUME_1.id}`);

		const chapter = VOLUME_1.chapters[1]; // «Листопад»
		const chapterButton = page.getByRole('button', {
			name: `Воспроизвести: ${chapter.title}`,
			exact: true
		});
		await expect(chapterButton).toBeVisible();
		await chapterButton.click();

		// GlobalPlayer появился и играет: кнопка play/pause показывает «Пауза»,
		// доступна навигация «Следующий», заголовок главы есть и в списке, и в плеере
		await expect(page.getByRole('button', { name: 'Пауза', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Следующий', exact: true })).toBeVisible();

		// Строка главы переключилась в состояние «играет»
		await expect(
			page.getByRole('button', { name: `Пауза: ${chapter.title}`, exact: true })
		).toBeVisible();

		// Заголовок главы показан в GlobalPlayer (текст десктоп-бара плеера; тот же
		// текст есть в alt обложки и в скрытой мобильной мини-панели — берём .first())
		const player = page.locator('[data-slot="audio-player"]');
		await expect(player.locator('p').filter({ hasText: chapter.title }).first()).toBeVisible();
	});
});
