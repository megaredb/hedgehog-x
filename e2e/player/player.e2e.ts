/**
 * E2E: аудиоплеер (GlobalPlayer) на странице тома /books/book-1/book-1-vol-1 —
 * новый стиль: контроль плеера через общий PlayerBar (e2e/shared/player.page.ts),
 * очередь глава → GlobalPlayer настраивается через VolumePage (e2e/catalog/
 * volume.page.ts) — см. фикстуры player.fixtures.ts.
 *
 * Фикстуры: `catalog` (мок /api/books/** на MOCK_CATALOG) + `audio` («герметичный»
 * HTMLMediaElement из fixtures/mocks.ts: load()/src/pause() — no-op, play()
 * эмитит 'play'/'playing'). Состояние плеера (isPlaying) ведёт audioStore и не
 * зависит от нестабильного реального медиа-пайплайна (сеть/декодер).
 *
 * Покрытие перенесено из удалённого плоского e2e/player.e2e.ts без потери ни
 * одного ассерта:
 *  1. После клика по главе появляется GlobalPlayer с заголовком главы/тома.
 *  2. Кнопка play/pause переключает состояние («Пауза» ↔ «Играть»).
 *  3. Контролы: skip-back/rewind/fast-forward/skip-forward, seek-бар, TimeDisplay.
 *  4. Поповер скорости (Speed) открывается и содержит контрол сброса.
 *  5. Поповер громкости (Volume) открывается, Mute/Unmute переключается.
 *  6. Таймер сна (SleepTimer) — диалог открывается, запуск/сброс работают.
 *  7. У строки главы есть кнопка «Скачать» (Download, тултип).
 */

import { test, expect } from './player.fixtures';
import type { PlayerBar } from '../shared/player.page';
import type { VolumePage } from '../catalog/volume.page';
import { MOCK_CATALOG } from '../fixtures/data';

const BOOK = MOCK_CATALOG;
const VOLUME = BOOK.volumes.find((v) => v.id === 'book-1-vol-1')!;
const [CHAPTER_1, CHAPTER_2] = VOLUME.chapters;

/**
 * Общий шаг: открыть страницу тома и запустить воспроизведение первой главы
 * → у GlobalPlayer (PlayerBar) появляется кнопка «Пауза» (трек играет).
 */
async function startPlayback(volumePage: VolumePage, player: PlayerBar): Promise<void> {
	await volumePage.goto(BOOK.id, VOLUME.id);
	await volumePage.play(CHAPTER_1.title);
	await expect(player.pauseButton).toBeVisible();
}

