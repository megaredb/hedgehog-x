import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	chapterIllustrations,
	broadcastListeners,
	broadcastReactions,
	broadcastMessages,
	broadcastProgress,
	broadcastViews,
	broadcasts,
	books,
	chapters,
	illustrations,
	volumes
} from '$lib/server/db/schema';
import { user } from '$lib/server/db/auth.schema';
import { isAdminRole } from '$lib/server/admin';
import {
	getSubscriptionSummary,
	getSubscriptionSummaries
} from '$lib/server/subscriptions/entitlement';
import { fetchLinkPreview } from '$lib/server/og-preview';
import {
	broadcastKind,
	canJoinLive,
	canReplay,
	validateChatBody,
	validateChatBodyDetailed,
	allowedChatHosts,
	MAX_CHAT_LENGTH,
	CHAT_RATE_LIMIT,
	CHAT_RATE_WINDOW_MS,
	type BroadcastKind,
	type BroadcastState
} from '$lib/broadcasts/domain';
export {
	broadcastKind,
	canJoinLive,
	canReplay,
	validateChatBody,
	validateChatBodyDetailed,
	allowedChatHosts,
	MAX_CHAT_LENGTH,
	CHAT_RATE_LIMIT,
	CHAT_RATE_WINDOW_MS,
	type BroadcastKind,
	type BroadcastState
};

export const ACTIVE_LISTENER_WINDOW_MS = 30_000;
export const CHAT_PAGE_SIZE = 30;

const MAX_ACTIVE_BROADCAST_CACHE = 200;
const MAX_LISTENER_COUNT_CACHE = 500;
const MAX_SUBSCRIPTION_CACHE = 2000;
const VIEW_DEDUP_WINDOW_MS = 60_000;

const activeBroadcastCache = new Map<string, { value: BroadcastState; expiresAt: number }>();
const listenerCountCache = new Map<string, { value: number; expiresAt: number }>();

function setBoundedCache<T extends { expiresAt: number }>(
	cache: Map<string, T>,
	key: string,
	value: T,
	maxSize: number
): void {
	const now = Date.now();
	if (cache.size >= maxSize) {
		for (const [k, entry] of cache) {
			if (entry.expiresAt <= now) cache.delete(k);
		}
	}
	while (cache.size >= maxSize) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey === undefined) break;
		cache.delete(oldestKey);
	}
	cache.set(key, value);
}

export function invalidateActiveBroadcastCache(id?: string): void {
	if (id) {
		activeBroadcastCache.delete(id);
	} else {
		activeBroadcastCache.clear();
	}
}

export interface ChatMessage {
	id: string;
	userId: string | null;
	name: string;
	avatar: string | null;
	body: string;
	createdAt: Date;
	offsetSeconds: number;
	subscription: 'none' | 'active' | 'lifetime';
	replyToId: string | null;
	replyToName: string | null;
	replyToBody: string | null;
	linkUrl: string | null;
	linkTitle: string | null;
	linkDescription: string | null;
	linkImage: string | null;
	taggedIllustrationIds: string[];
	reactions: Record<string, number>;
	myReaction: string | null;
}

export async function loadBroadcastState(id: string): Promise<BroadcastState | null> {
	const [row] = await db
		.select({
			id: broadcasts.id,
			chapterId: broadcasts.chapterId,
			title: broadcasts.title,
			description: broadcasts.description,
			coverUrl: broadcasts.coverUrl,
			coverBlurhash: broadcasts.coverBlurhash,
			scheduledStartAt: broadcasts.scheduledStartAt,
			startedAt: broadcasts.startedAt,
			endedAt: broadcasts.endedAt,
			saveRecording: broadcasts.saveRecording,
			publishAfterEnd: broadcasts.publishAfterEnd,
			chatEnabled: broadcasts.chatEnabled,
			publishedAt: broadcasts.publishedAt,
			chapterTitle: chapters.title,
			volumeTitle: volumes.title,
			volumeBlurhash: volumes.blurhash,
			bookTitle: books.title,
			audioUrl: chapters.audioUrl,
			durationSeconds: chapters.durationSeconds,
			volumeId: chapters.volumeId,
			bookId: volumes.bookId
		})
		.from(broadcasts)
		.innerJoin(chapters, eq(chapters.id, broadcasts.chapterId))
		.innerJoin(volumes, eq(volumes.id, chapters.volumeId))
		.innerJoin(books, eq(books.id, volumes.bookId))
		.where(eq(broadcasts.id, id))
		.limit(1);
	if (!row) return null;
	return row as BroadcastState;
}

