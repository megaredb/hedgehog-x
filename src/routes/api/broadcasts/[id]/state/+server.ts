import { error, json } from '@sveltejs/kit';
import {
	activeBroadcastParticipants,
	activeListenerCount,
	broadcastKind,
	broadcastViewerParticipants,
	canReplay,
	hasBroadcastSubscription,
	listMessages,
	syncBroadcast
} from '$lib/server/broadcasts';
import { getBroadcastIllustrations } from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

function isAdmin(locals: App.Locals): boolean {
	return locals.user?.role === 'admin' || locals.user?.role === 'author';
}

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Требуется вход');
	const state = await syncBroadcast(params.id ?? '');
	if (!state) throw error(404, 'Трансляция не найдена');
	const kind = broadcastKind(state);
	if (kind === 'ended' && !canReplay(state) && !isAdmin(locals)) {
		throw error(404, 'Трансляция не опубликована');
	}
	if (!isAdmin(locals) && !(await hasBroadcastSubscription(currentUser.id))) {
		throw error(403, 'Нужна активная подписка');
	}

	const now = new Date();
	const listeners = kind === 'live' ? await activeListenerCount(state.id, now) : 0;
	const participants =
		kind === 'live'
			? await activeBroadcastParticipants(state.id, now)
			: kind === 'published'
				? await broadcastViewerParticipants(state.id)
				: [];
	const after = url.searchParams.get('after');
	const afterDate = after ? new Date(after) : undefined;
	const canReadChat =
		Boolean(state.startedAt) && state.chatEnabled && (kind === 'live' || canReplay(state));
	const messages = canReadChat
		? await listMessages(
				state.id,
				state.startedAt,
				afterDate && !Number.isNaN(afterDate.getTime()) ? afterDate : undefined,
				currentUser.id
			)
		: [];
	const images = await getBroadcastIllustrations(state.id);

	return json({
		broadcast: {
			...state,
			scheduledStartAt: state.scheduledStartAt.toISOString(),
			startedAt: state.startedAt?.toISOString() ?? null,
			endedAt: state.endedAt?.toISOString() ?? null,
			publishedAt: state.publishedAt?.toISOString() ?? null,
			kind,
			canReplay: canReplay(state)
		},
		messages,
		images,
		listeners,
		participants,
		serverNow: now.toISOString(),
		user: { id: currentUser.id, name: currentUser.name, role: currentUser.role }
	});
};
