import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { authClient } from './authClient';
import type { BetterFetchError } from '@better-fetch/fetch';

interface SessionData {
	session: { id: string; userId: string; expiresAt: Date; token: string } | null;
	user: {
		id: string;
		name: string;
		email: string;
		image?: string | null;
		// Аватары/username каждого провайдера (доп.поля user)
		telegramAvatar?: string | null;
		telegramOidcUsername?: string | null;
		discordAvatar?: string | null;
		discordUsername?: string | null;
	} | null;
}

interface SessionState {
	data: SessionData | null;
	error: BetterFetchError | null;
	isPending: boolean;
	isRefetching: boolean;
	refetch: () => Promise<void>;
}

/**
 * Реактивная обёртка над сессией better-auth (nanostores atom) в стиле
 * useLiveQuery: вызывается внутри компонента, состояние живёт в $state.
 */
export function useSession() {
	const atom = authClient.useSession;

	let data = $state<SessionData | null>(atom.get().data);
	let error = $state<BetterFetchError | null>(atom.get().error);
	let isPending = $state(atom.get().isPending);

	$effect(() => {
		const state = atom.get();
		data = state.data;
		error = state.error;
		isPending = state.isPending;
		const unsubscribe = atom.listen((next: SessionState) => {
			data = next.data;
			error = next.error;
			isPending = next.isPending;
		});
		return unsubscribe;
	});

	return {
		get data() {
			return data;
		},
		get user() {
			return data?.user ?? null;
		},
		get session() {
			return data?.session ?? null;
		},
		get isPending() {
			return isPending;
		},
		get error() {
			return error;
		},
		refetch: () => atom.get().refetch()
	};
}

/**
 * Выход из аккаунта и редирект на главную.
 * Реактивная `useSession` уже слушает атом better-auth, поэтому отдельный refetch не нужен.
 */
export async function signOutAndRedirect() {
	await authClient.signOut();
	await goto(resolve('/'));
}
