import { authClient } from './authClient';
import {
	loadCachedAccounts,
	saveCachedAccounts,
	clearCachedAccounts,
	clearCachedSession
} from './auth-storage';

/** External OAuth account linked to the user */
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
 * Hook: list of linked sign-in methods (OAuth accounts) with offline cache support.
 */
export function useAccounts() {
	let accounts = $state<LinkedAccount[]>(loadCachedAccounts());
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let isPending = $state<'link' | 'unlink' | 'delete' | null>(null);

	async function load() {
		// When offline, use locally cached sign-in methods immediately
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
					// Network or server error - retain local cache
					const cached = loadCachedAccounts();
					if (cached.length > 0) {
						accounts = cached;
					} else {
						error = res.error.message ?? 'Failed to load sign-in methods';
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
				error = e instanceof Error ? e.message : 'Failed to load sign-in methods';
			}
		} finally {
			isLoading = false;
		}
	}

	/** Link OAuth provider to current user */
	async function link(providerId: string, callbackURL = '/'): Promise<string | null> {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			error = 'Linking accounts is unavailable offline';
			return null;
		}

		isPending = 'link';
		error = null;
		try {
			const res = await authClient.$fetch('/link-social', {
				method: 'POST',
				body: { provider: providerId, callbackURL }
			});
			const result = res as unknown as {
				data?: { url?: string; redirect?: boolean; status?: boolean } | null;
				error?: { message?: string } | null;
			};
			if (result.error || !result.data) {
				error = result.error?.message ?? 'Failed to link account';
				return null;
			}
			return result.data.url ?? null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to link account';
			return null;
		} finally {
			isPending = null;
		}
	}

	/** Unlink OAuth provider from current user */
	async function unlink(providerId: string): Promise<boolean> {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			error = 'Unlinking accounts is unavailable offline';
			return false;
		}

		if (accounts.length <= 1) {
			error = 'Cannot unlink last sign-in method';
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
				error = res.error.message ?? 'Failed to unlink account';
				return false;
			}
			accounts = accounts.filter((a) => a.providerId !== providerId);
			saveCachedAccounts(accounts);
			return true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to unlink account';
			return false;
		} finally {
			isPending = null;
		}
	}

	/** Permanently delete account and all user data */
	async function deleteAccount(): Promise<boolean> {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			error = 'Account deletion is unavailable offline';
			return false;
		}

		isPending = 'delete';
		error = null;
		try {
			const res = await fetch('/api/user/delete', { method: 'POST' });
			if (!res.ok) {
				error = 'Failed to delete account';
				return false;
			}
			accounts = [];
			clearCachedAccounts();
			clearCachedSession();
			return true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete account';
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
