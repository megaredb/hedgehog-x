import { error, json } from '@sveltejs/kit';
import { broadcastExists } from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

/**
 * Lightweight existence probe for the persistent player.
 *
 * The player may still have a broadcast loaded after an admin deletes it.
 * We intentionally do not require auth here: the response only reveals
 * whether the id still exists, and the client must be able to clear stale
 * local playback even after the broadcast page/session is gone.
 */
export const GET: RequestHandler = async ({ params }) => {
	const id = params.id ?? '';
	if (!(await broadcastExists(id))) {
		throw error(404, 'Трансляция не найдена');
	}
	return json({ exists: true, id }, { headers: { 'cache-control': 'no-store' } });
};
