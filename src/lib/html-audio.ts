import {
	AUDIO_CACHE,
	AUDIO_FADE_INTERVAL_MS,
	AUDIO_LOAD_MAX_RETRIES,
	AUDIO_LOAD_TIMEOUT_LIVE_MS,
	AUDIO_LOAD_TIMEOUT_NORMAL_MS,
	clampPlaybackRate
} from '$lib/constants';

export type Track = {
	id?: string | number;
	url: string;
	title?: string;
	artist?: string;
	artwork?: string;
	images?: string[];
	duration?: number;
	album?: string;
	/** Real volume ID (UUID) — separate from album title */
	volumeId?: string;
	/** Book ID (UUID) — for building navigation links */
	bookId?: string;
	genre?: string;
	live?: boolean;
	/** Start playback from this position in seconds (used for resume) */
	startTime?: number;
	[key: string]: unknown;
};

type LoadParams = {
	url: string;
	id?: string | number;
	startTime?: number;
	isLiveStream?: boolean;
};

type SetVolumeParams = {
	volume: number;
	fadeTime?: number;
};

type FadeVolumeParams = {
	audio: HTMLAudioElement;
	targetVolume: number;
	duration: number;
};

/**
 * Приводит URL к абсолютному виду. Нужно для корректного сравнения
 * `audio.src` (браузер всегда нормализует в абсолютный URL) с исходным
 * значением, которое может быть относительным путём.
 */
function normalizeAudioUrl(url: string): string {
	try {
		return new URL(url, location.origin).href;
	} catch {
		return url;
	}
}

/**
 * WebKit/Safari (включая iOS Safari) игнорирует `preload='metadata'` и скачивает
 * весь файл с нулевого байта. Seek по `loadedmetadata` тогда прервёт текущий
 * поток и откроет третий range-запрос с позиции seek. Определяем этот движок,
 * чтобы при resume отложить seek до момента, пока буфер уже покрывает позицию.
 */
function isWebKitSafari(): boolean {
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent;
	return (
		/AppleWebKit\//.test(ua) &&
		!/(Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|OPiOS|Firefox|FxiOS)\//.test(ua)
	);
}

/** Интервал опроса, пока ожидаем, что отложенный seek попадёт в буфер. */
const DEFERRED_SEEK_POLL_INTERVAL_MS = 50;

class HtmlAudio {
	private audio: HTMLAudioElement | null = null;
	private isInitialized = false;
	private playPromise: Promise<void> | null = null;
	private lastVolume = 1;
	private fadeTimeout: ReturnType<typeof setTimeout> | null = null;
	private retryAttempts = 0;
	private readonly maxRetries = AUDIO_LOAD_MAX_RETRIES;
	private readonly eventTarget = new EventTarget();
	/**
	 * Активный отложенный seek (resume в WebKit/Safari): хранит функцию очистки
	 * слушателя `progress` и целевую позицию, чтобы `_play` мог дождаться
	 * применения seek перед вызовом `audio.play()`.
	 */
	private deferredSeek: { cleanup: () => void; startTime: number } | null = null;

	init(): void {
		if (this.isInitialized || !this.isClient()) return;
		this.isInitialized = true;
		if (this.isClient()) {
			this.audio = new Audio();
			this.setupEventListeners();
		}
	}

	private setupEventListeners(): void {
		if (!this.isClient()) return;
		const audio = this.ensureAudio();
		if (!audio) return;

		audio.addEventListener('error', () => {
			if (this.retryAttempts < this.maxRetries) {
				this.retryAttempts++;
				setTimeout(() => this.reloadAudio(), 1000);
			}
			this.eventTarget.dispatchEvent(new CustomEvent('audioError'));
		});

		audio.addEventListener('playing', () => {
			this.retryAttempts = 0;
			this.eventTarget.dispatchEvent(new CustomEvent('bufferingEnd'));
			this.eventTarget.dispatchEvent(new CustomEvent('playbackStarted'));
		});

		audio.addEventListener('canplaythrough', () => {
			this.retryAttempts = 0;
			this.eventTarget.dispatchEvent(new CustomEvent('bufferingEnd'));
		});

		audio.addEventListener('waiting', () => {
			this.eventTarget.dispatchEvent(new CustomEvent('bufferingStart'));
		});

		audio.addEventListener('progress', () => {
			const buffered = audio.buffered;
			const currentTime = audio.currentTime;
			let bufferedEnd = 0;
			if (buffered.length === 0) return;

			for (let i = buffered.length - 1; i >= 0; i--) {
				if (buffered.start(i) <= currentTime) {
					bufferedEnd = buffered.end(i);
					break;
				}
			}
			if (bufferedEnd === 0) bufferedEnd = buffered.end(0);
			if (bufferedEnd > 0) {
				this.eventTarget.dispatchEvent(
					new CustomEvent('bufferUpdate', { detail: { bufferedTime: bufferedEnd } })
				);
			}
		});
	}

