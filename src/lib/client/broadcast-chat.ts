import { db, type OfflineBroadcastChat, type OfflineBroadcastChatMessage } from '$lib/client/db';

export async function saveBroadcastChat(input: {
	broadcastId: string;
	chapterId: string;
	title: string;
	bookTitle?: string;
	volumeTitle?: string;
	coverUrl?: string | null;
	href: string;
	messages: Array<{
		id: string;
		userId: string | null;
		name: string;
		avatar: string | null;
		body: string;
		createdAt: Date | string;
		offsetSeconds: number;
		subscription: 'none' | 'active' | 'lifetime';
		replyToId?: string | null;
		replyToName?: string | null;
		replyToBody?: string | null;
		linkUrl?: string | null;
		linkTitle?: string | null;
		linkDescription?: string | null;
		linkImage?: string | null;
		reactions?: Record<string, number>;
	}>;
}): Promise<OfflineBroadcastChat> {
	const messages: OfflineBroadcastChatMessage[] = input.messages.map((message) => ({
		id: message.id,
		userId: message.userId,
		name: message.name,
		avatar: message.avatar,
		body: message.body,
		createdAt:
			message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
		offsetSeconds: message.offsetSeconds,
		subscription: message.subscription,
		replyToId: message.replyToId ?? null,
		replyToName: message.replyToName ?? null,
		replyToBody: message.replyToBody ?? null,
		linkUrl: message.linkUrl ?? null,
		linkTitle: message.linkTitle ?? null,
		linkDescription: message.linkDescription ?? null,
		linkImage: message.linkImage ?? null,
		reactions: message.reactions ?? {}
	}));
	const record: OfflineBroadcastChat = {
		broadcastId: input.broadcastId,
		chapterId: input.chapterId,
		title: input.title,
		bookTitle: input.bookTitle,
		volumeTitle: input.volumeTitle,
		coverUrl: input.coverUrl,
		href: input.href,
		messages,
		savedAt: Date.now()
	};
	await db.broadcastChats.put(record);
	return record;
}

export async function loadBroadcastChat(broadcastId: string) {
	return db.broadcastChats.get(broadcastId);
}
