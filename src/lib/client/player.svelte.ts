import { localDb } from '$lib/client/db';
import { browser } from '$app/environment';

export interface Track {
	chapterId: string;
	bookId: string;
	volumeId: string;
	title: string;
	audioUrl: string;
	bookTitle: string;
	bookAuthor: string;
	coverUrl: string | null;
	durationInDb: number;
	themeColor?: string | null;
}

class GlobalAudioPlayer {
	// Svelte 5 Runes for global reactive state
	isPlaying = $state(false);
	currentTime = $state(0);
	duration = $state(0);
	playbackRate = $state(1.0);
	volume = $state(1.0);
	currentTrack = $state<Track | null>(null);
	queue = $state<Track[]>([]);
	currentIndex = $state(-1);
	isMuted = $state(false);

	private audio: HTMLAudioElement | null = null;
	private lastSavedTime = 0;
	private saveInterval = 10000; // Throttle DB saves to once every 10 seconds
	private isUnauthorized = false; // Stop syncing if 401

	constructor() {
		if (typeof window !== 'undefined') {
			this.audio = new Audio();
			this.setupAudioListeners();
			this.setupMediaSession();

			// Load volume and speed from localStorage if available
			const savedVolume = localStorage.getItem('player-volume');
			if (savedVolume) {
				this.volume = parseFloat(savedVolume);
				this.audio.volume = this.volume;
			}
			const savedRate = localStorage.getItem('player-speed');
			if (savedRate) {
				this.playbackRate = parseFloat(savedRate);
				this.audio.defaultPlaybackRate = this.playbackRate;
				this.audio.playbackRate = this.playbackRate;
			}

			// Restore last track
			const savedTrack = localStorage.getItem('player-last-track');
			if (savedTrack) {
				try {
					const track = JSON.parse(savedTrack) as Track;
					this.currentTrack = track;
					this.duration = track.durationInDb;
					this.audio.src = track.audioUrl;
					this.audio.load();
					this.updateMediaMetadata();

					// Load progress from IndexedDB asynchronously
					localDb.progress
						.where('[bookId+volumeId+chapterId]')
						.equals([track.bookId, track.volumeId, track.chapterId])
						.first()
						.then((progress) => {
							if (progress && this.audio) {
								this.currentTime = progress.currentTime;
								this.audio.currentTime = progress.currentTime;
							}
						})
						.catch((e) => console.error('Failed to load init progress:', e));
				} catch (e) {
					console.error('Failed to parse last track', e);
				}
			}
		}
	}

	private setupAudioListeners() {
		if (!this.audio) return;

		this.audio.addEventListener('play', () => {
			this.isPlaying = true;
			this.updatePlaybackState();
		});

		this.audio.addEventListener('pause', () => {
			this.isPlaying = false;
			this.updatePlaybackState();
			this.saveProgress(true); // Force save on pause
		});

		this.audio.addEventListener('timeupdate', () => {
			if (!this.audio) return;
			this.currentTime = this.audio.currentTime;

			// Throttle saves to IndexedDB
			const now = Date.now();
			if (now - this.lastSavedTime > this.saveInterval) {
				this.saveProgress();
				this.lastSavedTime = now;
			}
		});

		this.audio.addEventListener('durationchange', () => {
			if (!this.audio) return;
			// True audio file duration takes priority over DB stored duration
			if (this.audio.duration && this.audio.duration !== Infinity) {
				this.duration = this.audio.duration;
				this.saveProgress(true); // Save the corrected duration
			}
		});

		this.audio.addEventListener('ratechange', () => {
			if (!this.audio) return;
			this.playbackRate = this.audio.playbackRate;
			localStorage.setItem('player-speed', this.playbackRate.toString());
		});

		this.audio.addEventListener('volumechange', () => {
			if (!this.audio) return;
			this.volume = this.audio.volume;
			this.isMuted = this.audio.muted;
			localStorage.setItem('player-volume', this.volume.toString());
		});

		this.audio.addEventListener('ended', () => {
			this.saveProgress(true);
			this.next();
		});
	}

	private setupMediaSession() {
		if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

		navigator.mediaSession.setActionHandler('play', () => this.play());
		navigator.mediaSession.setActionHandler('pause', () => this.pause());
		navigator.mediaSession.setActionHandler('stop', () => this.stop());
		navigator.mediaSession.setActionHandler('seekbackward', () => this.skip(-10));
		navigator.mediaSession.setActionHandler('seekforward', () => this.skip(30));
		navigator.mediaSession.setActionHandler('seekto', (details) => {
			if (details.seekTime !== undefined) this.seek(details.seekTime);
		});
		navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
		navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
	}

	private updatePlaybackState() {
		if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
		navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
	}

	private updateMediaMetadata() {
		if (typeof window === 'undefined' || !('mediaSession' in navigator) || !this.currentTrack)
			return;

		const track = this.currentTrack;
		navigator.mediaSession.metadata = new MediaMetadata({
			title: track.title,
			artist: track.bookAuthor,
			album: track.bookTitle,
			artwork: track.coverUrl
				? [
						{ src: track.coverUrl, sizes: '96x96', type: 'image/png' },
						{ src: track.coverUrl, sizes: '128x128', type: 'image/png' },
						{ src: track.coverUrl, sizes: '192x192', type: 'image/png' },
						{ src: track.coverUrl, sizes: '256x256', type: 'image/png' },
						{ src: track.coverUrl, sizes: '384x384', type: 'image/png' },
						{ src: track.coverUrl, sizes: '512x512', type: 'image/png' }
					]
				: []
		});
	}

