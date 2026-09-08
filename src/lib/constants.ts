/**
 * Общие константы проекта, безопасные для импорта и на клиенте, и на сервере,
 * и в service worker (никаких секретов и обращения к окружению).
 *
 * Server-only константы (env-overridable, Boosty-эндпоинты) — в
 * `src/lib/server/config.ts`.
 */

// ─── CacheStorage / Service Worker ───────────────────────────────────────────
export const PAGES_CACHE = 'pages-cache';
export const AUDIO_CACHE = 'audio-cache';

// ─── IndexedDB (Dexie) ───────────────────────────────────────────────────────
export const HEDGEHOG_DB_NAME = 'HedgehogDB';

// ─── localStorage ────────────────────────────────────────────────────────────
export const AUDIO_UI_STORE_KEY = 'audio:ui:store';
export const VIDEO_BG_STORE_KEY = 'videoBackgroundPlaying';

// ─── Аудиоплеер ──────────────────────────────────────────────────────────────
/** Таймаут загрузки обычного трека. */
export const AUDIO_LOAD_TIMEOUT_NORMAL_MS = 30_000;
/** Таймаут загрузки live-потока. */
export const AUDIO_LOAD_TIMEOUT_LIVE_MS = 60_000;
/** Количество внутренних ретраев загрузки аудио. */
export const AUDIO_LOAD_MAX_RETRIES = 3;
/** Интервал плавного изменения громкости. */
export const AUDIO_FADE_INTERVAL_MS = 16;
/** Интервал сохранения прогресса в Dexie. */
export const PROGRESS_SAVE_INTERVAL_MS = 5_000;
/** Границы скорости воспроизведения. */
export const PLAYBACK_RATE_MIN = 0.25;
export const PLAYBACK_RATE_MAX = 2;
/** Порог (сек): при `currentTime` больше этого значения `previous()` перематывает к началу. */
export const REWIND_THRESHOLD_SEC = 3;
/** Тик обратного отсчёта sleep-таймера. */
export const SLEEP_TIMER_TICK_MS = 1_000;
/** Максимум ретраев восстановления воспроизведения после ошибки (AudioProvider). */
export const PLAYBACK_ERROR_MAX_RETRIES = 3;
/** Базовая задержка ретрая восстановления воспроизведения (экспоненциальная). */
export const PLAYBACK_RETRY_BASE_DELAY_MS = 1_000;
/** Троттлинг обработчика `timeupdate`. */
export const TIME_UPDATE_THROTTLE_MS = 100;
/** Минимальная дельта времени (сек) для обновления store из `timeupdate`. */
export const TIME_UPDATE_MIN_DELTA_SEC = 0.5;

/** Ограничить скорость воспроизведения допустимым диапазоном. */
export function clampPlaybackRate(rate: number): number {
	return Math.max(PLAYBACK_RATE_MIN, Math.min(PLAYBACK_RATE_MAX, rate));
}

// ─── Загрузки (офлайн-аудио) ─────────────────────────────────────────────────
/** Резерв свободного места перед скачиванием (50 МБ). */
export const DOWNLOAD_STORAGE_RESERVE_BYTES = 50 * 1024 * 1024;

// ─── Внешние ссылки ──────────────────────────────────────────────────────────
/** Публичная ссылка на блог HEDGEHOG.INC в Boosty (для страниц). */
export const BOOSTY_BLOG_PUBLIC_URL = 'https://boosty.to/hedgehoginc';