	private currentBlobUrl: string | null = null;

	/** Убирает слушатель `progress` отложенного seek, если он активен. */
	private clearDeferredSeek(): void {
		if (this.deferredSeek) {
			this.deferredSeek.cleanup();
			this.deferredSeek = null;
		}
	}

	/** True, когда заданное время уже покрыто буферизованным диапазоном. */
	private isTimeBuffered(audio: HTMLAudioElement, time: number): boolean {
		const buffered = audio.buffered;
		for (let i = 0; i < buffered.length; i++) {
			if (buffered.start(i) <= time && time <= buffered.end(i)) return true;
		}
		return false;
	}

	/**
	 * Регистрирует отложенный seek: вместо seek по `loadedmetadata` (который в
	 * WebKit/Safari прерывает текущую загрузку с нулевого байта и вызывает третий
	 * range-запрос) ждём, пока `audio.buffered` покроет `startTime`, и только тогда
	 * делаем seek. Слушатель живёт дольше промиса загрузки и снимается через
	 * `clearDeferredSeek()` при следующей загрузке, очистке или ошибке.
	 */
	private setupDeferredSeek(audio: HTMLAudioElement, startTime: number): void {
		this.clearDeferredSeek();
		const applySeek = () => {
			if (!this.isTimeBuffered(audio, startTime)) return;
			audio.currentTime = startTime;
			this.clearDeferredSeek();
		};
		this.deferredSeek = {
			startTime,
			cleanup: () => {
				audio.removeEventListener('progress', applySeek);
			}
		};
		audio.addEventListener('progress', applySeek);
		// Буфер может уже покрывать позицию к моменту, когда метаданные загрузились.
		applySeek();
	}

