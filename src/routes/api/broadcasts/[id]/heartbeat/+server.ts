import { error, json } from '@sveltejs/kit';
import {
	activeBroadcastParticipants,
	broadcastKind,
	hasBroadcastAccess,
	syncBroadcast,
	touchListener,
	touchBroadcastView
} from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Требуется вход');
	if (!(await hasBroadcastAccess(locals.user))) throw error(403, 'Нужна подписка');
	const state = await syncBroadcast(params.id ?? '');
	if (!state) throw error(404, 'Трансляция не найдена');
	const kind = broadcastKind(state);
	if (kind !== 'live' && kind !== 'scheduled') throw error(409, 'Трансляция недоступна');
	const listeners = await touchListener(state.id, locals.user.id);
	if (kind === 'live') await touchBroadcastView(state.id, locals.user.id, 'live');
	const participants = await activeBroadcastParticipants(state.id);
	return json({ ok: true, listeners, participants, serverNow: new Date().toISOString() });
};
