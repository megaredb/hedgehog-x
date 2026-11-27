import { error, json } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { broadcastMessages, broadcastReactions } from '$lib/server/db/schema';
import { broadcastKind, hasBroadcastAccess, syncBroadcast } from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

const ALLOWED = new Set(['👍', '❤️', '🔥', '😂']);

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Требуется вход');
	if (!(await hasBroadcastAccess(currentUser))) throw error(403, 'Нужна подписка');
	const state = await syncBroadcast(params.id ?? '');
	if (!state || broadcastKind(state) !== 'live')
		throw error(409, 'Реакции доступны только в эфире');
	if (!state.chatEnabled) throw error(403, 'Чат отключён');
	const payload = await request.json().catch(() => null);
	const messageId = typeof payload?.messageId === 'string' ? payload.messageId : '';
	const emoji = typeof payload?.emoji === 'string' ? payload.emoji : '';
	if (!messageId || !ALLOWED.has(emoji)) throw error(400, 'Некорректная реакция');
	const [message] = await db
		.select({ id: broadcastMessages.id, userId: broadcastMessages.userId })
		.from(broadcastMessages)
		.where(and(eq(broadcastMessages.id, messageId), eq(broadcastMessages.broadcastId, state.id)))
		.limit(1);
	if (!message) throw error(404, 'Сообщение не найдено');
	if (message.userId === currentUser.id) throw error(403, 'Нельзя реагировать на своё сообщение');
	const myReaction = await db.transaction(async (tx) => {
		const [existing] = await tx
			.select({ emoji: broadcastReactions.emoji })
			.from(broadcastReactions)
			.where(
				and(
					eq(broadcastReactions.messageId, messageId),
					eq(broadcastReactions.userId, currentUser.id)
				)
			)
			.limit(1);
		if (existing?.emoji === emoji) {
			await tx
				.delete(broadcastReactions)
				.where(
					and(
						eq(broadcastReactions.messageId, messageId),
						eq(broadcastReactions.userId, currentUser.id)
					)
				);
			return null;
		}
		await tx
			.delete(broadcastReactions)
			.where(
				and(
					eq(broadcastReactions.messageId, messageId),
					eq(broadcastReactions.userId, currentUser.id)
				)
			);
		await tx
			.insert(broadcastReactions)
			.values({ messageId, userId: currentUser.id, emoji })
			.onConflictDoNothing();
		return emoji;
	});
	const rows = await db
		.select({ emoji: broadcastReactions.emoji, value: sql<number>`count(*)` })
		.from(broadcastReactions)
		.where(eq(broadcastReactions.messageId, messageId))
		.groupBy(broadcastReactions.emoji);
	const reactions = Object.fromEntries(
		rows.map((row) => [row.emoji, Number(row.value)] as const).sort((a, b) => b[1] - a[1])
	);
	return json({ reactions, myReaction });
};