/** Fast existence check used by the persistent player to drop deleted broadcasts. */
export async function broadcastExists(id: string): Promise<boolean> {
	if (!id) return false;
	const [row] = await db
		.select({ id: broadcasts.id })
		.from(broadcasts)
		.where(eq(broadcasts.id, id))
		.limit(1);
	return Boolean(row);
}

/** Lazily starts/ends a broadcast and publishes its chapter at start. */
export async function syncBroadcast(id: string, now = new Date()): Promise<BroadcastState | null> {
	const state = await loadBroadcastState(id);
	if (!state) return null;
	let startedAt = state.startedAt;
	let endedAt = state.endedAt;
	let publishedAt = state.publishedAt;
	let changed = false;

	if (!startedAt && now >= state.scheduledStartAt) {
		startedAt = state.scheduledStartAt;
		changed = true;
		await db.update(chapters).set({ published: true }).where(eq(chapters.id, state.chapterId));
	}
	if (startedAt && !endedAt) {
		const expectedEnd = new Date(startedAt.getTime() + state.durationSeconds * 1000);
		if (now >= expectedEnd) {
			endedAt = expectedEnd;
			changed = true;
			if (state.saveRecording && state.publishAfterEnd && !publishedAt) publishedAt = endedAt;
			if (!state.saveRecording) {
				await db.delete(broadcastMessages).where(eq(broadcastMessages.broadcastId, id));
			}
		}
	}
	if (changed) {
		await db
			.update(broadcasts)
			.set({ startedAt, endedAt, publishedAt, updatedAt: new Date() })
			.where(eq(broadcasts.id, id));
		invalidateActiveBroadcastCache(id);
	}
	return { ...state, startedAt, endedAt, publishedAt };
}

export async function markBroadcastStarted(id: string): Promise<BroadcastState | null> {
	const state = await loadBroadcastState(id);
	if (!state) return null;
	if (!state.startedAt) {
		await db
			.update(broadcasts)
			.set({ startedAt: new Date(), updatedAt: new Date() })
			.where(eq(broadcasts.id, id));
		await db.update(chapters).set({ published: true }).where(eq(chapters.id, state.chapterId));
	}
	invalidateActiveBroadcastCache(id);
	return (await syncBroadcast(id)) ?? state;
}

export async function markBroadcastEnded(id: string): Promise<BroadcastState | null> {
	const state = await loadBroadcastState(id);
	if (!state) return null;
	const endedAt = state.endedAt ?? new Date();
	const publishedAt =
		state.saveRecording && state.publishAfterEnd
			? (state.publishedAt ?? endedAt)
			: state.publishedAt;
	await db
		.update(broadcasts)
		.set({ endedAt, publishedAt, updatedAt: new Date() })
		.where(eq(broadcasts.id, id));
	if (!state.saveRecording) {
		await db.delete(broadcastMessages).where(eq(broadcastMessages.broadcastId, id));
	}
	invalidateActiveBroadcastCache(id);
	return (await syncBroadcast(id)) ?? state;
}

export async function publishBroadcast(id: string): Promise<void> {
	await db
		.update(broadcasts)
		.set({ publishedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(broadcasts.id, id), eq(broadcasts.saveRecording, true)));
	invalidateActiveBroadcastCache(id);
}

