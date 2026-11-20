import { browser } from '$app/environment';
import { syncService } from '$lib/client/services/syncService';
import { createLogger } from '$lib/logger';
import type { LayoutLoad } from './$types';

const log = createLogger('Sync');

export const load: LayoutLoad = async ({ params, fetch }) => {
	const { bookId } = params;

	if (browser) {
		// Asynchronous background sync of book structure into Dexie
		syncService
			.syncBookDetails(bookId, fetch)
			.catch((err) => log.error('Failed to sync book data:', err));

		// Keep user sync authoritative; the sync endpoint returns 401 for guests by design.
		syncService.syncUserData(fetch).catch((err) => log.error('Failed to sync user data:', err));
	}

	return {
		bookId
	};
};
