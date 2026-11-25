import { error, json } from '@sveltejs/kit';
import {
	addMessage,
	broadcastKind,
	canReplay,
	chatRateLimitMessage,
	getBroadcastIllustrations,
	CHAT_PAGE_SIZE,
	hasBroadcastSubscription,
	listMessages,
	syncBroadcast,
	validateChatBodyDetailed
} from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Требуется вход');
	if (!(await hasBroadcastSubscription(currentUser.id))) throw error(403, 'Нужна подписка');
	const state = await syncBroadcast(params.id ?? '');
	if (!state) throw error(404, 'Трансляция не найдена');
	if (broadcastKind(state) !== 'live') throw error(409, 'Чат доступен только во время трансляции');
	if (!state.chatEnabled) throw error(403, 'Чат отключён');
	const payload = await request.json().catch(() => null);
	const validation = validateChatBodyDetailed(payload?.body, url.hostname);
	if (validation.error === 'empty') throw error(400, 'Введите сообщение');
	if (validation.error === 'too_long')
		throw error(400, 'Сообщение слишком длинное: максимум 500 символов');
	if (validation.error === 'invalid_link')
		throw error(400, 'Ссылки разрешены только на Telegram, Boosty, Discord или HEDGEHOG.INC');
	const body = validation.text;
	const replyToId =
		typeof payload?.replyToId === 'string' && payload.replyToId.length <= 36
			? payload.replyToId
			: undefined;
	const rawIllustrationIds: unknown[] = Array.isArray(payload?.illustrationIds)
		? payload.illustrationIds
		: [];
	const illustrationIds: string[] = [
		...new Set(rawIllustrationIds.filter((id): id is string => typeof id === 'string'))
	].slice(0, 10);
	const broadcastImages = await getBroadcastIllustrations(state.id);
	const allowedIllustrationIds = new Set([
		...(state.coverUrl ? ['cover'] : []),
		...broadcastImages.map((image) => image.id)
	]);
	if (illustrationIds.some((id) => !allowedIllustrationIds.has(id)))
		throw error(400, 'Иллюстрация не найдена');
	if (!(await chatRateLimitMessage(state.id, currentUser.id))) {
		throw error(429, 'Слишком много сообщений, подождите немного');
	}
	const message = await addMessage(
		state.id,
		currentUser.id,
		body,
		url.hostname,
		replyToId,
		illustrationIds
	);
	if (!message) {
		if (replyToId) throw error(400, 'Сообщение для ответа не найдено');
		throw error(429, 'Слишком много сообщений, подождите немного');
	}
	return json({
		message: {
			...message,
			createdAt: message.createdAt.toISOString(),
			offsetSeconds: state.startedAt
				? Math.max(0, Math.round((message.createdAt.getTime() - state.startedAt.getTime()) / 1000))
				: 0
		}
	});
};
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Требуется вход');
	if (!(await hasBroadcastSubscription(currentUser.id))) throw error(403, 'Нужна подписка');
	const state = await syncBroadcast(params.id ?? '');
	if (!state) throw error(404, 'Трансляция не найдена');
	const kind = broadcastKind(state);
	if (kind !== 'live' && !canReplay(state)) throw error(409, 'Чат недоступен');
	if (!state.startedAt || !state.chatEnabled) throw error(409, 'Чат недоступен');
	const beforeRaw = url.searchParams.get('before');
	const before = beforeRaw ? new Date(beforeRaw) : undefined;
	if (beforeRaw && (!before || Number.isNaN(before.getTime())))
		throw error(400, 'Некорректная дата');
	const rows = await listMessages(
		state.id,
		state.startedAt,
		undefined,
		currentUser.id,
		CHAT_PAGE_SIZE + 1,
		before
	);
	const hasMore = rows.length > CHAT_PAGE_SIZE;
	return json({ messages: hasMore ? rows.slice(1) : rows, hasMore });
};