const subscriptionCache = new Map<string, { active: boolean; expiresAt: number }>();

export async function loadActiveBroadcast(now = new Date()): Promise<BroadcastState | null> {
	const rows = await db
		.select({ id: broadcasts.id })
		.from(broadcasts)
		.where(
			and(
				isNull(broadcasts.endedAt),
				gt(broadcasts.scheduledStartAt, new Date(now.getTime() - 12 * 60 * 60 * 1000))
			)
		)
		.orderBy(asc(broadcasts.scheduledStartAt))
		.limit(10);
	for (const row of rows) {
		const cached = activeBroadcastCache.get(row.id);
		if (cached && cached.expiresAt > Date.now()) {
			const cachedKind = broadcastKind(cached.value, now);
			if (cachedKind === 'live' || cachedKind === 'scheduled') return cached.value;
			activeBroadcastCache.delete(row.id);
		}
		const state = await syncBroadcast(row.id, now);
		if (!state) continue;
		const kind = broadcastKind(state, now);
		if (kind === 'live' || kind === 'scheduled') {
			setBoundedCache(
				activeBroadcastCache,
				row.id,
				{ value: state, expiresAt: Date.now() + 1200 },
				MAX_ACTIVE_BROADCAST_CACHE
			);
			return state;
		}
	}
	return null;
}

export async function hasBroadcastSubscription(userId: string): Promise<boolean> {
	const cached = subscriptionCache.get(userId);
	if (cached && cached.expiresAt > Date.now()) return cached.active;
	const summary = await getSubscriptionSummary(userId);
	const active = Boolean(summary.active);
	setBoundedCache(
		subscriptionCache,
		userId,
		{ active, expiresAt: Date.now() + 10_000 },
		MAX_SUBSCRIPTION_CACHE
	);
	return active;
}

export async function hasBroadcastAccess(
	currentUser: { id: string; role?: string | null } | null | undefined
): Promise<boolean> {
	if (!currentUser) return false;
	if (isAdminRole(currentUser.role)) return true;
	return hasBroadcastSubscription(currentUser.id);
}

export async function activeListenerCount(broadcastId: string, now = new Date()): Promise<number> {
	const cached = listenerCountCache.get(broadcastId);
	if (cached && cached.expiresAt > Date.now()) return cached.value;
	const since = new Date(now.getTime() - ACTIVE_LISTENER_WINDOW_MS);
	const [row] = await db
		.select({ value: sql<number>`count(*)` })
		.from(broadcastListeners)
		.where(
			and(
				eq(broadcastListeners.broadcastId, broadcastId),
				isNull(broadcastListeners.leftAt),
				gt(broadcastListeners.lastSeenAt, since)
			)
		);
	const value = Number(row?.value ?? 0);
	setBoundedCache(
		listenerCountCache,
		broadcastId,
		{ value, expiresAt: Date.now() + 1000 },
		MAX_LISTENER_COUNT_CACHE
	);
	return value;
}

export type BroadcastParticipant = { id: string; name: string; image: string | null };

export async function activeBroadcastParticipants(
	broadcastId: string,
	now = new Date()
): Promise<BroadcastParticipant[]> {
	const since = new Date(now.getTime() - ACTIVE_LISTENER_WINDOW_MS);
	return db
		.select({ id: user.id, name: user.name, image: user.image })
		.from(broadcastListeners)
		.innerJoin(user, eq(user.id, broadcastListeners.userId))
		.where(
			and(
				eq(broadcastListeners.broadcastId, broadcastId),
				isNull(broadcastListeners.leftAt),
				gt(broadcastListeners.lastSeenAt, since)
			)
		)
		.orderBy(asc(user.name))
		.limit(100);
}

