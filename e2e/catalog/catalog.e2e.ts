/**
 * E2E: каталог аудиокниг (страницы /books/book-1 и /books/book-1/:volumeId) —
 * новый стиль: page-объекты через фикстуру (BookPage/VolumePage из catalog.
 * page.ts / volume.page.ts + playerBar из e2e/shared/player.page.ts).
 *
 * Данные берутся из MOCK_CATALOG (e2e/fixtures/data.ts), который мокает
 * GET /api/books и GET /api/books/:bookId (фикстура `catalog`). Страницы читают
 * данные из Dexie после фоновой синхронизации в +layout.ts, поэтому ассерты ждут
 * появления контента (expect авто-ретрят).
 *
 * Покрытие перенесено из удалённого плоского e2e/catalog.e2e.ts без потери
 * ни одного ассерта:
 *  1. Страница книги: заголовок книги + список томов (бейджи «Том N»/названия).
 *  2. Переключатель «Сетка»/«Список» (aria-label) меняет вид: описания томов
 *     показываются только в режиме «Список».
 *  3. Страница тома: главы с названиями и длительностями (m:ss, formatDuration).
 *  4. Клик по главе запускает воспроизведение: появляется GlobalPlayer
 *     (PlayerBar: «Пауза»/«Следующий» + заголовок главы), строка главы играет.
 *
 * В тесте с воспроизведением включается фикстура `audio` (герметичный
 * HTMLMediaElement из fixtures/mocks.ts). Селекторы — роли/aria-label/тексты,
 * без CSS-классов.
 */

import { test, expect } from './catalog.fixtures';
import { MOCK_CATALOG } from '../fixtures/data';
import { formatDuration } from '../../src/lib/html-audio';

const BOOK = MOCK_CATALOG;
const VOLUME_1 = BOOK.volumes.find((v) => v.id === 'book-1-vol-1')!;
const VOLUME_2 = BOOK.volumes.find((v) => v.id === 'book-1-vol-2')!;

test.describe('Каталог: страница книги /books/book-1', () => {
	test.beforeEach(async ({ catalog }) => {
		void catalog;
	});

	test('рендерит заголовок книги и список томов (сетка по умолчанию)', async ({ bookPage }) => {
		await bookPage.goto(BOOK.id);

		// Заголовок книги из MOCK_CATALOG
		await expect(bookPage.titleHeading(BOOK.title)).toBeVisible();

		// Оба тома: бейдж «Том N» + название тома
		await expect(bookPage.volumeBadge(VOLUME_1.volumeNumber)).toBeVisible();
		await expect(bookPage.volumeBadge(VOLUME_2.volumeNumber)).toBeVisible();
		await expect(bookPage.volumeTitleHeading(VOLUME_1.title)).toBeVisible();
		await expect(bookPage.volumeTitleHeading(VOLUME_2.title)).toBeVisible();
	});

	test('переключатель «Сетка»/«Список» переключает вид списка томов', async ({ bookPage }) => {
		await bookPage.goto(BOOK.id);
		await expect(bookPage.volumeTitleHeading(VOLUME_1.title)).toBeVisible();

		const volumeDescription = bookPage.volumeDescription(VOLUME_1.description!);

		// По умолчанию «Сетка» — описания томов не рендерятся
		await expect(volumeDescription).toHaveCount(0);

		// «Список» — появляются описания обоих томов
		await bookPage.switchView('Список');
		await expect(volumeDescription).toBeVisible();
		await expect(bookPage.volumeDescription(VOLUME_2.description!)).toBeVisible();

		// Обратно в «Сетку» — описания снова скрыты
		await bookPage.switchView('Сетка');
		await expect(volumeDescription).toHaveCount(0);
	});
});

test.describe('Каталог: страница тома /books/book-1/book-1-vol-1', () => {
	test.beforeEach(async ({ catalog }) => {
		void catalog;
	});

	test('переход на том рендерит главы с названиями и длительностями m:ss', async ({
		volumePage
	}) => {
		await volumePage.goto(BOOK.id, VOLUME_1.id);

		// Заголовок тома и заголовок секции глав
		await expect(volumePage.heading(VOLUME_1.title)).toBeVisible();
		await expect(volumePage.listHeading).toBeVisible();

		// Каждая глава: кнопка «Воспроизвести: <название>» и длительность m:ss
		for (const chapter of VOLUME_1.chapters) {
			await expect(volumePage.playButton(chapter.title)).toBeVisible();
			await expect(
				volumePage.page.getByText(formatDuration(chapter.durationSeconds), { exact: true })
			).toBeVisible();
		}

		// Главы другого тома на этой странице отсутствуют
		await expect(volumePage.playButton(VOLUME_2.chapters[0].title)).toHaveCount(0);
	});

	test('клик по главе запускает воспроизведение: появляется GlobalPlayer', async ({
		catalog,
		audio,
		volumePage,
		playerBar
	}) => {
		// Фикстуры включаются «перечислением»: catalog мокает /api/books/**,
		// audio — герметичный HTMLMediaElement (см. mockAudio в fixtures/mocks.ts).
		void catalog;
		void audio;
		await volumePage.goto(BOOK.id, VOLUME_1.id);

		const chapter = VOLUME_1.chapters[1]; // «Листопад»
		await expect(volumePage.playButton(chapter.title)).toBeVisible();
		await volumePage.play(chapter.title);

		// GlobalPlayer появился и играет: кнопка play/pause показывает «Пауза»,
		// доступна навигация «Следующий»
		await expect(playerBar.pauseButton).toBeVisible();
		await expect(playerBar.skipForward).toBeVisible();

		// Строка главы переключилась в состояние «играет»
		await expect(volumePage.pauseChapterButton(chapter.title)).toBeVisible();

		// Заголовок главы показан в GlobalPlayer (текст десктоп-бара плеера; тот же
		// текст есть в alt обложки и в скрытой мобильной мини-панели — .first())
		await expect(playerBar.nowPlayingTitle(chapter.title)).toBeVisible();
	});
});
