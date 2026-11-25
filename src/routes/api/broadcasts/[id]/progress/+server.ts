import { error, json } from '@sveltejs/kit';
import {
	broadcastExists,
	loadBroadcastProgress,
	saveBroadcastProgress
} from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

function requireUser(locals: App.Locals) {
	if (!locals.user) throw error(401, 'Требуется вход');
	return locals.user;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const broadcastId = params.id ?? '';
	if (!(await broadcastExists(broadcastId))) throw error(404, 'Трансляция не найдена');
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
	const broadcastId = params.id ?? '';
	if (!(await broadcastExists(broadcastId))) throw error(404, 'Трансляция не найдена');

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Некорректный запрос');
	}
	const position = Number(body.positionSeconds);
	const kind = body.kind === 'live' ? 'live' : 'replay';
	if (!Number.isFinite(position) || position < 0) throw error(400, 'Некорректная позиция');
	await saveBroadcastProgress({
		userId: user.id,
		broadcastId,
		kind,
		positionSeconds: Math.floor(position),
		isCompleted: body.isCompleted === true
	});
	return json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
};
