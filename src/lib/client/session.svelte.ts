import { authClient } from './authClient';
import { createLogger } from '../logger';
import {
	loadCachedSession,
	saveCachedSession,
	clearCachedSession,
	clearCachedAccounts,
	type SessionData
} from './auth-storage';
import { clearSessionLocalState } from './db/syncState';
import { guestAdoption } from './services/guestAdoption.svelte';

const log = createLogger('Auth');

// Tracks the last authenticated identity seen on this device. Session expiry or
// revocation is a logout for local-data purposes too, not just an explicit click.
let knownSessionUserId: string | null = loadCachedSession()?.user?.id ?? null;

async function reconcileSessionIdentity(userId: string | null): Promise<void> {
	if (userId) {
		if (knownSessionUserId && knownSessionUserId !== userId) {
			await clearSessionLocalState();
		}
		knownSessionUserId = userId;
		return;
	}

	if (knownSessionUserId) {
		knownSessionUserId = null;
		await clearSessionLocalState();
	}
}

export type { SessionData };

export interface SessionError {
	message?: string;
	status?: number;
	statusText?: string;
}

interface SessionState {
	data: SessionData | null;
	error: SessionError | null;
	isPending: boolean;
	isRefetching: boolean;
	refetch: () => Promise<void>;
}

/**
 * Reactive wrapper for better-auth session with offline resilience:
 * 1. Instant hydration from localStorage
 * 2. Network errors retain cached credentials
 * 3. Invalidation occurs strictly on 401/403 or session expiration
 */
export function useSession() {
	const atom = authClient.useSession;

	const cached = loadCachedSession();
	const serverState = atom.get() as unknown as SessionState;

	const initialData = serverState?.data ?? cached;
	let data = $state<SessionData | null>(initialData);
	let error = $state<SessionError | null>(serverState?.error ?? null);
	let isPending = $state(initialData ? false : (serverState?.isPending ?? true));

	function syncState(state: SessionState) {
		// Do not read `data` reactively inside this function: it is called from an
		// $effect. Reading the same state after writing it makes the effect loop.
		let nextUserId: string | null | undefined;

		if (state.data) {
			data = state.data;
			error = null;
			isPending = false;
			nextUserId = state.data.user?.id ?? null;
			saveCachedSession(state.data);
		} else if (state.error) {
			error = state.error;
			isPending = false;
			const status = state.error.status;
			// Explicit unauthorized status
			if (status === 401 || status === 403) {
				data = null;
				nextUserId = null;
				clearCachedSession();
			} else {
				// Network or offline issue: preserve cache
				const validCached = loadCachedSession();
				if (validCached) {
					data = validCached;
					nextUserId = validCached.user?.id ?? null;
				}
			}
		} else if (state.data === null && !state.isPending) {
			// Unauthenticated response
			isPending = false;
			if (typeof navigator !== 'undefined' && navigator.onLine) {
				data = null;
				nextUserId = null;
				clearCachedSession();
			} else {
				const validCached = loadCachedSession();
				if (validCached) {
					data = validCached;
					nextUserId = validCached.user?.id ?? null;
				}
			}
		} else {
			isPending = state.isPending;
		}

		if (nextUserId !== undefined) void reconcileSessionIdentity(nextUserId);
	}

	$effect(() => {
		syncState(atom.get() as unknown as SessionState);
		const unsubscribe = atom.listen((next: SessionState) => {
			syncState(next);
		});
		return unsubscribe;
	});

	// Strict expiration check based on system clock
	const isExpired = $derived.by(() => {
		const rawExpires = data?.session?.expiresAt;
		if (!rawExpires) return false;
		const expiresMs =
			rawExpires instanceof Date ? rawExpires.getTime() : Date.parse(String(rawExpires));
		return Number.isFinite(expiresMs) && expiresMs <= Date.now();
	});

	$effect(() => {
		if (isExpired) {
			data = null;
			clearCachedSession();
			void reconcileSessionIdentity(null);
		}
	});

	return {
		get data() {
			return isExpired ? null : data;
		},
		get user() {
			return isExpired ? null : (data?.user ?? null);
		},
		get session() {
			return isExpired ? null : (data?.session ?? null);
		},
		get isPending() {
			return isPending;
		},
		get error() {
			return error;
		},
		refetch: async () => {
			try {
				await atom.get().refetch();
			} catch (e) {
				log.warn('Ошибка refetch:', e);
			}
		},
		signOut: async () => {
			guestAdoption.cancel();

			// Flush current user's pending mutations while the session cookie is
			// still valid. If offline, cleanup below still wins for privacy.
			try {
				if (typeof navigator !== 'undefined' && navigator.onLine) {
					const [{ likeService }, { flushBookmarkQueue }, { progressSync }, { listeningTracker }] =
						await Promise.all([
							import('./services/likeService'),
							import('./services/bookmarkSync'),
							import('./services/progressSync.svelte'),
							import('./services/listeningTracker.svelte')
						]);

					await Promise.allSettled([
						likeService.syncLikesQueue(),
						flushBookmarkQueue(),
						progressSync.flushImmediately(),
						listeningTracker.flushOfflineQueue()
					]);
					progressSync.clearPending();
					listeningTracker.reset();
				} else {
					const [{ progressSync }, { listeningTracker }] = await Promise.all([
						import('./services/progressSync.svelte'),
						import('./services/listeningTracker.svelte')
					]);
					progressSync.clearPending();
					listeningTracker.reset();
				}
			} catch (e) {
				log.warn('Ошибка flush перед signOut:', e);
			}

			try {
				await authClient.signOut();
			} catch (e) {
				log.warn('Ошибка signOut на сервере:', e);
			} finally {
				// Local personal data must never survive into a guest session or
				// another account, even if the server signOut failed offline.
				await clearSessionLocalState();
				knownSessionUserId = null;
				clearCachedSession();
				clearCachedAccounts();
				data = null;
			}
		}
	};
}
