import { authClient } from './authClient';
import { createLogger } from '../logger';
import {
	loadCachedSession,
	saveCachedSession,
	clearCachedSession,
	clearCachedAccounts,
	type SessionData
} from './auth-storage';

const log = createLogger('Auth');

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
		if (state.data) {
			data = state.data;
			error = null;
			isPending = false;
			saveCachedSession(state.data);
		} else if (state.error) {
			error = state.error;
			isPending = false;
			const status = state.error.status;
			// Explicit unauthorized status
			if (status === 401 || status === 403) {
				data = null;
				clearCachedSession();
			} else {
				// Network or offline issue: preserve cache
				const validCached = loadCachedSession();
				if (validCached) {
					data = validCached;
				}
			}
		} else if (state.data === null && !state.isPending) {
			// Unauthenticated response
			isPending = false;
			if (typeof navigator !== 'undefined' && navigator.onLine) {
				data = null;
				clearCachedSession();
			} else {
				const validCached = loadCachedSession();
				if (validCached) {
					data = validCached;
				}
			}
		} else {
			isPending = state.isPending;
		}
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
			clearCachedSession();
			clearCachedAccounts();
			data = null;
			try {
				await authClient.signOut();
			} catch (e) {
				log.warn('Ошибка signOut на сервере:', e);
			}
		}
	};
}