	// Loading and Queue Management
	async loadTrack(track: Track, autoplay = true) {
		if (!this.audio) return;

		this.currentTrack = track;
		this.duration = track.durationInDb; // Fallback until metadata loads

		// Set audio source
		this.audio.src = track.audioUrl;
		this.audio.load();

		// Update Media Session OS widget metadata
		this.updateMediaMetadata();

		// Save last played track to localStorage for Continue Listening widget
		localStorage.setItem('player-last-track', JSON.stringify(track));

		// Attempt to load progress from IndexedDB
		const progress = await localDb.progress
			.where('[bookId+volumeId+chapterId]')
			.equals([track.bookId, track.volumeId, track.chapterId])
			.first();

		if (progress) {
			this.currentTime = progress.currentTime;
			this.audio.currentTime = progress.currentTime;
		} else {
			this.currentTime = 0;
			this.audio.currentTime = 0;
		}

		if (autoplay) {
			await this.play();
		}
	}

	setQueue(tracks: Track[], startIndex = 0, autoplay = true) {
		this.queue = tracks;
		this.currentIndex = startIndex;
		if (tracks[startIndex]) {
			this.loadTrack(tracks[startIndex], autoplay);
		}
	}

	// Playback Controls
	async play() {
		if (!this.audio || !this.currentTrack) return;
		try {
			// Apply speed before playing
			this.audio.playbackRate = this.playbackRate;
			await this.audio.play();
		} catch (error: unknown) {
			if (error instanceof Error && error.name !== 'AbortError') {
				console.error('Playback failed:', error);
			}
		}
	}

	pause() {
		if (!this.audio) return;
		this.audio.pause();
	}

	toggle() {
		if (this.isPlaying) {
			this.pause();
		} else {
			this.play();
		}
	}

	stop() {
		if (!this.audio) return;
		this.audio.pause();
		this.audio.currentTime = 0;
		this.isPlaying = false;
	}

	seek(time: number) {
		if (!this.audio) return;
		const targetTime = Math.max(0, Math.min(time, this.duration));
		this.audio.currentTime = targetTime;
		this.currentTime = targetTime;
		this.saveProgress(true); // Save immediately on manual seek
	}

	skip(seconds: number) {
		this.seek(this.currentTime + seconds);
	}

	setSpeed(rate: number) {
		if (!this.audio) return;
		const targetRate = Math.max(0.5, Math.min(rate, 3.0));
		this.playbackRate = targetRate;
		this.audio.playbackRate = targetRate;
	}

	setVolume(vol: number) {
		if (!this.audio) return;
		const targetVol = Math.max(0, Math.min(vol, 1.0));
		this.volume = targetVol;
		this.audio.volume = targetVol;
		this.audio.muted = targetVol === 0;
	}

	toggleMute() {
		if (!this.audio) return;
		this.audio.muted = !this.audio.muted;
		this.isMuted = this.audio.muted;
	}

	// Queue Navigation
	next() {
		if (this.queue.length === 0 || this.currentIndex === -1) return;
		const nextIndex = this.currentIndex + 1;
		if (nextIndex < this.queue.length) {
			this.currentIndex = nextIndex;
			this.loadTrack(this.queue[nextIndex], true);
		}
	}

	prev() {
		if (this.queue.length === 0 || this.currentIndex === -1) return;
		// If we've listened to more than 3 seconds, restart the track instead of skipping back
		if (this.currentTime > 3) {
			this.seek(0);
			return;
		}
		const prevIndex = this.currentIndex - 1;
		if (prevIndex >= 0) {
			this.currentIndex = prevIndex;
			this.loadTrack(this.queue[prevIndex], true);
		}
	}

	// Persistent Listening Progress Syncing
	private async saveProgress(force = false) {
		if (!this.currentTrack) return;

		const track = this.currentTrack;
		const currentTime = this.currentTime;
		const duration = this.duration;

		try {
			// Find existing progress by compound index
			const existing = await localDb.progress
				.where('[bookId+volumeId+chapterId]')
				.equals([track.bookId, track.volumeId, track.chapterId])
				.first();

			if (existing && existing.id !== undefined) {
				await localDb.progress.update(existing.id, {
					currentTime,
					duration,
					updatedAt: Date.now()
				});
			} else {
				await localDb.progress.add({
					bookId: track.bookId,
					volumeId: track.volumeId,
					chapterId: track.chapterId,
					currentTime,
					duration,
					updatedAt: Date.now()
				});
			}

			// Sync with remote server (PostgreSQL) if online and force-saving (e.g. pause or seek)
			if (force && navigator.onLine) {
				const isCompleted = duration > 0 && currentTime >= duration - 5;
				await this.syncWithServer(track.chapterId, currentTime, isCompleted);
			}
		} catch (error) {
			console.error('Failed to save progress locally:', error);
		}
	}

	private async syncWithServer(chapterId: string, currentTime: number, isCompleted: boolean) {
		if (this.isUnauthorized) return;
		try {
			// Note: We'll implement the actual API route later during remote sync layout
			const res = await fetch('/api/progress', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					chapterId,
					currentTime,
					isCompleted
				})
			});
			if (res.status === 401) {
				this.isUnauthorized = true;
			}
		} catch (error) {
			// Fail silently; since progress is saved locally, it can be synced later
			console.warn('Network progress sync failed (saved locally):', error);
		}
	}
}

export const player = browser
	? new GlobalAudioPlayer()
	: (new Proxy(
			{},
			{
				get: (_, prop) => {
					if (prop === 'currentTrack') return null;
					if (prop === 'isPlaying') return false;
					if (prop === 'duration') return 0;
					if (prop === 'currentTime') return 0;
					if (prop === 'queue') return [];
					if (prop === 'playbackRate') return 1.0;
					if (prop === 'volume') return 1.0;
					return () => {};
				}
			}
		) as unknown as GlobalAudioPlayer);
