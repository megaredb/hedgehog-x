import { authClient } from './authClient';
import {
	loadCachedAccounts,
	saveCachedAccounts,
	clearCachedAccounts,
	clearCachedSession
} from './auth-storage';

/** Аккаунт внешнего провайдера, привязанный к пользователю. */
export interface LinkedAccount {
	id: string;
	providerId: string;
	accountId: string;
	userId: string;
	createdAt: Date;
	updatedAt: Date;
	scopes?: string[] | null;
}

/**
 * Хук: список привязанных способов входа (OAuth-аккаунтов) текущего
 * пользователя + действия «привязать» / «отвязать» с поддержкой оффлайн-кэша.
 *
 * Отвязка последнего способа входа запрещена на сервере (better-auth
 * allowUnlinkingAll: false); здесь мы дублируем проверку для мгновенной
 * обратной связи в UI.
 */
export function useAccounts() {
	let accounts = $state<LinkedAccount[]>(loadCachedAccounts());
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let isPending = $state<'link' | 'unlink' | 'delete' | null>(null);

	async function load() {
		// В оффлайне сразу используем локально сохранённые способы входа
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			const cached = loadCachedAccounts();
			if (cached.length > 0) {
				accounts = cached;
			}
			return;
		}

		isLoading = true;
		error = null;
		try {
			const res = await authClient.listAccounts();
			if (res.error) {
				const status = (res.error as { status?: number })?.status;
				if (status === 401 || status === 403) {
					accounts = [];
					clearCachedAccounts();
					clearCachedSession();
				} else {
					// Ошибка сети или сервера — сохраняем локальный кэш
					const cached = loadCachedAccounts();
					if (cached.length > 0) {
						accounts = cached;
					} else {
						error = res.error.message ?? 'Не удалось загрузить способы входа';
					}
				}
				return;
			}
			const data = res.data;
			const list = Array.isArray(data) ? (data as LinkedAccount[]) : [];
			accounts = list;
			saveCachedAccounts(list);
		} catch (e) {
			const cached = loadCachedAccounts();
			if (cached.length > 0) {
				accounts = cached;
			} else {
				error = e instanceof Error ? e.message : 'Не удалось загрузить способы входа';
			}
		} finally {
			isLoading = false;
		}
	}

	/** Привязать провайдера к текущему пользователю. Возвращает URL авторизации. */
	async function link(providerId: string, callbackURL = '/'): Promise<string | null> {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			error = 'Привязка аккаунта невозможна в оффлайн-режиме';
			return null;
		}

		isPending = 'link';
		error = null;
		try {
			// POST /link-social — привязывает OAuth-аккаунт к текущему пользователю
			// (better-auth НЕ создаёт нового пользователя, а добавляет account).
			const res = await authClient.$fetch('/link-social', {
				method: 'POST',
				body: { provider: providerId, callbackURL }
			});
			const result = res as unknown as {
				data?: { url?: string; redirect?: boolean; status?: boolean } | null;
				error?: { message?: string } | null;
			};
			if (result.error || !result.data) {
				error = result.error?.message ?? 'Не удалось привязать аккаунт';
				return null;
			}
			return result.data.url ?? null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Не удалось привязать аккаунт';
			return null;
		} finally {
			isPending = null;
		}
	}

	/** Отвязать способ входа. Если он последний — отвязка запрещена. */
	async function unlink(providerId: string): Promise<boolean> {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			error = 'Отвязка аккаунта невозможна в оффлайн-режиме';
			return false;
		}

		if (accounts.length <= 1) {
			error = 'Нельзя отвязать последний способ входа — вы потеряете доступ к аккаунту';
			return false;
		}
		const target = accounts.find((a) => a.providerId === providerId);
		isPending = 'unlink';
		error = null;
		try {
			const res = await authClient.unlinkAccount({
				providerId,
				accountId: target?.accountId
			});
			if (res.error) {
				error = res.error.message ?? 'Не удалось отвязать аккаунт';
				return false;
			}
			accounts = accounts.filter((a) => a.providerId !== providerId);
			saveCachedAccounts(accounts);
			return true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Не удалось отвязать аккаунт';
			return false;
		} finally {
			isPending = null;
		}
	}

	/** Полностью удалить аккаунт пользователя со всеми данными. */
	async function deleteAccount(): Promise<boolean> {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			error = 'Удаление аккаунта невозможно в оффлайн-режиме';
			return false;
		}

		isPending = 'delete';
		error = null;
		try {
			const res = await fetch('/api/user/delete', { method: 'POST' });
			if (!res.ok) {
				error = 'Не удалось удалить аккаунт';
				return false;
			}
			accounts = [];
			clearCachedAccounts();
			clearCachedSession();
			return true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Не удалось удалить аккаунт';
			return false;
		} finally {
			isPending = null;
		}
	}

	return {
		get accounts() {
			return accounts;
		},
		get isLoading() {
			return isLoading;
		},
		get error() {
			return error;
		},
		get isPending() {
			return isPending;
		},
		load,
		link,
		unlink,
		deleteAccount
	};
}
