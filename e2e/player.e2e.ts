import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/test';
import { MOCK_CATALOG } from './fixtures/data';
import { openPage } from './fixtures/utils';

/**
 * E2E: аудиоплеер (GlobalPlayer) на странице тома /books/book-1/book-1-vol-1.
 *
 * Фикстуры: `catalog` (мок /api/books/** на MOCK_CATALOG) + `audio` («герметичный»
 * HTMLMediaElement из fixtures/mocks.ts: load()/src/pause() — no-op, play()
 * эмитит 'play'/'playing'). Состояние плеера (isPlaying) ведёт audioStore и не
 * зависит от нестабильного реального медиа-пайплайна (сеть/декодер).
 *
 * Покрытие:
 *  1. После клика по главе появляется GlobalPlayer с заголовком главы.
 *  2. Кнопка play/pause переключает состояние («Пауза» ↔ «Играть»).
 *  3. Контролы: «Предыдущий»/«Перемотать назад»/«Перемотать вперёд»/
 *     «Следующий», seek-бар (slider), TimeDisplay (два <time>), навигация
 *     между главами меняет текущий трек.
 *  4. Поповер скорости (Speed) открывается и содержит контрол сброса.
 *  5. Поповер громкости (Volume) открывается, Mute/Unmute переключается.
 *  6. Таймер сна (SleepTimer) — диалог открывается, запуск/сброс работают.
 *  7. У строки главы есть кнопка «Скачать» (Download, тултип).
 *
 * aria-label/структура сверены с src/lib/components/ui/audio/player/*
 * и src/lib/components/audio/GlobalPlayer.svelte. Кнопки Download/SleepTimer/
 * Speed/Volume не имеют текстового имени, а их data-slot-атрибуты перекрываются
 * композицией bits-ui — они адресуются по порядку внутри плеера (см.
 * playerSecondaryButtons + комментарий к нему).
 */

const BOOK = MOCK_CATALOG;
const VOLUME = BOOK.volumes.find((v) => v.id === 'book-1-vol-1')!;
const [CHAPTER_1, CHAPTER_2] = VOLUME.chapters;

const PLAY_NAME = (title: string) => `Воспроизвести: ${title}`;
const PAUSE_NAME = (title: string) => `Пауза: ${title}`;

/** Ждём список глав и запускаем воспроизведение первой главы тома. */
async function startPlayback(page: Page): Promise<void> {
	await openPage(page, `/books/${BOOK.id}/${VOLUME.id}`);
	const firstChapter = page.getByRole('button', { name: PLAY_NAME(CHAPTER_1.title), exact: true });
	await expect(firstChapter).toBeVisible();
	await firstChapter.click();
	// Воспроизведение запущено: кнопка play/pause в GlobalPlayer показывает «Пауза»
	await expect(page.getByRole('button', { name: 'Пауза', exact: true })).toBeVisible();
}

/**
 * Правая группа «вторичных» кнопок GlobalPlayer (без aria-label): Download,
 * SleepTimer, Speed, Volume — в порядке разметки ControlBar
 * (src/lib/components/audio/GlobalPlayer.svelte). Внутренние data-slot-атрибуты
 * компонентов перекрываются композицией bits-ui (data-slot="tooltip-trigger"),
 * поэтому кнопки адресуются порядком внутри плеера.
 */
function playerSecondaryButtons(page: Page) {
	return page.locator('[data-slot="audio-player"] button:not([aria-label])');
}
const SECONDARY_SLEEP_TIMER = 1;
const SECONDARY_SPEED = 2;
const SECONDARY_VOLUME = 3;

