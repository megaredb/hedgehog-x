import { htmlAudio, type Track } from '$lib/html-audio.js';
import { resolveMediaUrl } from '$lib/utils/mirror.js';
import { calculateNextIndex, calculatePreviousIndex, type RepeatMode } from '$lib/audio-queue.js';
import { db } from '$lib/client/db';
import { audioVersionKey, broadcastProgressKey, normalizeVersionId } from '$lib/audio-version';

export type { RepeatMode } from '$lib/audio-queue.js';
export { calculateNextIndex, calculatePreviousIndex } from '$lib/audio-queue.js';
import {
	parseSeekStep,
	parsePlaybackRate,
	parseAutoAdvance,
	isValidPlaybackRate
} from '$lib/settings/values';

import {
	SEEK_STEP_STORAGE_KEY,
	AUTO_ADVANCE_STORAGE_KEY,
	PLAYBACK_RATE_STORAGE_KEY,
	WAKE_LOCK_STORAGE_KEY
} from '$lib/constants/settings';
export {
	SEEK_STEP_STORAGE_KEY,
	AUTO_ADVANCE_STORAGE_KEY,
	PLAYBACK_RATE_STORAGE_KEY,
	WAKE_LOCK_STORAGE_KEY
};

// ─── Helper functions ────────────────────────────────────────────────────────

export function canUseDOM(): boolean {
	return typeof window !== 'undefined' && !!window.document?.createElement;
}

// ─── Store ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'audio:ui:store';

class AudioStore {
	// ── Reactive state ──────────────────────────────────────────────────────
	currentTrack: Track | null = $state(null);
	queue: Track[] = $state([]);
	isPlaying = $state(false);
	isLoading = $state(false);
	isBuffering = $state(false);
	volume = $state(1);
	isMuted = $state(false);
	playbackRate = $state(1);
	repeatMode: RepeatMode = $state('none');
	shuffleEnabled = $state(false);
	currentTime = $state(0);
	duration = $state(0);
	progress = $state(0);
	bufferedTime = $state(0);
	isError = $state(false);
	errorMessage: string | null = $state(null);
	currentQueueIndex = $state(-1);
	sleepTimerEndsAt: number | null = $state(null);
	sleepTimerEndOnTrack = $state(false);
	sleepTimerRemainingSec = $state(0);
	/** Bookmark fragment bounds; playback pauses when clipEnd is reached. */
	clipStart: number | null = $state(null);
	clipEnd: number | null = $state(null);

	// ── User preferences ────────────────────────────────────────────────────
	seekStep = $state(10);
	autoAdvance = $state(true);
	wakeLockEnabled = $state(false);

	// ── Track completion event ──────────────────────────────────────────────
	lastCompletedTrackId: string | null = $state(null);
	lastCompletedTrackAt = $state(0);