test.describe('Аудиоплеер (GlobalPlayer)', () => {
	test.beforeEach(async ({ catalog, audio }) => {
		// catalog мокает /api/books/**; audio — герметичный HTMLMediaElement
		// (см. mockAudio в fixtures/mocks.ts). Фикстуры включаются «перечислением».
		void catalog;
		void audio;
	});

	test('после клика по главе появляется GlobalPlayer с заголовком главы', async ({
		volumePage,
		playerBar
	}) => {
		await startPlayback(volumePage, playerBar);

		// Кнопка play/pause в состоянии «Пауза» — трек играет
		await expect(playerBar.pauseButton).toBeVisible();

		// Заголовок главы и название тома показаны в GlobalPlayer (текст десктоп-бара;
		// тот же текст есть в alt обложки и в скрытой мобильной мини-панели — .first())
		await expect(playerBar.nowPlayingTitle(CHAPTER_1.title)).toBeVisible();
		await expect(playerBar.nowPlayingTitle(VOLUME.title)).toBeVisible();
	});

	test('кнопка play/pause переключает состояние «Пауза»/«Играть»', async ({
		volumePage,
		playerBar
	}) => {
		await startPlayback(volumePage, playerBar);

		// Пауза: кнопка плеера и строка главы вернулись в «не играет»
		await playerBar.togglePlay();
		await expect(playerBar.playButton).toBeVisible();
		await expect(volumePage.playButton(CHAPTER_1.title)).toBeVisible();

		// Повторный клик возобновляет воспроизведение
		await playerBar.togglePlay();
		await expect(playerBar.pauseButton).toBeVisible();
		await expect(volumePage.pauseChapterButton(CHAPTER_1.title)).toBeVisible();
	});

	test('доступны контролы: skip-back/rewind/fast-forward/skip-forward, seek-бар, время', async ({
		volumePage,
		playerBar
	}) => {
		await startPlayback(volumePage, playerBar);

		// На первой главе очереди «Предыдущий» недоступен, «Следующий» — доступен
		await expect(playerBar.skipBack).toBeDisabled();
		await expect(playerBar.skipForward).toBeEnabled();

		// Перемотка: назад недоступна (currentTime = 0), вперёд доступна
		await expect(playerBar.rewind).toBeDisabled();
		await expect(playerBar.fastForward).toBeEnabled();

		// Seek-бар (range-slider) и два TimeDisplay (текущее время и остаток)
		await expect(playerBar.seekBar).toBeVisible();
		await expect(playerBar.timeDisplays).toHaveCount(2);

		// Навигация вперёд: играет вторая глава
		await playerBar.skipForward.click();
		await expect(volumePage.pauseChapterButton(CHAPTER_2.title)).toBeVisible();
		await expect(playerBar.skipBack).toBeEnabled();

		// Навигация назад: снова первая глава, «Предыдущий» снова недоступен
		await playerBar.skipBack.click();
		await expect(volumePage.pauseChapterButton(CHAPTER_1.title)).toBeVisible();
		await expect(playerBar.skipBack).toBeDisabled();
	});

	test('поповер скорости (Speed) открывается и содержит контрол сброса', async ({
		page,
		volumePage,
		playerBar
	}) => {
		await startPlayback(volumePage, playerBar);

		await playerBar.openSpeed();

		// Внутри меню: текущая скорость и кнопки сброса на 100%
		const resetSpeedButtons = page.getByRole('button', { name: 'Сбросить скорость на 100%' });
		await expect(resetSpeedButtons.first()).toBeVisible();
		await expect(resetSpeedButtons).toHaveCount(2);
	});

	test('поповер громкости (Volume) открывается и Mute/Unmute переключается', async ({
		page,
		volumePage,
		playerBar
	}) => {
		await startPlayback(volumePage, playerBar);

		await playerBar.openVolume();

		// Внутри меню: тумблер Mute
		const mute = page.getByRole('button', { name: 'Mute', exact: true });
		const unmute = page.getByRole('button', { name: 'Unmute', exact: true });
		await expect(mute).toBeVisible();

		// Клик переключает в немой режим
		await mute.click();
		await expect(unmute).toBeVisible();

		// И обратно
		await unmute.click();
		await expect(mute).toBeVisible();
	});

	test('таймер сна (SleepTimer): диалог открывается, запуск и сброс работают', async ({
		page,
		volumePage,
		playerBar
	}) => {
		await startPlayback(volumePage, playerBar);

		// Открытие диалога с ожидаемым содержимым
		const dialog = await playerBar.openSleepTimer();
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
		const dialogAfterStart = await playerBar.openSleepTimer();
		await expect(dialogAfterStart).toBeVisible();
		await expect(dialogAfterStart.getByRole('button', { name: 'Сбросить таймер' })).toBeVisible();
		await expect(dialogAfterStart.getByRole('button', { name: 'Обновить таймер' })).toBeVisible();

		// Сбрасываем таймер — диалог закрывается
		await dialogAfterStart.getByRole('button', { name: 'Сбросить таймер' }).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});

	test('у строки главы есть кнопка «Скачать» (Download) с тултипом', async ({
		page,
		volumePage
	}) => {
		await volumePage.goto(BOOK.id, VOLUME.id);

		// В строке главы ровно две кнопки: воспроизведение и скачивание
		const chapterRow = volumePage.chapterRow(CHAPTER_1.title);
		await expect(chapterRow).toBeVisible();
		await expect(chapterRow.getByRole('button')).toHaveCount(2);

		// Hover по кнопке скачивания показывает тултип офлайн-загрузки
		await chapterRow.getByRole('button').nth(1).hover();
		await expect(page.getByText('Скачать для прослушивания оффлайн')).toBeVisible();
	});
});
