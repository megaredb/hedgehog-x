import { error, json } from '@sveltejs/kit';
import {
	canReplay,
	hasBroadcastSubscription,
	recordBroadcastView,
	syncBroadcast
} from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Требуется вход');
	if (!(await hasBroadcastSubscription(locals.user.id))) throw error(403, 'Нужна подписка');
	const state = await syncBroadcast(params.id ?? '');
	if (!state) throw error(404, 'Трансляция не найдена');
	const body = await request.json().catch(() => ({}));
	const kind = body?.kind === 'replay' ? 'replay' : 'live';
	if (kind === 'replay' && !canReplay(state)) throw error(404, 'Запись недоступна');
	await recordBroadcastView(state.id, locals.user.id, kind);
	return json({ ok: true });
};