export async function broadcastViewerParticipants(
	broadcastId: string
): Promise<BroadcastParticipant[]> {
	return db
		.select({ id: user.id, name: user.name, image: user.image })
		.from(broadcastViews)
		.innerJoin(user, eq(user.id, broadcastViews.userId))
		.where(eq(broadcastViews.broadcastId, broadcastId))
		.groupBy(user.id, user.name, user.image)
		.orderBy(asc(user.name))
		.limit(100);
}

export async function touchListener(
	broadcastId: string,
	userId: string,
	now = new Date()
): Promise<number> {
	await db
		.insert(broadcastListeners)
		.values({ broadcastId, userId, joinedAt: now, lastSeenAt: now, leftAt: null })
		.onConflictDoUpdate({
			target: [broadcastListeners.broadcastId, broadcastListeners.userId],
			set: { lastSeenAt: now, leftAt: null }
		});
	listenerCountCache.delete(broadcastId);
	return activeListenerCount(broadcastId, now);
}

export async function leaveListener(broadcastId: string, userId: string): Promise<void> {
	listenerCountCache.delete(broadcastId);
	await db
		.update(broadcastListeners)
		.set({ leftAt: new Date() })
		.where(
			and(eq(broadcastListeners.broadcastId, broadcastId), eq(broadcastListeners.userId, userId))
		);
}

export interface StoredBroadcastProgress {
	positionSeconds: number;
	kind: 'live' | 'replay';
	isCompleted: boolean;
	updatedAt: Date;
}

export async function loadBroadcastProgress(
	userId: string,
	broadcastId: string
): Promise<StoredBroadcastProgress | null> {
	const [row] = await db
		.select({
			positionSeconds: broadcastProgress.positionSeconds,
			kind: broadcastProgress.kind,
			isCompleted: broadcastProgress.isCompleted,
			updatedAt: broadcastProgress.updatedAt
		})
		.from(broadcastProgress)
		.where(
			and(eq(broadcastProgress.userId, userId), eq(broadcastProgress.broadcastId, broadcastId))
		)
		.limit(1);
	if (!row) return null;
	return { ...row, kind: row.kind === 'live' ? 'live' : 'replay' };
}

/** Upsert progress: last-write-wins for replay so seeking backwards and re-watching work. */
export async function saveBroadcastProgress(params: {
	userId: string;
	broadcastId: string;
	kind: 'live' | 'replay';
	positionSeconds: number;
	isCompleted: boolean;
}): Promise<void> {
	const now = new Date();
	await db
		.insert(broadcastProgress)
		.values({
			userId: params.userId,
			broadcastId: params.broadcastId,
			kind: params.kind,
			positionSeconds: params.positionSeconds,
			isCompleted: params.isCompleted,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [broadcastProgress.userId, broadcastProgress.broadcastId],
			set:
				params.kind === 'replay'
					? {
							kind: params.kind,
							positionSeconds: params.positionSeconds,
							isCompleted: params.isCompleted,
							updatedAt: now
						}
					: {
							kind: params.kind,
							positionSeconds: sql`GREATEST(${broadcastProgress.positionSeconds}, ${params.positionSeconds})`,
							isCompleted: sql`${broadcastProgress.isCompleted} OR ${params.isCompleted}`,
							updatedAt: now
						}
		});
}

export async function recordBroadcastView(
	broadcastId: string,
	userId: string,
	kind: 'live' | 'replay',
	now = new Date()
): Promise<void> {
	const since = new Date(now.getTime() - VIEW_DEDUP_WINDOW_MS);
	const [recent] = await db
		.select({ id: broadcastViews.id })
		.from(broadcastViews)
		.where(
			and(
				eq(broadcastViews.broadcastId, broadcastId),
				eq(broadcastViews.userId, userId),
				eq(broadcastViews.kind, kind),
				gt(broadcastViews.lastSeenAt, since)
			)
		)
		.orderBy(desc(broadcastViews.lastSeenAt))
		.limit(1);
	if (recent) {
		await db
			.update(broadcastViews)
			.set({ lastSeenAt: now })
			.where(eq(broadcastViews.id, recent.id));
		return;
	}
	await db
		.insert(broadcastViews)
		.values({ broadcastId, userId, kind, startedAt: now, lastSeenAt: now });
}

