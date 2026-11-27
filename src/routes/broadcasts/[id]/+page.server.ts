import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { broadcastProgress } from '$lib/server/db/schema';
import {
	activeBroadcastParticipants,
	broadcastKind,
	broadcastViewerParticipants,
	canReplay,
	broadcastViewerCount,
	CHAT_PAGE_SIZE,
	getBroadcastIllustrations,
	isBroadcastChatOpen,
	listMessages,
	syncBroadcast
} from '$lib/server/broadcasts';
import { getSubscriptionSummary } from '$lib/server/subscriptions/entitlement';
import { loadSitePage } from '$lib/server/site-content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const currentUser = locals.user;
	const state = await syncBroadcast(params.id);
	if (!state) throw error(404, 'Трансляция не найдена');
	const kind = broadcastKind(state);
	const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'author';
	if (kind === 'ended' && !canReplay(state) && !isAdmin) {
		throw error(404, 'Трансляция не опубликована');
	}
	if (kind === 'scheduled' && !isAdmin && state.startedAt) {
		throw error(404, 'Трансляция недоступна');
	}
	const savedProgress = currentUser
		? ((
				await db
					.select({
						positionSeconds: broadcastProgress.positionSeconds,
						kind: broadcastProgress.kind,
						isCompleted: broadcastProgress.isCompleted,
						updatedAt: broadcastProgress.updatedAt
					})
					.from(broadcastProgress)
					.where(
						and(
							eq(broadcastProgress.userId, currentUser.id),
							eq(broadcastProgress.broadcastId, params.id)
						)
					)
					.limit(1)
			)[0] ?? null)
		: null;

	const subscription = currentUser ? await getSubscriptionSummary(currentUser.id) : null;
	const subscribed = Boolean(subscription?.active);
	const canWatch = Boolean(currentUser && (subscribed || isAdmin));
	const canRevealImages = canWatch;
	const canRevealAudio = canWatch && (kind !== 'scheduled' || isAdmin);
	const canReadChat = canWatch && isBroadcastChatOpen(state);
	const [latestMessages, illustrations] = await Promise.all([
		canReadChat
			? listMessages(state.id, state.startedAt, undefined, currentUser?.id, CHAT_PAGE_SIZE + 1)
			: Promise.resolve([]),
		canRevealImages ? getBroadcastIllustrations(state.id) : Promise.resolve([])
	]);
	const hasMoreMessages = latestMessages.length > CHAT_PAGE_SIZE;
	const viewersCount = kind === 'published' ? await broadcastViewerCount(state.id) : 0;
	const supportPage = await loadSitePage('support');
	const support = (supportPage.data as { support?: Record<string, unknown> }).support ?? null;
	const participants =
		kind === 'live'
			? await activeBroadcastParticipants(state.id)
			: kind === 'published'
				? await broadcastViewerParticipants(state.id)
				: [];
	const messages = hasMoreMessages ? latestMessages.slice(1) : latestMessages;
	const images = canRevealImages
		? [
				...(state.coverUrl
					? [
							{
								id: 'cover',
								imageUrl: state.coverUrl,
								caption: 'Обложка',
								showAtSeconds: 0,
								sortOrder: -1
							}
						]
					: []),
				...illustrations
			]
		: [];
	const publicBroadcast = canRevealAudio ? state : { ...state, audioUrl: '' };
	return {
		broadcast: publicBroadcast,
		kind,
		canWatch,
		savedProgress,
		isAdmin,
		isAuthenticated: Boolean(currentUser),
		subscribed,
		chatEnabled: state.chatEnabled,
		chatOpen: canReadChat,
		messages,
		hasMoreMessages,
		viewersCount,
		participants,
		support,
		images,
		serverNow: new Date(),
		user: currentUser ? { id: currentUser.id, name: currentUser.name } : null
	};
};
