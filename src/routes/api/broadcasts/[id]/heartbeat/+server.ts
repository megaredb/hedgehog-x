import { error, json } from '@sveltejs/kit';
import {
	broadcastKind,
	hasBroadcastSubscription,
	touchListener,
	touchBroadcastView
} from '$lib/server/broadcasts';
import { syncBroadcast } from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Требуется вход');
	if (!(await hasBroadcastSubscription(locals.user.id))) throw error(403, 'Нужна подписка');
	const state = await syncBroadcast(params.id ?? '');
	if (!state) throw error(404, 'Трансляция не найдена');
	if (broadcastKind(state) !== 'live') throw error(409, 'Трансляция не идёт');
	const listeners = await touchListener(state.id, locals.user.id);
	await touchBroadcastView(state.id, locals.user.id, 'live');
	return json({ ok: true, listeners, serverNow: new Date().toISOString() });
};