	/**
	 * Ждёт применения активного отложенного seek перед началом воспроизведения,
	 * чтобы воспроизведение не началось с 0 и не прыгнуло. Ограничено `timeoutMs`;
	 * по таймауту seek выполняется принудительно (возврат к прежнему поведению).
	 */
	private async waitForDeferredSeek(timeoutMs: number): Promise<void> {
		if (!this.deferredSeek) return;
		const deadline = Date.now() + timeoutMs;
		while (this.deferredSeek && Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, DEFERRED_SEEK_POLL_INTERVAL_MS));
		}
		if (this.deferredSeek && this.audio) {
			this.audio.currentTime = this.deferredSeek.startTime;
			this.clearDeferredSeek();
		}
	}

	cleanup(): void {
		this.clearDeferredSeek();
		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
			this.audio.load();
		}
		if (this.fadeTimeout) {
			clearTimeout(this.fadeTimeout);
			this.fadeTimeout = null;
		}
		if (this.currentBlobUrl) {
			URL.revokeObjectURL(this.currentBlobUrl);
			this.currentBlobUrl = null;
		}
		this.playPromise = null;
	}

	getAudioElement(): HTMLAudioElement | null {
		if (!this.isClient()) return null;
		return this.audio;
	}

	private isClient(): boolean {
		return typeof window !== 'undefined' && !!window.document;
	}

	private ensureAudio(): HTMLAudioElement {
		if (!this.isClient()) throw new Error('Audio module not available on server side');
		if (!this.audio) throw new Error('Audio module not initialized');
		return this.audio;
	}

	private ifClient<T>(fn: () => T): T | undefined {
		if (!this.isClient()) return;
		return fn();
	}

	async load(params: LoadParams): Promise<void> {
		const { url, id, startTime = 0, isLiveStream = false } = params;
		const result = this.ifClient(() => this._load({ url, id, startTime, isLiveStream }));
		if (result) await result;
	}

	private async _load(params: {
		url: string;
		id?: string | number;
		startTime: number;
		isLiveStream: boolean;
	}): Promise<void> {
		const { url, id, startTime, isLiveStream } = params;
		const audio = this.ensureAudio();
		if (!audio) return;

		// Для resume с сохранённой позиции на не-live потоке требуется seek.
		const needsSeek = startTime > 0 && !isLiveStream;
		// WebKit/Safari игнорирует `preload='metadata'` и продолжает загрузку с
		// нулевого байта, поэтому seek по `loadedmetadata` прервёт этот поток и
		// откроет третий range-запрос. Откладываем seek, пока буфер не покроет позицию.
		const deferSeekUntilBuffered = needsSeek && isWebKitSafari();

		// Сбрасываем отложенный seek, оставшийся от предыдущей загрузки, перед перенастройкой.
		this.clearDeferredSeek();

		try {
			this.retryAttempts = 0;

			let finalUrl = url;
			if (!isLiveStream && id) {
				const idStr = String(id);
				try {
					const opfsRoot = await navigator.storage.getDirectory();
					const fileHandle = await opfsRoot.getFileHandle(idStr);
					const file = await fileHandle.getFile();
					finalUrl = URL.createObjectURL(file);
				} catch (err) {
					// Fallback to checking legacy CacheStorage (for files downloaded before OPFS migration)
					try {
						const cache = await caches.open(AUDIO_CACHE);
						const cachedResponse = await cache.match(url, { ignoreSearch: true, ignoreVary: true });
						if (cachedResponse) {
							const blob = await cachedResponse.blob();
							finalUrl = URL.createObjectURL(blob);
						}
					} catch {
						console.warn('Failed to read audio from cache/OPFS:', err);
					}
				}
			}

			// Clean up previous blob URL if we are loading a new one
			if (this.currentBlobUrl && this.currentBlobUrl !== finalUrl) {
				URL.revokeObjectURL(this.currentBlobUrl);
				this.currentBlobUrl = null;
			}
			if (finalUrl.startsWith('blob:')) {
				this.currentBlobUrl = finalUrl;
			}

			if (normalizeAudioUrl(audio.src) === normalizeAudioUrl(finalUrl)) {
				if (audio.currentTime !== startTime && !isLiveStream) audio.currentTime = startTime;
				return;
			}

			audio.pause();
			// Устанавливаем preload ДО присвоения `src` и вызова `load()`:
			// Chromium/Firefox учитывают `preload='metadata'` (метаданные + range-seek
			// по `loadedmetadata`). WebKit/Safari игнорируют `'metadata'` и продолжают
			// загрузку с нулевого байта, поэтому используем `'auto'` и откладываем seek,
			// пока данные не будут буферизованы.
			audio.preload = needsSeek && !deferSeekUntilBuffered ? 'metadata' : 'auto';
			audio.src = '';
			audio.src = finalUrl;

			const loadTimeout = isLiveStream ? AUDIO_LOAD_TIMEOUT_LIVE_MS : AUDIO_LOAD_TIMEOUT_NORMAL_MS;

			await new Promise<void>((resolve, reject) => {
				let timeoutId: ReturnType<typeof setTimeout> | null = null;
				let isResolved = false;

				const cleanup = () => {
					if (timeoutId) {
						clearTimeout(timeoutId);
						timeoutId = null;
					}
					audio.removeEventListener('loadedmetadata', handleLoadSuccess);
					audio.removeEventListener('canplay', handleLoadSuccess);
					audio.removeEventListener('canplaythrough', handleLoadSuccess);
					audio.removeEventListener('error', handleErrorLoading);
				};

				const handleTimeout = () => {
					if (isResolved) return;
					isResolved = true;
					cleanup();
					reject(new Error(`Audio load timeout (${loadTimeout / 1000}s)`));
				};

				const handleLoadSuccess = () => {
					if (isResolved) return;
					isResolved = true;
					cleanup();
					if (needsSeek && !deferSeekUntilBuffered) {
						audio.currentTime = startTime;
					} else if (deferSeekUntilBuffered) {
						this.setupDeferredSeek(audio, startTime);
					}
					resolve();
				};

				const handleErrorLoading = () => {
					if (isResolved) return;
					isResolved = true;
					cleanup();
					this.clearDeferredSeek();
					const error = audio.error;
					reject(
						new Error(`Audio load failed: ${error?.message || `code ${error?.code ?? 'unknown'}`}`)
					);
				};

				timeoutId = setTimeout(handleTimeout, loadTimeout);
				audio.addEventListener('loadedmetadata', handleLoadSuccess);
				audio.addEventListener('canplay', handleLoadSuccess);
				audio.addEventListener('canplaythrough', handleLoadSuccess);
				audio.addEventListener('error', handleErrorLoading);
				audio.load();
			});
		} catch (error) {
			console.error('Audio load process error:', error);
			throw error;
		}
	}

	async play(): Promise<void> {
		const result = this.ifClient(() => this._play());
		if (result) await result;
	}

	private async _play(): Promise<void> {
		if (!this.audio) throw new Error('Audio module not initialized');
		try {
			if (!this.audio.paused) return;
			// Для отложенного seek (resume в WebKit/Safari) ждём его применения, чтобы
			// воспроизведение не началось с 0 и не прыгнуло. Иначе — без задержки.
			await this.waitForDeferredSeek(AUDIO_LOAD_TIMEOUT_NORMAL_MS);
			this.playPromise = this.audio.play();
			await this.playPromise;
			this.playPromise = null;
		} catch (error) {
			this.playPromise = null;
			throw error;
		}
	}

	private reloadAudio(): void {
		this.clearDeferredSeek();
		if (!this.isClient()) return;
		const audio = this.ensureAudio();
		const currentTime = audio.currentTime;
		const wasPlaying = !audio.paused;
		const currentSrc = audio.src;
		const needsSeek = currentTime > 0 && !this.isLive(audio.duration);

		audio.pause();
		audio.preload = needsSeek ? 'metadata' : 'auto';
		audio.src = '';
		audio.load();
		audio.src = currentSrc;
		audio.load();

		const setTimeAndPlay = () => {
			if (audio.readyState >= audio.HAVE_METADATA) {
				audio.currentTime = currentTime;
				if (wasPlaying) this.play().catch(() => {});
				audio.removeEventListener('loadedmetadata', setTimeAndPlay);
			}
		};
		audio.addEventListener('loadedmetadata', setTimeAndPlay);
	}

	pause(): void {
		this.ifClient(() => {
			const audio = this.ensureAudio();
			audio.pause();
		});
	}

	setVolume(params: SetVolumeParams): void {
		const { volume, fadeTime = 0 } = params;
		this.ifClient(() => {
			const audio = this.ensureAudio();
			if (this.fadeTimeout) {
				clearTimeout(this.fadeTimeout);
				this.fadeTimeout = null;
			}
			if (fadeTime <= 0) {
				audio.volume = Math.max(0, Math.min(1, volume));
				if (volume > 0) this.lastVolume = volume;
				return;
			}
			this.fadeVolume({ audio, targetVolume: volume, duration: fadeTime });
		});
	}

	private fadeVolume(params: FadeVolumeParams): void {
		const { audio, targetVolume, duration } = params;
		if (!this.isClient()) return;
		const startVolume = audio.volume;
		const endVolume = Math.max(0, Math.min(1, targetVolume));
		const startTime = performance.now();

		const updateVolume = () => {
			const elapsed = performance.now() - startTime;
			const progress = Math.min(1, elapsed / duration);
			audio.volume = startVolume + (endVolume - startVolume) * progress;
			if (progress < 1) {
				this.fadeTimeout = setTimeout(updateVolume, AUDIO_FADE_INTERVAL_MS);
			} else {
				if (endVolume > 0) this.lastVolume = endVolume;
				this.fadeTimeout = null;
			}
		};
		updateVolume();
	}

	setMuted(muted: boolean): void {
		this.ifClient(() => {
			const audio = this.ensureAudio();
			if (audio.muted === muted) return;
			if (muted) {
				if (audio.volume > 0) this.lastVolume = audio.volume;
				this.fadeVolume({ audio, targetVolume: 0, duration: 200 });
				audio.muted = true;
			} else {
				audio.muted = false;
				this.fadeVolume({ audio, targetVolume: this.lastVolume, duration: 200 });
			}
		});
	}

	setCurrentTime(time: number): void {
		this.ifClient(() => {
			const audio = this.ensureAudio();
			const duration = audio.duration;
			if (this.isLive(duration)) return;
			const validTime =
				time >= 0 && time <= duration ? time : Math.max(0, Math.min(time, duration));
			if (audio.readyState >= audio.HAVE_METADATA) audio.currentTime = validTime;
		});
	}

	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions
	): void {
		this.eventTarget.addEventListener(type, listener, options);
	}

	removeEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: EventListenerOptions | boolean
	): void {
		this.eventTarget.removeEventListener(type, callback, options);
	}

	setPlaybackRate(rate: number): void {
		this.ifClient(() => {
			const audio = this.ensureAudio();
			if (this.isLive(audio.duration)) return;
			audio.playbackRate = clampPlaybackRate(rate);
		});
	}

	isLive(duration: number): boolean {
		if (duration === 0) return false;
		return (
			Number.isNaN(duration) ||
			duration === Number.POSITIVE_INFINITY ||
			duration === Number.NEGATIVE_INFINITY
		);
	}
}

export const htmlAudio = new HtmlAudio();

const MINUTE_IN_SECONDS = 60;

export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
	const minutes = Math.floor(seconds / MINUTE_IN_SECONDS);
	const remainingSeconds = Math.floor(seconds % MINUTE_IN_SECONDS);
	return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}
