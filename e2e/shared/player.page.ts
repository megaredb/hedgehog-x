/**
 * Page Object «закреплённый плеер» (GlobalPlayer) — GlobalPlayer.svelte,
 * присутствует на каждой странице, но виден только когда в очереди audioStore
 * есть треки (audioStore.queue.length > 0). Десктоп-бар (>=768px) и мобильный
 * drawer (<768px) строятся из одних и тех же компонентов ui/audio/player/*.
 *
 * Селекторы — по ролям/aria-label/data-slot (сверено с GlobalPlayer.svelte и
 * ui/audio/player/*; рабочие локаторы перенесены из player.e2e.ts / catalog.e2e.ts).
 * Содержит только селекторы/действия, ассерты остаются в тестах.
 */

import type { Locator, Page } from '@playwright/test';

/**
 * Правая группа «вторичных» кнопок GlobalPlayer без aria-label: Download,
 * SleepTimer, Speed, Volume — в порядке разметки ControlBar (GlobalPlayer.svelte).
 * Внутренние data-slot перекрываются композицией bits-ui, поэтому кнопки
 * адресуются порядком внутри плеера.
 */
const SECONDARY_SLEEP_TIMER = 1;
const SECONDARY_SPEED = 2;
const SECONDARY_VOLUME = 3;

export class PlayerBar {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// ─── Корень плеера ──────────────────────────────────────────────────────────

	/** Корень GlobalPlayer ([data-slot=audio-player]) — бар/дровер плеера. */
	get root(): Locator {
		return this.page.locator('[data-slot="audio-player"]');
	}

	/** Заголовок текущего трека в плеере (первый <p> десктоп-бара). */
	nowPlayingTitle(title: string): Locator {
		return this.root.locator('p').filter({ hasText: title }).first();
	}

	// ─── Кнопки воспроизведения (имеют aria-label) ──────────────────────────────

	/** Кнопка play/pause (aria-label зависит от состояния: «Играть»/«Пауза»). */
	playPause(): Locator {
		return this.page.getByRole('button', { name: /^(Играть|Пауза)$/, exact: true });
	}

	/** Кнопка «Пауза» (трек играет). */
	get pauseButton(): Locator {
		return this.page.getByRole('button', { name: 'Пауза', exact: true });
	}

	/** Кнопка «Играть» (трек на паузе). */
	get playButton(): Locator {
		return this.page.getByRole('button', { name: 'Играть', exact: true });
	}

	/** Переключить play/pause. */
	async togglePlay(): Promise<void> {
		await this.playPause().click();
	}

	/** Кнопка «Предыдущий» (skip-back). */
	get skipBack(): Locator {
		return this.page.getByRole('button', { name: 'Предыдущий', exact: true });
	}

	/** Кнопка «Следующий» (skip-forward). */
	get skipForward(): Locator {
		return this.page.getByRole('button', { name: 'Следующий', exact: true });
	}

	/** Кнопка «Перемотать назад» (rewind, -10с). */
	get rewind(): Locator {
		return this.page.getByRole('button', { name: 'Перемотать назад', exact: true });
	}

	/** Кнопка «Перемотать вперёд» (fast-forward, +10с). */
	get fastForward(): Locator {
		return this.page.getByRole('button', { name: 'Перемотать вперёд', exact: true });
	}

	// ─── Seek-бар и время ───────────────────────────────────────────────────────

	/** Seek-бар (range-slider) в плеере. */
	get seekBar(): Locator {
		return this.page.getByRole('slider');
	}

	/** Текущее время и остаток (два <time data-slot="audio-time-display">). */
	get timeDisplays(): Locator {
		return this.page.locator('time[data-slot="audio-time-display"]');
	}

	// ─── Вторичные кнопки: громкость / скорость / таймер сна ───────────────────

	/** Открыть поповер скорости (Speed). */
	async openSpeed(): Promise<void> {
		await this.secondary(SECONDARY_SPEED).click();
	}

	/** Открыть поповер громкости (Volume). */
	async openVolume(): Promise<void> {
		await this.secondary(SECONDARY_VOLUME).click();
	}

	/** Открыть диалог таймера сна (SleepTimer). Возвращает диалог. */
	async openSleepTimer(): Promise<Locator> {
		await this.secondary(SECONDARY_SLEEP_TIMER).click();
		return this.page.getByRole('dialog');
	}

	/**
	 * N-я вторичная кнопка плеера (без aria-label) внутри корня — см. константы
	 * SECONDARY_* и комментарий к ним.
	 */
	secondary(index: number): Locator {
		return this.root.locator('button:not([aria-label])').nth(index);
	}

	// ─── Кнопка «Скачать» в плеере ──────────────────────────────────────────────

	/**
	 * Кнопка «Скачать» GlobalPlayer (Download) — первая из вторичных кнопок
	 * (индекс 0) без aria-label. Тултип зависит от статуса загрузки.
	 */
	get download(): Locator {
		return this.secondary(0);
	}
}
