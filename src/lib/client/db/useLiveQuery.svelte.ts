import { liveQuery } from 'dexie';

export function useDexie<T>(querier: () => Promise<T>, fallback: () => T, deps?: () => unknown) {
	let data = $state<T>(fallback());

	$effect(() => {
		// Evaluate dependencies synchronously so Svelte 5 tracks them
		if (deps) deps();

		const observable = liveQuery(querier);
		const subscription = observable.subscribe({
			next: (val) => {
				data = val;
			},
			error: (err) => {
				console.error('Dexie liveQuery error:', err);
			}
		});

		return () => subscription.unsubscribe();
	});

	return {
		get data() {
			return data;
		}
	};
}