	// ── Undo seek state ──────────────────────────────────────────────────────
	lastSeekFrom: number | null = $state(null);
	undoSeekAvailable = $state(false);
	private undoTimer: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		if (canUseDOM()) this.loadFromStorage();
	}

	// ── Persistence ─────────────────────────────────────────────────────────

	loadFromStorage(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const d = JSON.parse(raw);
			if (!d || typeof d !== 'object') return;
			const isTrack = (value: unknown): value is Track =>
				!!value && typeof value === 'object' && typeof (value as Track).url === 'string';
			if (isTrack(d.currentTrack)) {
				this.currentTrack = {
					...d.currentTrack,
					url: resolveMediaUrl(d.currentTrack.url)
				};
			}
			if (Array.isArray(d.queue)) {
				this.queue = d.queue.filter(isTrack).map((t: Track) => ({
					...t,
					url: resolveMediaUrl(t.url)
				}));
			}
			if (d.volume !== undefined) this.volume = d.volume;
			if (d.isMuted !== undefined) this.isMuted = d.isMuted;
			if (isValidPlaybackRate(d.playbackRate)) this.playbackRate = d.playbackRate;
			if (d.currentTime !== undefined) this.currentTime = d.currentTime;
			if (d.currentQueueIndex !== undefined) this.currentQueueIndex = d.currentQueueIndex;

			// Restore the known duration too, otherwise the player shows 0:00 until
			// the audio element loads its metadata on a fresh page load.
			const restoredTrack = this.currentTrack ?? this.queue[this.currentQueueIndex] ?? null;
			const restoredDuration = Number(restoredTrack?.duration);
			if (Number.isFinite(restoredDuration) && restoredDuration > 0) {
				this.duration = restoredDuration;
				this.progress = Math.min(100, (this.currentTime / restoredDuration) * 100);
			}
		} catch {
			/* ignore */
		}

		try {
			const step = parseSeekStep(localStorage.getItem(SEEK_STEP_STORAGE_KEY));
			if (step !== null) this.seekStep = step;
			const auto = parseAutoAdvance(localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY));
			if (auto !== null) this.autoAdvance = auto;
			const wake = parseAutoAdvance(localStorage.getItem(WAKE_LOCK_STORAGE_KEY));
			if (wake !== null) this.wakeLockEnabled = wake;
			const rate = parsePlaybackRate(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY));
			if (rate !== null) this.playbackRate = rate;
		} catch {
			/* ignore */
		}
	}

	saveToStorage(): void {
		if (!canUseDOM()) return;
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					currentTrack: this.currentTrack,
					queue: this.queue,
					volume: this.volume,
					isMuted: this.isMuted,
					playbackRate: this.playbackRate,
					currentTime: this.currentTime,
					currentQueueIndex: this.currentQueueIndex
				})
			);
		} catch {
			/* ignore */
		}
	}

	// ── Playback actions ────────────────────────────────────────────────────

	play(): void {
		if (this.isLoading) return;
		if (this.currentTrack?.broadcastLive) {
			const startedAt = Number(this.currentTrack.broadcastStartedAt);
			const clockSkewMs =
				typeof this.currentTrack.clockSkewMs === 'number' &&
				Number.isFinite(this.currentTrack.clockSkewMs)
					? this.currentTrack.clockSkewMs
					: 0;
			if (Number.isFinite(startedAt) && startedAt > 0) {
				const offset = Math.max(0, (Date.now() - clockSkewMs - startedAt) / 1000);
				if (offset < (this.currentTrack.duration ?? Infinity)) this.seek(offset, false);
			}
		}
		this.isPlaying = true;
		void htmlAudio.play().catch((error) => {
			this.isPlaying = false;
			this.setError(error instanceof Error ? error.message : 'Playback failed');
		});
	}

	pause(): void {
		this.isPlaying = false;
		htmlAudio.pause();
	}

	togglePlay(): void {
		if (this.isLoading) return;
		if (this.isPlaying) {
			this.pause();
		} else {
			this.play();
		}
	}

	setClipRange(start: number, end?: number | null): void {
		this.clipStart = end != null && end > start ? start : null;
		this.clipEnd = end != null && end > start ? end : null;
	}

	clearClipRange(): void {
		this.clipStart = null;
		this.clipEnd = null;
	}

	seek(time: number, isInteractive = true): void {
		const valid =
			this.duration > 0 ? Math.max(0, Math.min(time, this.duration)) : Math.max(0, time);
		if (isInteractive && Math.abs(valid - this.currentTime) > 10) {
			this.lastSeekFrom = this.currentTime;
			this.undoSeekAvailable = true;
			if (this.undoTimer) clearTimeout(this.undoTimer);
			this.undoTimer = setTimeout(() => {
				this.undoSeekAvailable = false;
			}, 6000);
		}
		this.currentTime = valid;
		this.progress = this.duration > 0 ? (valid / this.duration) * 100 : 0;
		// Directly seek the audio element so fast drags are applied immediately.
		// The $effect in AudioProvider will skip the redundant seek via lastSeekTime.
		htmlAudio.setCurrentTime(valid);
	}

	undoSeek(): void {
		if (this.lastSeekFrom !== null) {
			const target = this.lastSeekFrom;
			this.undoSeekAvailable = false;
			this.lastSeekFrom = null;
			this.seek(target, false);
		}
	}

	dismissUndoSeek(): void {
		this.undoSeekAvailable = false;
	}

	private async withSavedStart(track: Track): Promise<Track> {
		const hasExplicitStart =
			typeof track.startTime === 'number' &&
			Number.isFinite(track.startTime) &&
			track.startTime >= 0;
		if (track.broadcastId) {
			if (track.broadcastLive) return track;
			if (hasExplicitStart) return track;
			const replay = await db.progress.get(broadcastProgressKey(String(track.broadcastId)));
			if (!replay || replay.isCompleted || replay.progressSeconds <= 0) return track;
			return { ...track, startTime: replay.progressSeconds };
		}
		if (hasExplicitStart) return track;
		const versionId = normalizeVersionId(track.versionId);
		const saved = await db.progress.get(audioVersionKey(String(track.id), versionId));
		if (!saved || saved.isCompleted || saved.progressSeconds <= 0) return track;
		return { ...track, startTime: saved.progressSeconds };
	}

	next(): void {
		const idx = calculateNextIndex({
			queue: this.queue,
			currentQueueIndex: this.currentQueueIndex,
			shuffleEnabled: this.shuffleEnabled,
			repeatMode: this.repeatMode
		});
		const track = this.queue[idx];
		if (idx === -1 || !track) {
			this.isLoading = false;
			this.isPlaying = false;
			this.isBuffering = false;
			return;
		}
		void this.withSavedStart(track).then((resolved) => this.loadAndPlayTrack(resolved, idx));
	}

	previous(): void {
		const idx = calculatePreviousIndex({
			queue: this.queue,
			currentQueueIndex: this.currentQueueIndex,
			shuffleEnabled: this.shuffleEnabled,
			repeatMode: this.repeatMode
		});
		const track = this.queue[idx];
		if (idx === -1 || !track) {
			if (this.currentQueueIndex === 0) {
				this.seek(0, false);
				return;
			}
			this.isLoading = false;
			this.isPlaying = false;
			this.isBuffering = false;
			return;
		}
		void this.withSavedStart(track).then((resolved) => this.loadAndPlayTrack(resolved, idx));
	}

	setQueueAndPlay(songs: Track[], startIndex: number): void {
		const target = songs[startIndex];
		if (!target) {
			this.clearQueue();
			this.isPlaying = false;
			this.isLoading = false;
			this.currentTrack = null;
			this.currentQueueIndex = -1;
			return;
		}
		const currentVersion = normalizeVersionId(this.currentTrack?.versionId);
		const targetVersion = normalizeVersionId(target.versionId);
		const wasSameTrack =
			this.currentTrack?.id === target.id &&
			currentVersion === targetVersion &&
			(this.currentTrack?.broadcastId ?? null) === (target.broadcastId ?? null) &&
			Boolean(this.currentTrack?.broadcastLive) === Boolean(target.broadcastLive) &&
			Boolean(htmlAudio.getAudioElement()?.src);
		this.setQueue(songs, startIndex);
		if (wasSameTrack) {
			if (target.startTime !== undefined) {
				this.seek(target.startTime, false);
			}
			this.isLoading = false;
			this.isBuffering = false;
			if (!this.isPlaying) this.play();
			return;
		}
		void this.withSavedStart(target).then((resolved) =>
			this.loadAndPlayTrack(resolved, startIndex)
		);
	}

	handleTrackEnd(): void {
		if (this.currentTrack && !this.currentTrack.broadcastId) {
			this.lastCompletedTrackId =
				this.currentTrack.id != null ? String(this.currentTrack.id) : null;
			this.lastCompletedTrackAt = Date.now();
		}
		if (this.autoAdvance) {
			this.next();
		} else {
			this.pause();
		}
	}

	// ── Queue actions ───────────────────────────────────────────────────────

	setQueue(tracks: Track[], startIndex = 0): void {
		const resolvedTracks = tracks.map((t) => ({ ...t, url: resolveMediaUrl(t.url) }));
		const current = resolvedTracks[startIndex] ?? null;
		if (
			current &&
			typeof current.clipStart === 'number' &&
			typeof current.clipEnd === 'number' &&
			current.clipEnd > current.clipStart
		) {
			this.setClipRange(current.clipStart, current.clipEnd);
		} else {
			this.clearClipRange();
		}
		this.queue = resolvedTracks;
		this.currentQueueIndex = current ? startIndex : -1;
		this.currentTrack = current;
	}

	getCurrentQueueIndex(): number {
		return this.currentQueueIndex;
	}

	clearQueue(): void {
		this.queue = [];
	}

	// ── Control actions ─────────────────────────────────────────────────────

	setVolume(params: { volume: number }): void {
		this.volume = params.volume;
		this.isMuted = params.volume === 0;
	}

	toggleMute(): void {
		this.isMuted = !this.isMuted;
	}

	setPlaybackRate(rate: number): void {
		if (this.duration && htmlAudio.isLive(this.duration)) return;
		this.playbackRate = Math.max(0.25, Math.min(2, rate));
	}

	setDefaultPlaybackRate(rate: number): void {
		this.setPlaybackRate(rate);
		if (canUseDOM()) {
			try {
				localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(rate));
			} catch {
				/* ignore */
			}
		}
	}

	setSeekStep(step: number): void {
		if ([5, 10, 15, 30].includes(step)) {
			this.seekStep = step;
			if (canUseDOM()) {
				try {
					localStorage.setItem(SEEK_STEP_STORAGE_KEY, String(step));
				} catch {
					/* ignore */
				}
			}
		}
	}

	setAutoAdvance(val: boolean): void {
		this.autoAdvance = val;
		if (canUseDOM()) {
			try {
				localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, String(val));
			} catch {
				/* ignore */
			}
		}
	}

	setWakeLockEnabled(val: boolean): void {
		this.wakeLockEnabled = val;
		if (canUseDOM()) {
			try {
				localStorage.setItem(WAKE_LOCK_STORAGE_KEY, String(val));
			} catch {
				/* ignore */
			}
		}
	}

	changeRepeatMode(): void {
		const modes: RepeatMode[] = ['none', 'one', 'all'];
		const i = modes.indexOf(this.repeatMode);
		this.repeatMode = modes[(i + 1) % modes.length] as RepeatMode;
	}

	setRepeatMode(mode: RepeatMode): void {
		this.repeatMode = mode;
	}

	startSleepTimer(duration: number | 'end_of_track'): void {
		if (duration === 'end_of_track') {
			this.sleepTimerEndOnTrack = true;
			this.sleepTimerEndsAt = null;
			this.sleepTimerRemainingSec = 0;
		} else {
			this.sleepTimerEndOnTrack = false;
			this.sleepTimerEndsAt = Date.now() + duration * 60 * 1000;
			this.sleepTimerRemainingSec = duration * 60;
		}
	}

	cancelSleepTimer(): void {
		this.sleepTimerEndsAt = null;
		this.sleepTimerEndOnTrack = false;
		this.sleepTimerRemainingSec = 0;
	}

	shuffle(): void {
		if (!this.queue.length || this.queue.length < 2 || !this.currentTrack) return;
		const rest = this.queue.filter((_, i) => i !== this.currentQueueIndex);
		const shuffled = rest.sort(() => Math.random() - 0.5);
		this.queue = [this.currentTrack, ...shuffled];
		this.currentQueueIndex = 0;
		this.shuffleEnabled = true;
	}

	unshuffle(): void {
		this.shuffleEnabled = false;
	}

	// ── State actions ───────────────────────────────────────────────────────

	updateTrackMetadata(patch: Partial<Track>): void {
		if (!this.currentTrack) return;
		const broadcastId = this.currentTrack.broadcastId;
		this.currentTrack = { ...this.currentTrack, ...patch };
		this.queue = this.queue.map((track) =>
			track.broadcastId === broadcastId ? { ...track, ...patch } : track
		);
		this.saveToStorage();
	}

	setCurrentTrack(track: Track | null): void {
		if (!track) {
			this.currentTrack = null;
			this.currentQueueIndex = -1;
			this.isPlaying = false;
			this.currentTime = 0;
			this.duration = 0;
			this.queue = [];
			this.isLoading = false;
			this.isError = false;
			this.errorMessage = null;
			return;
		}
		const resolvedTrack: Track = { ...track, url: resolveMediaUrl(track.url) };
		if (
			this.currentTrack?.id === resolvedTrack.id &&
			normalizeVersionId(this.currentTrack?.versionId) ===
				normalizeVersionId(resolvedTrack.versionId)
		) {
			return;
		}
		this.currentTrack = resolvedTrack;
		this.queue = [resolvedTrack];
		this.currentQueueIndex = 0;
		this.isLoading = true;
		this.isPlaying = false;
		this.currentTime = 0;
		this.duration = 0;
		this.isError = false;
		this.errorMessage = null;
		this.loadAndPlayTrack(resolvedTrack, 0);
	}

	/**
	 * Remove a broadcast that disappeared on the server. This is deliberately
	 * stronger than pause: a deleted broadcast must leave no current track,
	 * queue, progress or audio source behind, as if it was never played.
	 */
	async removeBroadcast(broadcastId: string): Promise<void> {
		if (
			!this.currentTrack?.broadcastId ||
			String(this.currentTrack.broadcastId) !== String(broadcastId)
		) {
			return;
		}

		this.isPlaying = false;
		this.pause();
		htmlAudio.stop();
		this.currentTrack = null;
		this.queue = [];
		this.currentQueueIndex = -1;
		this.currentTime = 0;
		this.duration = 0;
		this.progress = 0;
		this.bufferedTime = 0;
		this.isPlaying = false;
		this.isLoading = false;
		this.isBuffering = false;
		this.isError = false;
		this.errorMessage = null;
		this.clearClipRange();
		this.lastSeekFrom = null;
		this.undoSeekAvailable = false;
		if (this.undoTimer) {
			clearTimeout(this.undoTimer);
			this.undoTimer = null;
		}
		this.cancelSleepTimer();
		try {
			await db.progress.delete(broadcastProgressKey(String(broadcastId)));
		} catch {
			/* local progress cleanup is best-effort */
		}
		this.saveToStorage();
	}

	/** Called by AudioProvider to sync audio element time into state. */
	syncTime(currentTime: number, duration: number): void {
		this.currentTime = currentTime;
		// Audio elements report NaN/0 before metadata is available. Never let
		// that erase the duration we already know from the database/local cache.
		if (Number.isFinite(duration) && duration > 0) this.duration = duration;
		this.progress = this.duration > 0 ? (currentTime / this.duration) * 100 : 0;
	}

	setError(message: string | null): void {
		this.isError = !!message;
		this.errorMessage = message;
		this.isLoading = false;
		this.isPlaying = false;
	}

	/**
	 * Sets state to signal the provider to load and play a track.
	 * The actual audio loading is handled by AudioProvider via $effect.
	 */
	loadAndPlayTrack(track: Track, queueIndex: number): void {
		const resolvedTrack: Track = { ...track, url: resolveMediaUrl(track.url) };
		const isLiveStream =
			resolvedTrack.live === true ||
			(resolvedTrack.duration !== undefined && htmlAudio.isLive(resolvedTrack.duration));

		this.currentTrack = resolvedTrack;
		this.currentQueueIndex = queueIndex;
		if (
			typeof resolvedTrack.clipStart === 'number' &&
			typeof resolvedTrack.clipEnd === 'number' &&
			resolvedTrack.clipEnd > resolvedTrack.clipStart
		) {
			this.setClipRange(resolvedTrack.clipStart, resolvedTrack.clipEnd);
		} else {
			this.clearClipRange();
		}
		this.duration = resolvedTrack.duration ?? 0;
		this.currentTime = resolvedTrack.startTime ?? 0;
		this.progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
		this.isError = false;
		this.errorMessage = null;

		if (isLiveStream && this.playbackRate !== 1) this.playbackRate = 1;

		// Signal provider: set isPlaying=true to trigger load+play effect.
		// Keep isLoading until the provider reports canplay/error, otherwise
		// the spinner flashes for one frame and the play guard is bypassed.
		this.isLoading = true;
		this.isBuffering = false;
		this.isPlaying = true;
	}
}

export const audioStore = new AudioStore();