export async function touchBroadcastView(
	broadcastId: string,
	userId: string,
	kind: 'live' | 'replay'
): Promise<void> {
	await db
		.update(broadcastViews)
		.set({ lastSeenAt: new Date() })
		.where(
			and(
				eq(broadcastViews.broadcastId, broadcastId),
				eq(broadcastViews.userId, userId),
				eq(broadcastViews.kind, kind)
			)
		);
}

export async function listMessages(
	broadcastId: string,
	startedAt: Date | null,
	afterCreatedAt?: Date,
	viewerUserId?: string | null,
	limit = CHAT_PAGE_SIZE,
	beforeCreatedAt?: Date,
	afterId?: string,
	beforeId?: string
): Promise<ChatMessage[]> {
	const afterCond = afterCreatedAt
		? afterId
			? or(
					gt(broadcastMessages.createdAt, afterCreatedAt),
					and(eq(broadcastMessages.createdAt, afterCreatedAt), gt(broadcastMessages.id, afterId))
				)
			: gt(broadcastMessages.createdAt, afterCreatedAt)
		: undefined;
	const beforeCond = beforeCreatedAt
		? beforeId
			? or(
					lt(broadcastMessages.createdAt, beforeCreatedAt),
					and(eq(broadcastMessages.createdAt, beforeCreatedAt), lt(broadcastMessages.id, beforeId))
				)
			: lt(broadcastMessages.createdAt, beforeCreatedAt)
		: undefined;
	const isForward = Boolean(afterCreatedAt);

	const rows = await db
		.select({
			id: broadcastMessages.id,
			userId: broadcastMessages.userId,
			body: broadcastMessages.body,
			replyToId: broadcastMessages.replyToId,
			replyToName: broadcastMessages.replyToName,
			replyToBody: broadcastMessages.replyToBody,
			linkUrl: broadcastMessages.linkUrl,
			linkTitle: broadcastMessages.linkTitle,
			linkDescription: broadcastMessages.linkDescription,
			linkImage: broadcastMessages.linkImage,
			taggedIllustrationIds: broadcastMessages.taggedIllustrationIds,
			createdAt: broadcastMessages.createdAt,
			name: user.name,
			image: user.image,
			telegramAvatar: user.telegramAvatar,
			discordAvatar: user.discordAvatar
		})
		.from(broadcastMessages)
		.leftJoin(user, eq(user.id, broadcastMessages.userId))
		.where(and(eq(broadcastMessages.broadcastId, broadcastId), afterCond, beforeCond))
		.orderBy(
			...(isForward
				? [asc(broadcastMessages.createdAt), asc(broadcastMessages.id)]
				: [desc(broadcastMessages.createdAt), desc(broadcastMessages.id)])
		)
		.limit(limit);
	const messageIds = rows.map((row) => row.id);
	const replyToIds = [
		...new Set(rows.map((row) => row.replyToId).filter((id): id is string => Boolean(id)))
	];
	const [reactionRows, myReactionRows, replyTargetRows] = await Promise.all([
		messageIds.length
			? db
					.select({
						messageId: broadcastReactions.messageId,
						emoji: broadcastReactions.emoji,
						value: sql<number>`count(*)`
					})
					.from(broadcastReactions)
					.where(inArray(broadcastReactions.messageId, messageIds))
					.groupBy(broadcastReactions.messageId, broadcastReactions.emoji)
			: Promise.resolve([]),
		viewerUserId && messageIds.length
			? db
					.select({ messageId: broadcastReactions.messageId, emoji: broadcastReactions.emoji })
					.from(broadcastReactions)
					.where(
						and(
							inArray(broadcastReactions.messageId, messageIds),
							eq(broadcastReactions.userId, viewerUserId)
						)
					)
			: Promise.resolve([]),
		replyToIds.length
			? db
					.select({
						id: broadcastMessages.id,
						userId: broadcastMessages.userId,
						name: user.name
					})
					.from(broadcastMessages)
					.leftJoin(user, eq(user.id, broadcastMessages.userId))
					.where(inArray(broadcastMessages.id, replyToIds))
			: Promise.resolve([])
	]);
	const reactionsByMessage = new Map<string, Record<string, number>>();
	for (const reaction of reactionRows) {
		const current = reactionsByMessage.get(reaction.messageId) ?? {};
		current[reaction.emoji] = Number(reaction.value);
		reactionsByMessage.set(reaction.messageId, current);
	}
	for (const [messageId, counts] of reactionsByMessage) {
		reactionsByMessage.set(
			messageId,
			Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]))
		);
	}
	const myReactionByMessage = new Map(myReactionRows.map((row) => [row.messageId, row.emoji]));
	const replyTargetById = new Map(replyTargetRows.map((row) => [row.id, row]));
	const userIds = [
		...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)))
	];
	const summaries = await getSubscriptionSummaries(userIds);
	const orderedRows = isForward ? rows : rows.reverse();
	return orderedRows.map((row) => {
		const replyTarget = row.replyToId ? replyTargetById.get(row.replyToId) : undefined;
		const resolvedReplyToName = row.replyToId
			? replyTarget?.userId
				? (replyTarget.name ?? 'Гость')
				: 'Гость'
			: null;
		return {
			id: row.id,
			userId: row.userId,
			name: row.name ?? 'Гость',
			avatar: row.image || row.telegramAvatar || row.discordAvatar || null,
			body: row.body,
			createdAt: row.createdAt,
			replyToId: row.replyToId,
			replyToName: resolvedReplyToName,
			replyToBody: row.replyToBody,
			linkUrl: row.linkUrl,
			linkTitle: row.linkTitle,
			linkDescription: row.linkDescription,
			linkImage: row.linkImage,
			taggedIllustrationIds: row.taggedIllustrationIds ?? [],
			offsetSeconds: startedAt
				? Math.max(0, Math.round((row.createdAt.getTime() - startedAt.getTime()) / 1000))
				: 0,
			subscription: summaries.get(row.userId ?? '')?.isLifetime
				? 'lifetime'
				: summaries.get(row.userId ?? '')?.active
					? 'active'
					: 'none',
			reactions: reactionsByMessage.get(row.id) ?? {},
			myReaction: myReactionByMessage.get(row.id) ?? null
		};
	});
}

