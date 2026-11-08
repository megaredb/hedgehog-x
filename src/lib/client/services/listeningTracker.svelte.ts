import { SvelteDate } from 'svelte/reactivity';
import { db } from '$lib/client/db';
import {
	sendListenHeartbeat,
	trackEvent,
	type ListenHeartbeatPayload
} from '$lib/client/analytics';
import { createLogger } from '$lib/logger';

const log = createLogger('ListeningTracker');

const HEARTBEAT_INTERVAL_MS = 30000; // Emit listening heartbeat every 30s of active playback
const MIN_FLUSH_SECONDS = 2; // Minimum threshold to record a session on pause/track change
const MAX_SINGLE_SESSION_SECONDS = 300; // Endpoint constraint: max 300s per ping

interface ActiveSession {
	chapterId: string;
	bookId?: string;
	volumeId?: string;
	startedAt: number;
	accumulatedMs: number;
	lastTick: number;
}

export class ListeningTrackerService {
	private currentSession: ActiveSession | null = null;

	constructor() {
		if (typeof window !== 'undefined') {
			window.addEventListener('online', () => this.flushOfflineQueue());
			window.addEventListener('beforeunload', () => this.flush());

			if (typeof document !== 'undefined') {
				document.addEventListener('visibilitychange', () => {
					if (document.visibilityState === 'hidden') {
						this.flush();
					} else if (typeof navigator !== 'undefined' && navigator.onLine) {
						this.flushOfflineQueue();
					}
				});
			}

			// Initial queue flush attempt if online
			if (typeof navigator !== 'undefined' && navigator.onLine) {
				setTimeout(() => this.flushOfflineQueue(), 2000);
			}
		}
	}

	/**
	 * Ticks listening playback progress during active playback.
	 * Automatically rotates and emits when HEARTBEAT_INTERVAL_MS is reached.
	 */
	tick(chapterId: string, bookId?: string, volumeId?: string) {
		const now = Date.now();

		if (!this.currentSession || this.currentSession.chapterId !== chapterId) {
			// Flush previous session if switching tracks
			this.flush();
			this.currentSession = {
				chapterId,
				bookId,
				volumeId,
				startedAt: now,
				accumulatedMs: 0,
				lastTick: now
			};
			return;
		}

		// Keep bookId/volumeId up to date if resolved later
		if (!this.currentSession.bookId && bookId) this.currentSession.bookId = bookId;
		if (!this.currentSession.volumeId && volumeId) this.currentSession.volumeId = volumeId;

		const delta = Math.min(Math.max(0, now - this.currentSession.lastTick), 2000);
		this.currentSession.accumulatedMs += delta;
		this.currentSession.lastTick = now;

		if (this.currentSession.accumulatedMs >= HEARTBEAT_INTERVAL_MS) {
			const secondsToEmit = Math.floor(this.currentSession.accumulatedMs / 1000);
			this.currentSession.accumulatedMs -= secondsToEmit * 1000;

			const payload: ListenHeartbeatPayload = {
				chapterId: this.currentSession.chapterId,
				bookId: this.currentSession.bookId,
				volumeId: this.currentSession.volumeId,
				listenedSeconds: Math.min(secondsToEmit, MAX_SINGLE_SESSION_SECONDS),
				startedAt: new SvelteDate(this.currentSession.startedAt).toISOString()
			};

			this.currentSession.startedAt = now;
			void this.dispatchSession(payload);
		}
	}

	/**
	 * Flushes any remaining accumulated listening seconds (on pause, ended, or unload).
	 */
	flush() {
		if (!this.currentSession) return;

		const seconds = Math.floor(this.currentSession.accumulatedMs / 1000);
		const chapterId = this.currentSession.chapterId;
		const bookId = this.currentSession.bookId;
		const volumeId = this.currentSession.volumeId;
		const startedAt = new SvelteDate(this.currentSession.startedAt).toISOString();

		this.currentSession = null;

		if (seconds >= MIN_FLUSH_SECONDS) {
			const payload: ListenHeartbeatPayload = {
				chapterId,
				bookId,
				volumeId,
				listenedSeconds: Math.min(seconds, MAX_SINGLE_SESSION_SECONDS),
				startedAt
			};
			void this.dispatchSession(payload);
		}
	}

	/**
	 * Dispatches a listening session to the server, or queues it locally if offline/failed.
	 * Works for all users: authenticated, guests, and offline listeners.
	 */
	async dispatchSession(session: ListenHeartbeatPayload) {
		const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

		if (isOffline) {
			await this.enqueueOffline(session);
			return;
		}

		try {
			const ok = await sendListenHeartbeat(session);
			if (ok) {
				trackEvent('audio_listen', {
					chapterId: session.chapterId,
					bookId: session.bookId,
					seconds: session.listenedSeconds
				});
				log.debug(`Recorded ${session.listenedSeconds}s listening for ${session.chapterId}`);
			} else {
				await this.enqueueOffline(session);
			}
		} catch (err) {
			log.warn('Failed to send listening heartbeat, queuing offline:', err);
			await this.enqueueOffline(session);
		}
	}

	/**
	 * Saves an unsubmitted listening session into Dexie offline syncQueue.
	 */
	private async enqueueOffline(session: ListenHeartbeatPayload) {
		try {
			await db.syncQueue.add({
				action: 'LISTEN_SESSION',
				payload: session,
				timestamp: Date.now()
			});
			log.debug(`Saved ${session.listenedSeconds}s listening session to offline syncQueue`);
		} catch (err) {
			log.warn('Failed to save listening session to syncQueue:', err);
		}
	}

	/**
	 * Flushes all pending offline listening sessions to the server in a batch.
	 */
	async flushOfflineQueue() {
		if (typeof navigator !== 'undefined' && !navigator.onLine) return;

		try {
			const queued = await db.syncQueue.where('action').equals('LISTEN_SESSION').toArray();
			if (queued.length === 0) return;

			const sessions = queued
				.map((q) => q.payload as ListenHeartbeatPayload)
				.filter((s) => s && s.chapterId && s.listenedSeconds > 0);

			if (sessions.length === 0) {
				const ids = queued.map((q) => q.id!).filter(Boolean);
				await db.syncQueue.bulkDelete(ids);
				return;
			}

			const ok = await sendListenHeartbeat({ sessions });
			if (ok) {
				const ids = queued.map((q) => q.id!).filter(Boolean);
				await db.syncQueue.bulkDelete(ids);
				log.info(`Successfully flushed ${sessions.length} offline listening sessions to server`);
			} else {
				log.warn('Server rejected batch offline listening sessions, will retry later');
			}
		} catch (err) {
			log.warn('Error flushing offline listening queue:', err);
		}
	}
}

export const listeningTracker = new ListeningTrackerService();
