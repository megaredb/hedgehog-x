import { getCurrentOwnerId } from '$lib/client/db/syncState';
import { createLogger } from '$lib/logger';

const log = createLogger('BroadcastProgress');

const BATCH_INTERVAL_MS = 15_000;

interface PendingProgress {
	broadcastId: string;
	kind: 'live' | 'replay';
	positionSeconds: number;
	isCompleted: boolean;
}

class BroadcastProgressSyncService {
	private pending = new Map<string, PendingProgress>();
	private timer: ReturnType<typeof setTimeout> | null = null;
	private ownerPromise: Promise<string | null> | null = null;
	private cachedOwnerId: string | null = null;
	private hasCachedOwner = false;

	constructor() {
		if (typeof window === 'undefined') return;
		window.addEventListener('online', () => void this.flush());
		window.addEventListener('pagehide', () => this.beacon());
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') void this.flush();
		});
		void this.refreshOwner();
	}

	private refreshOwner(): Promise<string | null> {
		const promise = getCurrentOwnerId().then((owner) => {
			this.cachedOwnerId = owner;
			this.hasCachedOwner = true;
			return owner;
		});
		return promise;
	}

	clear(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.pending.clear();
		this.ownerPromise = null;
		this.cachedOwnerId = null;
		this.hasCachedOwner = false;
	}

	record(
		broadcastId: string,
		kind: 'live' | 'replay',
		positionSeconds: number,
		isCompleted = false
	): void {
		if (!broadcastId || !Number.isFinite(positionSeconds)) return;
		this.pending.set(broadcastId, {
			broadcastId,
			kind,
			positionSeconds: Math.max(0, Math.floor(positionSeconds)),
			isCompleted
		});
		if (!this.ownerPromise) {
			this.ownerPromise = this.refreshOwner();
		}
		this.schedule();
	}

	async flush(): Promise<void> {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (this.pending.size === 0) return;
		if (typeof navigator !== 'undefined' && !navigator.onLine) return;

		const owner = await (this.ownerPromise ?? this.refreshOwner());
		const currentOwner = await this.refreshOwner();
		this.ownerPromise = null;
		if (!owner || owner !== currentOwner) {
			// Never send the previous account's playback position under a new session.
			this.pending.clear();
			return;
		}

		const entries = [...this.pending.values()];
		this.pending.clear();
		for (const entry of entries) {
			try {
				const response = await fetch(
					`/api/broadcasts/${encodeURIComponent(entry.broadcastId)}/progress`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							kind: entry.kind,
							positionSeconds: entry.positionSeconds,
							isCompleted: entry.isCompleted
						}),
						keepalive: true
					}
				);
				if (response.status === 401 || response.status === 403 || response.status === 404) {
					// Session expired, access revoked, or broadcast deleted: do not retry.
					continue;
				}
				if (!response.ok) this.restore(entry);
			} catch {
				this.restore(entry);
			}
		}
	}

	private restore(entry: PendingProgress): void {
		// A newer position from the same broadcast always wins.
		if (!this.pending.has(entry.broadcastId)) this.pending.set(entry.broadcastId, entry);
		this.schedule();
	}

	private schedule(): void {
		if (this.timer || this.pending.size === 0) return;
		this.timer = setTimeout(() => void this.flush(), BATCH_INTERVAL_MS);
	}

	private beacon(): void {
		if (typeof navigator === 'undefined' || this.pending.size === 0) return;
		if (!this.hasCachedOwner || !this.cachedOwnerId) {
			this.pending.clear();
			return;
		}
		for (const entry of this.pending.values()) {
			const body = JSON.stringify({
				kind: entry.kind,
				positionSeconds: entry.positionSeconds,
				isCompleted: entry.isCompleted
			});
			try {
				navigator.sendBeacon(
					`/api/broadcasts/${encodeURIComponent(entry.broadcastId)}/progress`,
					new Blob([body], { type: 'application/json' })
				);
			} catch (error) {
				log.warn('Failed to beacon broadcast progress:', error);
			}
		}
		this.pending.clear();
	}
}

export const broadcastProgressSync = new BroadcastProgressSyncService();