export async function chatRateLimitMessage(
	broadcastId: string,
	userId: string,
	now = new Date()
): Promise<boolean> {
	const since = new Date(now.getTime() - CHAT_RATE_WINDOW_MS);
	const [row] = await db
		.select({ value: sql<number>`count(*)` })
		.from(broadcastMessages)
		.where(
			and(
				eq(broadcastMessages.broadcastId, broadcastId),
				eq(broadcastMessages.userId, userId),
				gt(broadcastMessages.createdAt, since)
			)
		);
	return Number(row?.value ?? 0) < CHAT_RATE_LIMIT;
}

export type AddMessageResult =
	| { message: ChatMessage; error: null }
	| { message: null; error: 'rate_limited' | 'reply_not_found' };

export async function addMessage(
	broadcastId: string,
	userId: string,
	body: string,
	currentHost?: string,
	replyToId?: string,
	taggedIllustrationIds: string[] = []
): Promise<AddMessageResult> {
	let replyToName: string | null = null;
	let replyToBody: string | null = null;
	if (replyToId) {
		const [target] = await db
			.select({ body: broadcastMessages.body, userId: broadcastMessages.userId, name: user.name })
			.from(broadcastMessages)
			.leftJoin(user, eq(user.id, broadcastMessages.userId))
			.where(
				and(eq(broadcastMessages.id, replyToId), eq(broadcastMessages.broadcastId, broadcastId))
			)
			.limit(1);
		if (!target) return { message: null, error: 'reply_not_found' };
		replyToName = target.userId ? (target.name ?? 'Гость') : 'Гость';
		replyToBody = target.body;
	}
	const link = body.match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? null;
	const preview = link ? await fetchLinkPreview(link, currentHost) : null;

	const inserted = await db.transaction(async (tx) => {
		await tx.execute(
			sql`SELECT pg_advisory_xact_lock(hashtext(${broadcastId}), hashtext(${userId}))`
		);
		const since = new Date(Date.now() - CHAT_RATE_WINDOW_MS);
		const [countRow] = await tx
			.select({ value: sql<number>`count(*)` })
			.from(broadcastMessages)
			.where(
				and(
					eq(broadcastMessages.broadcastId, broadcastId),
					eq(broadcastMessages.userId, userId),
					gt(broadcastMessages.createdAt, since)
				)
			);
		if (Number(countRow?.value ?? 0) >= CHAT_RATE_LIMIT) {
			return null;
		}
		const [row] = await tx
			.insert(broadcastMessages)
			.values({
				broadcastId,
				userId,
				body,
				replyToId: replyToId ?? null,
				replyToName,
				replyToBody,
				linkUrl: link,
				linkTitle: preview?.title ?? null,
				linkDescription: preview?.description ?? null,
				linkImage: preview?.image ?? null,
				taggedIllustrationIds
			})
			.returning({ id: broadcastMessages.id, createdAt: broadcastMessages.createdAt });
		return row ?? null;
	});

	if (!inserted) return { message: null, error: 'rate_limited' };
	const [profile] = await db
		.select({
			name: user.name,
			image: user.image,
			telegramAvatar: user.telegramAvatar,
			discordAvatar: user.discordAvatar
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	const summary = await getSubscriptionSummary(userId);
	return {
		error: null,
		message: {
			id: inserted.id,
			userId,
			name: profile?.name ?? 'Гость',
			avatar: profile?.image || profile?.telegramAvatar || profile?.discordAvatar || null,
			body,
			createdAt: inserted.createdAt,
			offsetSeconds: 0,
			subscription: summary.isLifetime ? 'lifetime' : summary.active ? 'active' : 'none',
			replyToId: replyToId ?? null,
			replyToName,
			replyToBody,
			linkUrl: link,
			linkTitle: preview?.title ?? null,
			linkDescription: preview?.description ?? null,
			linkImage: preview?.image ?? null,
			taggedIllustrationIds,
			reactions: {},
			myReaction: null
		}
	};
}

export async function broadcastViewerCount(broadcastId: string): Promise<number> {
	const [row] = await db
		.select({ value: sql<number>`count(distinct ${broadcastViews.userId})` })
		.from(broadcastViews)
		.where(eq(broadcastViews.broadcastId, broadcastId));
	return Number(row?.value ?? 0);
}

export async function getChapterIllustrations(chapterId: string) {
	return db
		.select({
			id: chapterIllustrations.id,
			imageUrl: illustrations.imageUrl,
			caption: illustrations.caption,
			showAtSeconds: chapterIllustrations.showAtSeconds,
			sortOrder: chapterIllustrations.sortOrder
		})
		.from(chapterIllustrations)
		.innerJoin(illustrations, eq(illustrations.id, chapterIllustrations.illustrationId))
		.where(eq(chapterIllustrations.chapterId, chapterId))
		.orderBy(asc(chapterIllustrations.showAtSeconds), asc(chapterIllustrations.sortOrder));
}

export async function getBroadcastIllustrations(broadcastId: string) {
	const [broadcast] = await db
		.select({ chapterId: broadcasts.chapterId })
		.from(broadcasts)
		.where(eq(broadcasts.id, broadcastId))
		.limit(1);
	if (!broadcast) return [];
	return getChapterIllustrations(broadcast.chapterId);
}
