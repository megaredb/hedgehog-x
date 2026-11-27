import { error, json } from '@sveltejs/kit';
import { leaveListener } from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Требуется вход');
	await leaveListener(params.id ?? '', locals.user.id);
	return json({ ok: true });
};
