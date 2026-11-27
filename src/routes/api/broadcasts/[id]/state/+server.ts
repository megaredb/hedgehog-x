import { error, json } from '@sveltejs/kit';
import {
	activeBroadcastParticipants,
	activeListenerCount,
	broadcastKind,
	broadcastViewerParticipants,
	canReplay,
	getBroadcastIllustrations,
	hasBroadcastAccess,
	isBroadcastChatOpen,
	listMessages,
	syncBroadcast
} from '$lib/server/broadcasts';
import { isAdminRole } from '$lib/server/admin';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Требуется вход');
	const state = await syncBroadcast(params.id ?? '');
	if (!state) throw error(404, 'Трансляция не найдена');
	const kind = broadcastKind(state);
	const admin = isAdminRole(currentUser.role);
	if (kind === 'ended' && !canReplay(state) && !admin) {
		throw error(404, 'Трансляция не опубликована');
	}
	const canWatch = await hasBroadcastAccess(currentUser);
	if (!canWatch) {
		throw error(403, 'Нужна активная подписка');
	}

	const now = new Date();
	const canRevealImages = canWatch;
	const canRevealAudio = canWatch && (kind !== 'scheduled' || admin);
	const chatOpen = isBroadcastChatOpen(state, now);
	const listeners =
		kind === 'live' || kind === 'scheduled' ? await activeListenerCount(state.id, now) : 0;
	const participants =
		kind === 'live' || kind === 'scheduled'
			? await activeBroadcastParticipants(state.id, now)
			: kind === 'published'
				? await broadcastViewerParticipants(state.id)
				: [];
	const after = url.searchParams.get('after');
	const afterId = url.searchParams.get('afterId') ?? undefined;
	const afterDate = after ? new Date(after) : undefined;
	const canReadChat = chatOpen;
	const messages = canReadChat
		? await listMessages(
				state.id,
				state.startedAt,
				afterDate && !Number.isNaN(afterDate.getTime()) ? afterDate : undefined,
				currentUser.id,
				undefined,
				undefined,
				afterId
			)
		: [];
	const images = canRevealImages ? await getBroadcastIllustrations(state.id) : [];

	return json({
		broadcast: {
			...state,
			audioUrl: canRevealAudio ? state.audioUrl : '',
			scheduledStartAt: state.scheduledStartAt.toISOString(),
			startedAt: state.startedAt?.toISOString() ?? null,
			endedAt: state.endedAt?.toISOString() ?? null,
			publishedAt: state.publishedAt?.toISOString() ?? null,
			kind,
			canReplay: canReplay(state)
		},
		messages,
		images,
		chatOpen,
		listeners,
		participants,
		serverNow: now.toISOString(),
		user: { id: currentUser.id, name: currentUser.name, role: currentUser.role }
	});
};
