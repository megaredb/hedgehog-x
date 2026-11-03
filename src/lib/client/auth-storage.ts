import type { LinkedAccount } from './accounts.svelte';
import { createLogger } from '../logger';

const log = createLogger('Storage');

export interface SessionData {
	session: { id: string; userId: string; expiresAt: Date; token: string } | null;
	user: {
		id: string;
		name: string;
		email: string;
		image?: string | null;
		telegramAvatar?: string | null;
		telegramOidcUsername?: string | null;
		discordAvatar?: string | null;
		discordUsername?: string | null;
	} | null;
}

export const AUTH_SESSION_STORAGE_KEY = 'hedgehog_auth_session';
export const AUTH_ACCOUNTS_STORAGE_KEY = 'hedgehog_auth_accounts';

/**
 * Loads cached session data from localStorage.
 * Enforces expiration validation and purges expired caches.
 */
export function loadCachedSession(now = Date.now()): SessionData | null {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return null;
	}

	try {
		const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
		if (!raw) return null;

		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return null;

		const session = parsed.session;
		const user = parsed.user;

		if (!session || !user || typeof session !== 'object' || typeof user !== 'object') {
			clearCachedSession();
			return null;
		}

		const expiresAtTime = new Date(session.expiresAt).getTime();
		if (!Number.isFinite(expiresAtTime) || expiresAtTime <= now) {
			clearCachedSession();
			return null;
		}

		return {
			session: {
				...session,
				expiresAt: new Date(session.expiresAt)
			},
			user
		};
	} catch (e) {
		log.warn('Failed to load cached session:', e);
		clearCachedSession();
		return null;
	}
}

/**
 * Persists active session to localStorage.
 */
export function saveCachedSession(data: SessionData | null): void {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return;
	}

	try {
		if (!data || !data.session || !data.user) {
			clearCachedSession();
			return;
		}

		localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(data));
	} catch (e) {
		log.warn('Failed to save session to storage:', e);
	}
}

/**
 * Purges cached session from localStorage.
 */
export function clearCachedSession(): void {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return;
	}

	try {
		localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
	} catch (e) {
		log.warn('Failed to clear cached session:', e);
	}
}

/**
 * Loads linked OAuth accounts from localStorage.
 */
export function loadCachedAccounts(): LinkedAccount[] {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return [];
	}

	try {
		const raw = localStorage.getItem(AUTH_ACCOUNTS_STORAGE_KEY);
		if (!raw) return [];

		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		return parsed.map((acc) => ({
			...acc,
			createdAt: new Date(acc.createdAt),
			updatedAt: new Date(acc.updatedAt)
		}));
	} catch (e) {
		log.warn('Failed to load cached accounts:', e);
		clearCachedAccounts();
		return [];
	}
}

/**
 * Persists linked OAuth accounts to localStorage.
 */
export function saveCachedAccounts(accounts: LinkedAccount[]): void {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return;
	}

	try {
		if (!Array.isArray(accounts) || accounts.length === 0) {
			clearCachedAccounts();
			return;
		}

		localStorage.setItem(AUTH_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
	} catch (e) {
		log.warn('Failed to save accounts to storage:', e);
	}
}

/**
 * Purges cached OAuth accounts from localStorage.
 */
export function clearCachedAccounts(): void {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return;
	}

	try {
		localStorage.removeItem(AUTH_ACCOUNTS_STORAGE_KEY);
	} catch (e) {
		log.warn('Failed to clear cached accounts:', e);
	}
}