test.describe('Аудиоплеер (GlobalPlayer)', () => {
	test.beforeEach(async ({ catalog, audio }) => {
		// catalog мокает /api/books/**; audio — герметичный HTMLMediaElement
		// (см. mockAudio в fixtures/mocks.ts). Фикстуры включаются «перечислением».
		void catalog;
		void audio;
	});

	test('после клика по главе появляется GlobalPlayer с заголовком главы', async ({ page }) => {
		await startPlayback(page);

		// Кнопка play/pause в состоянии «Пауза» — трек играет
		await expect(page.getByRole('button', { name: 'Пауза', exact: true })).toBeVisible();

		// Заголовок главы и название тома показаны в GlobalPlayer (текст десктоп-бара;
		// тот же текст есть в alt обложки и в скрытой мобильной мини-панели — .first())
		const player = page.locator('[data-slot="audio-player"]');
		await expect(player.locator('p').filter({ hasText: CHAPTER_1.title }).first()).toBeVisible();
		await expect(player.locator('p').filter({ hasText: VOLUME.title }).first()).toBeVisible();
	});

	test('кнопка play/pause переключает состояние «Пауза»/«Играть»', async ({ page }) => {
		await startPlayback(page);

		const playPause = page.getByRole('button', { name: 'Пауза', exact: true });
		await playPause.click();

		// Пауза: кнопка плеера и строка главы вернулись в «не играет»
		await expect(page.getByRole('button', { name: 'Играть', exact: true })).toBeVisible();
		await expect(
			page.getByRole('button', { name: PLAY_NAME(CHAPTER_1.title), exact: true })
		).toBeVisible();

		// Повторный клик возобновляет воспроизведение
		await page.getByRole('button', { name: 'Играть', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Пауза', exact: true })).toBeVisible();
		await expect(
			page.getByRole('button', { name: PAUSE_NAME(CHAPTER_1.title), exact: true })
		).toBeVisible();
	});

	test('доступны контролы: skip-back/rewind/fast-forward/skip-forward, seek-бар, время', async ({
		page
	}) => {
		await startPlayback(page);

		// На первой главе очереди «Предыдущий» недоступен, «Следующий» — доступен
		const skipBack = page.getByRole('button', { name: 'Предыдущий', exact: true });
		const skipForward = page.getByRole('button', { name: 'Следующий', exact: true });
		await expect(skipBack).toBeDisabled();
		await expect(skipForward).toBeEnabled();

		// Перемотка: назад недоступна (currentTime = 0), вперёд доступна
		await expect(
			page.getByRole('button', { name: 'Перемотать назад', exact: true })
		).toBeDisabled();
		await expect(
			page.getByRole('button', { name: 'Перемотать вперёд', exact: true })
		).toBeEnabled();

		// Seek-бар (range-slider) и два TimeDisplay (текущее время и остаток)
		await expect(page.getByRole('slider')).toBeVisible();
		await expect(page.locator('time[data-slot="audio-time-display"]')).toHaveCount(2);

		// Навигация вперёд: играет вторая глава
		await skipForward.click();
		await expect(
			page.getByRole('button', { name: PAUSE_NAME(CHAPTER_2.title), exact: true })
		).toBeVisible();
		await expect(skipBack).toBeEnabled();

		// Навигация назад: снова первая глава, «Предыдущий» снова недоступен
		await skipBack.click();
		await expect(
			page.getByRole('button', { name: PAUSE_NAME(CHAPTER_1.title), exact: true })
		).toBeVisible();
		await expect(skipBack).toBeDisabled();
	});

	test('поповер скорости (Speed) открывается и содержит контрол сброса', async ({ page }) => {
		await startPlayback(page);

		const speedButton = playerSecondaryButtons(page).nth(SECONDARY_SPEED);
		await expect(speedButton).toBeVisible();
		await speedButton.click();

		// Внутри меню: текущая скорость и кнопки сброса на 100%
		const resetSpeedButtons = page.getByRole('button', { name: 'Сбросить скорость на 100%' });
		await expect(resetSpeedButtons.first()).toBeVisible();
		await expect(resetSpeedButtons).toHaveCount(2);
	});

	test('поповер громкости (Volume) открывается и Mute/Unmute переключается', async ({ page }) => {
		await startPlayback(page);

		const volumeButton = playerSecondaryButtons(page).nth(SECONDARY_VOLUME);
		await expect(volumeButton).toBeVisible();
		await volumeButton.click();

		// Внутри меню: тумблер Mute
		await expect(page.getByRole('button', { name: 'Mute', exact: true })).toBeVisible();

		// Клик переключает в немой режим
		await page.getByRole('button', { name: 'Mute', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();

		// И обратно
		await page.getByRole('button', { name: 'Unmute', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Mute', exact: true })).toBeVisible();
	});

	test('таймер сна (SleepTimer): диалог открывается, запуск и сброс работают', async ({ page }) => {
		await startPlayback(page);

		const sleepButton = playerSecondaryButtons(page).nth(SECONDARY_SLEEP_TIMER);
		await expect(sleepButton).toBeVisible();

		// Открытие диалога с ожидаемым содержимым
		await sleepButton.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText('Таймер сна')).toBeVisible();
		await expect(dialog.getByRole('button', { name: '15 мин', exact: true })).toBeVisible();
		await expect(dialog.getByRole('button', { name: '60 мин', exact: true })).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Запустить', exact: true })).toBeVisible();

		// Выбираем 15 минут и запускаем таймер
		await dialog.getByRole('button', { name: '15 мин', exact: true }).click();
		await dialog.getByRole('button', { name: 'Запустить', exact: true }).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);

		// Таймер активен: повторное открытие показывает сброс/обновление
		await sleepButton.click();
		const dialogAfterStart = page.getByRole('dialog');
		await expect(dialogAfterStart).toBeVisible();
		await expect(dialogAfterStart.getByRole('button', { name: 'Сбросить таймер' })).toBeVisible();
		await expect(dialogAfterStart.getByRole('button', { name: 'Обновить таймер' })).toBeVisible();

		// Сбрасываем таймер — диалог закрывается
		await dialogAfterStart.getByRole('button', { name: 'Сбросить таймер' }).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});

	test('у строки главы есть кнопка «Скачать» (Download) с тултипом', async ({ page }) => {
		await openPage(page, `/books/${BOOK.id}/${VOLUME.id}`);

		// В строке главы ровно две кнопки: воспроизведение и скачивание
		const chapterRow = page
			.getByRole('button', { name: PLAY_NAME(CHAPTER_1.title), exact: true })
			.locator('..');
		await expect(chapterRow.getByRole('button')).toHaveCount(2);

		// Hover по кнопке скачивания показывает тултип офлайн-загрузки
		await chapterRow.getByRole('button').nth(1).hover();
		await expect(page.getByText('Скачать для прослушивания оффлайн')).toBeVisible();
	});
});
