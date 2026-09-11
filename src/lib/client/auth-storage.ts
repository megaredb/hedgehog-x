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
 * Безопасная загрузка сохранённой сессии из localStorage.
 * Применяет строгую проверку срока действия: если expiresAt истёк по системным
 * часам, кэш очищается и возвращается null.
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
		log.warn('Не удалось загрузить сохранённую сессию:', e);
		clearCachedSession();
		return null;
	}
}

/**
 * Сохранение активной сессии в localStorage.
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
		log.warn('Не удалось сохранить сессию в локальное хранилище:', e);
	}
}

/**
 * Очистка сохранённой сессии в localStorage.
 */
export function clearCachedSession(): void {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return;
	}

	try {
		localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
	} catch (e) {
		log.warn('Не удалось очистить сохранённую сессию:', e);
	}
}

/**
 * Безопасная загрузка сохранённых способов входа.
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
		log.warn('Не удалось загрузить сохранённые способы входа:', e);
		clearCachedAccounts();
		return [];
	}
}

/**
 * Сохранение списка способов входа в localStorage.
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
		log.warn('Не удалось сохранить способы входа в локальное хранилище:', e);
	}
}

/**
 * Очистка кэша способов входа.
 */
export function clearCachedAccounts(): void {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return;
	}

	try {
		localStorage.removeItem(AUTH_ACCOUNTS_STORAGE_KEY);
	} catch (e) {
		log.warn('Не удалось очистить сохранённые способы входа:', e);
	}
}
