import { json, type RequestHandler } from '@sveltejs/kit';
import { createLogger } from '$lib/logger';
import { subscriptionConfig } from '$lib/server/subscriptions/config';
import { handleTelegramChatMemberUpdate } from '$lib/server/subscriptions/sources';

const log = createLogger('TelegramWebhook');

function secureEqual(left: string, right: string): boolean {
	if (!left || !right || left.length !== right.length) return false;
	let diff = 0;
	for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
	return diff === 0;
}

interface ChatMemberUpdate {
	update_id?: number;
	chat_member?: {
		chat: { id: number; title?: string };
		from?: { id: number; username?: string };
		new_chat_member: {
			status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
			user: { id: number; username?: string; is_bot?: boolean };
			is_member?: boolean;
		};
	};
	my_chat_member?: {
		chat: { id: number; title?: string };
		new_chat_member: {
			status: string;
			user: { id: number; is_bot?: boolean };
		};
	};
}

export const POST: RequestHandler = async ({ request }) => {
	const secret = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
	if (!secureEqual(secret, subscriptionConfig.telegramWebhookSecret)) {
		return json({ ok: false, error: 'unauthorized' }, { status: 401 });
	}

	let update: ChatMemberUpdate;
	try {
		update = (await request.json()) as ChatMemberUpdate;
	} catch {
		return json({ ok: true });
	}

	try {
		if (update.chat_member) {
			const member = update.chat_member.new_chat_member;
			const result = await handleTelegramChatMemberUpdate({
				chatId: String(update.chat_member.chat.id),
				telegramUserId: String(member.user.id),
				status: member.status,
				isMember: member.is_member
			});
			if (result.handled) {
				log.info(
					`chat_member: user ${member.user.id} -> ${member.status} (chat ${update.chat_member.chat.id})`
				);
			}
		} else if (update.my_chat_member) {
			const member = update.my_chat_member.new_chat_member;
			log.info(
				`my_chat_member: bot status ${member.status} in chat ${update.my_chat_member.chat.id}`
			);
		}
	} catch (error) {
		log.error('Failed to process Telegram update', error);
	}

	// Telegram retries non-2xx responses. The source state is reconciled by the next check.
	return json({ ok: true });
};
