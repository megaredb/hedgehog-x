import { json } from '@sveltejs/kit';
import {
	activeBroadcastParticipants,
	activeListenerCount,
	broadcastKind,
	loadActiveBroadcast
} from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const now = new Date();
	const state = await loadActiveBroadcast(now);
	if (!state) return json({ broadcast: null, serverNow: now.toISOString() });
	const listeners = await activeListenerCount(state.id, now);
	const participants = await activeBroadcastParticipants(state.id, now);
	return json({
		broadcast: {
			id: state.id,
			title: state.title,
			coverUrl: state.coverUrl,
			scheduledStartAt: state.scheduledStartAt.toISOString(),
			startedAt: state.startedAt?.toISOString() ?? null,
			endedAt: state.endedAt?.toISOString() ?? null,
			publishedAt: state.publishedAt?.toISOString() ?? null,
			kind: broadcastKind(state, now),
			listeners,
			participants
		},
		serverNow: now.toISOString()
	});
};
