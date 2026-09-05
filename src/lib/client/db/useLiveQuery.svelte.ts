import { liveQuery } from 'dexie';

export function useDexie<T>(querier: () => Promise<T>, fallback: () => T, deps?: () => unknown) {
	let data = $state<T>(fallback());
	let isLoading = $state(true);

	$effect(() => {
		// Evaluate dependencies synchronously so Svelte 5 tracks them
		if (deps) deps();

		isLoading = true;
		const observable = liveQuery(querier);
		const subscription = observable.subscribe({
			next: (val) => {
				data = val;
				isLoading = false;
			},
			error: (err) => {
				console.error('Dexie liveQuery error:', err);
				isLoading = false;
			}
		});

		return () => subscription.unsubscribe();
	});

	return {
		get data() {
			return data;
		},
		get isLoading() {
			return isLoading;
		}
	};
}
