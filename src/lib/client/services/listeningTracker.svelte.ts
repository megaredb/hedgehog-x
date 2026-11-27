import { SvelteDate } from 'svelte/reactivity';
import { db } from '$lib/client/db';
import { getCurrentOwnerId } from '$lib/client/db/syncState';
import {
	sendListenHeartbeat,
	trackEvent,
	type ListenHeartbeatPayload
} from '$lib/client/analytics';
import { createLogger } from '$lib/logger';
import { formatLocalDateKey } from '$lib/analytics/stats';

const log = createLogger('ListeningTracker');

const HEARTBEAT_INTERVAL_MS = 30000; // Emit listening heartbeat every 30s of active playback
const MIN_FLUSH_SECONDS = 2; // Minimum threshold to record a session on pause/track change
const MAX_SINGLE_SESSION_SECONDS = 300; // Endpoint constraint: max 300s per ping
const MAX_SYNC_BATCH = 100;

interface ActiveSession {
	chapterId: string;
	versionId: string;
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

			// Initial queue flush attempt if online (browser only).
			if (
				typeof indexedDB !== 'undefined' &&
				typeof navigator !== 'undefined' &&
				navigator.onLine
			) {
				setTimeout(() => this.flushOfflineQueue(), 2000);
			}
		}
	}

	/**
	 * Ticks listening playback progress during active playback.
	 * Automatically rotates and emits when HEARTBEAT_INTERVAL_MS is reached.
	 */
	tick(chapterId: string, bookId?: string, volumeId?: string, versionId = 'default') {
		const now = Date.now();

		if (
			!this.currentSession ||
			this.currentSession.chapterId !== chapterId ||
			this.currentSession.versionId !== versionId
		) {
			// Flush previous session if switching tracks or versions
			this.flush();
			this.currentSession = {
				chapterId,
				versionId,
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
				versionId: this.currentSession.versionId,
				bookId: this.currentSession.bookId,
				volumeId: this.currentSession.volumeId,
				listenedSeconds: Math.min(secondsToEmit, MAX_SINGLE_SESSION_SECONDS),
				startedAt: new SvelteDate(this.currentSession.startedAt).toISOString(),
				dateKey: formatLocalDateKey(this.currentSession.startedAt)
			};

			this.currentSession.startedAt = now;
			void this.dispatchSession(payload);
		}
	}

	/**
	 * Flushes any remaining accumulated listening seconds (on pause, ended, or unload).
	 */
	async flush(): Promise<void> {
		if (!this.currentSession) return;

		const seconds = Math.floor(this.currentSession.accumulatedMs / 1000);
		const chapterId = this.currentSession.chapterId;
		const versionId = this.currentSession.versionId;
		const bookId = this.currentSession.bookId;
		const volumeId = this.currentSession.volumeId;
		const startedAt = new SvelteDate(this.currentSession.startedAt).toISOString();

		this.currentSession = null;

		if (seconds >= MIN_FLUSH_SECONDS) {
			const payload: ListenHeartbeatPayload = {
				chapterId,
				versionId,
				bookId,
				volumeId,
				listenedSeconds: Math.min(seconds, MAX_SINGLE_SESSION_SECONDS),
				startedAt,
				dateKey: formatLocalDateKey(startedAt)
			};
			await this.dispatchSession(payload);
		}
	}

	/** Drops the in-memory session so logout cannot send it under the next user. */
	reset() {
		this.currentSession = null;
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
		if (typeof indexedDB === 'undefined') return;

		try {
			await db.syncQueue.add({
				action: 'LISTEN_SESSION',
				payload: session,
				timestamp: Date.now(),
				ownerUserId: await getCurrentOwnerId()
			});
			log.debug(`Saved ${session.listenedSeconds}s listening session to offline syncQueue`);
		} catch (err) {
			log.warn('Failed to save listening session to syncQueue:', err);
		}
	}

	/**
	 * Flushes all pending offline listening sessions to the server in chunks of <= 100.
	 */
	async flushOfflineQueue() {
		if (typeof indexedDB === 'undefined') return;
		if (typeof navigator !== 'undefined' && !navigator.onLine) return;

		try {
			const ownerUserId = await getCurrentOwnerId();
			const queued = (await db.syncQueue.where('action').equals('LISTEN_SESSION').toArray()).filter(
				(item) => (item.ownerUserId ?? null) === ownerUserId
			);
			if (queued.length === 0) return;

			const validItems: Array<{ id?: number; session: ListenHeartbeatPayload }> = [];
			const invalidIds: number[] = [];
			for (const item of queued) {
				const session = item.payload as ListenHeartbeatPayload | undefined;
				if (session && session.chapterId && session.listenedSeconds > 0) {
					validItems.push({ id: item.id, session });
				} else if (item.id !== undefined) {
					invalidIds.push(item.id);
				}
			}

			if (invalidIds.length > 0) {
				await db.syncQueue.bulkDelete(invalidIds);
			}
			if (validItems.length === 0) return;

			let flushedCount = 0;
			for (let i = 0; i < validItems.length; i += MAX_SYNC_BATCH) {
				const chunk = validItems.slice(i, i + MAX_SYNC_BATCH);
				const chunkIds = chunk
					.map((entry) => entry.id)
					.filter((id): id is number => id !== undefined);
				const sessions = chunk.map((entry) => entry.session);

				const res = await fetch('/api/analytics/listen', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sessions })
				});

				if (res.ok) {
					if (chunkIds.length > 0) await db.syncQueue.bulkDelete(chunkIds);
					flushedCount += sessions.length;
				} else if (
					res.status >= 400 &&
					res.status < 500 &&
					res.status !== 401 &&
					res.status !== 429
				) {
					log.warn(`Dropping invalid listening session batch after HTTP ${res.status}`);
					if (chunkIds.length > 0) await db.syncQueue.bulkDelete(chunkIds);
					continue;
				} else {
					log.warn(
						`Server rejected batch offline listening sessions (HTTP ${res.status}), will retry later`
					);
					break;
				}
			}

			if (flushedCount > 0) {
				log.info(`Successfully flushed ${flushedCount} offline listening sessions to server`);
			}
		} catch (err) {
			log.warn('Error flushing offline listening queue:', err);
		}
	}
}

export const listeningTracker = new ListeningTrackerService();
