import { json } from '@sveltejs/kit';
import { requireFullAdmin } from '$lib/server/admin';
import { getIntegrationStatus } from '$lib/server/integrations/status';
import type { RequestHandler } from './$types';

const CACHE_TTL_MS = 10_000;
const MAX_CACHE_ENTRIES = 50;
const statusCache = new Map<
	string,
	{ value: Awaited<ReturnType<typeof getIntegrationStatus>>; expiresAt: number }
>();

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireFullAdmin(locals);
	const now = Date.now();
	const cached = statusCache.get(user.id);
	if (cached && cached.expiresAt > now) {
		return json(cached.value);
	}

	const status = await getIntegrationStatus(user.id);
	if (statusCache.size >= MAX_CACHE_ENTRIES) {
		for (const [key, entry] of statusCache) {
			if (entry.expiresAt <= now) statusCache.delete(key);
		}
		while (statusCache.size >= MAX_CACHE_ENTRIES) {
			const oldest = statusCache.keys().next().value;
			if (oldest === undefined) break;
			statusCache.delete(oldest);
		}
	}
	statusCache.set(user.id, { value: status, expiresAt: now + CACHE_TTL_MS });
	return json(status);
};
