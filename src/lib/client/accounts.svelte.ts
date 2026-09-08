import { authClient } from './authClient';

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
 * пользователя + действия «привязать» / «отвязать».
 *
 * Отвязка последнего способа входа запрещена на сервере (better-auth
 * allowUnlinkingAll: false); здесь мы дублируем проверку для мгновенной
 * обратной связи в UI.
 */
export function useAccounts() {
	let accounts = $state<LinkedAccount[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let isPending = $state<'link' | 'unlink' | 'delete' | null>(null);

	async function load() {
		isLoading = true;
		error = null;
		try {
			const res = await authClient.listAccounts();
			if (res.error) {
				error = res.error.message ?? 'Не удалось загрузить способы входа';
				return;
			}
			const data = res.data;
			accounts = Array.isArray(data) ? (data as LinkedAccount[]) : [];
		} finally {
			isLoading = false;
		}
	}

	/** Привязать провайдера к текущему пользователю. Возвращает URL авторизации. */
	async function link(providerId: string, callbackURL = '/'): Promise<string | null> {
		isPending = 'link';
		error = null;
		try {
			// POST /link-social — привязывает OAuth-аккаунт к текущему пользователю
			// (лучше-auth НЕ создаёт нового пользователя, а добавляет account).
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
		if (accounts.length <= 1) {
			error = 'Нельзя отвязать последний способ входа — вы потеряете доступ к аккаунту';
			return false;
		}
		const target = accounts.find((a) => a.providerId === providerId);
		isPending = 'unlink';
		error = null;
		try {
			// ВАЖНО: сервер сравнивает accountId с ЗНАЧЕНИЕМ внешнего id провайдера
			// (account.accountId — например «123456789» для Telegram), а не с
			// внутренним id записи в таблице account. Раньше передавали
			// target.id — сервер отвечал «Account not found».
			const res = await authClient.unlinkAccount({
				providerId,
				accountId: target?.accountId
			});
			if (res.error) {
				error = res.error.message ?? 'Не удалось отвязать аккаунт';
				return false;
			}
			accounts = accounts.filter((a) => a.providerId !== providerId);
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
		isPending = 'delete';
		error = null;
		try {
			const res = await fetch('/api/user/delete', { method: 'POST' });
			if (!res.ok) {
				error = 'Не удалось удалить аккаунт';
				return false;
			}
			// Сбрасываем сессию: иначе клиент продолжит показывать удалённого
			// пользователя, а cookie сессии останется валидной.
			await authClient.signOut();
			accounts = [];
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
