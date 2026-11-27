import { error, json } from '@sveltejs/kit';
import {
	broadcastKind,
	canReplay,
	hasBroadcastAccess,
	loadBroadcastProgress,
	saveBroadcastProgress,
	syncBroadcast
} from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

function requireUser(locals: App.Locals) {
	if (!locals.user) throw error(401, 'Требуется вход');
	return locals.user;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	if (!(await hasBroadcastAccess(user))) throw error(403, 'Нужна подписка');
	const broadcastId = params.id ?? '';
	const state = await syncBroadcast(broadcastId);
	if (!state) throw error(404, 'Трансляция не найдена');
	const progress = await loadBroadcastProgress(user.id, broadcastId);
	return json(
		{
			progress: progress
				? {
						...progress,
						updatedAt: progress.updatedAt.toISOString()
					}
				: null
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals);
	if (!(await hasBroadcastAccess(user))) throw error(403, 'Нужна подписка');
	const broadcastId = params.id ?? '';
	const state = await syncBroadcast(broadcastId);
	if (!state) throw error(404, 'Трансляция не найдена');
	const currentKind = broadcastKind(state);
	if (currentKind !== 'live' && !canReplay(state)) throw error(409, 'Трансляция недоступна');

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Некорректный запрос');
	}
	const position = Number(body.positionSeconds);
	const kind = body.kind === 'live' ? 'live' : 'replay';
	if (!Number.isFinite(position) || position < 0) throw error(400, 'Некорректная позиция');
	const maxPosition = Math.max(0, Math.ceil(state.durationSeconds));
	const clampedPosition = Math.min(Math.max(0, Math.floor(position)), maxPosition);
	await saveBroadcastProgress({
		userId: user.id,
		broadcastId,
		kind,
		positionSeconds: clampedPosition,
		isCompleted: body.isCompleted === true
	});
	return json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
};
