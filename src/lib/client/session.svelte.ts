import { authClient } from './authClient';
import type { BetterFetchError } from '@better-fetch/fetch';

interface SessionData {
	session: { id: string; userId: string; expiresAt: Date; token: string } | null;
	user: { id: string; name: string; email: string; image?: string | null } | null;
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
		const unsubscribe = atom.listen((state: SessionState) => {
			data = state.data;
			error = state.error;
			isPending = state.isPending;
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
