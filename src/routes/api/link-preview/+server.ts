import { error, json } from '@sveltejs/kit';
import { allowedChatHosts, hasBroadcastSubscription } from '$lib/server/broadcasts';
import { fetchLinkPreview } from '$lib/server/og-preview';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) throw error(401, 'Требуется вход');
	if (!(await hasBroadcastSubscription(locals.user.id))) throw error(403, 'Нужна подписка');
	const payload = await request.json().catch(() => null);
	const raw = typeof payload?.url === 'string' ? payload.url.trim() : '';
	if (!raw) throw error(400, 'Ссылка не указана');
	try {
		const link = new URL(raw);
		const host = link.hostname.toLowerCase();
		if (
			![...allowedChatHosts(url.hostname)].some(
				(allowed) => host === allowed || host.endsWith('.' + allowed)
			)
		) {
			throw error(400, 'Ссылка не разрешена');
		}
	} catch (cause) {
		if (cause && typeof cause === 'object' && 'status' in cause) throw cause;
		throw error(400, 'Некорректная ссылка');
	}
	const preview = await fetchLinkPreview(raw, url.hostname);
	return json({ preview });
};
