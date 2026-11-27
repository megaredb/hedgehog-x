import { createHash, timingSafeEqual } from 'node:crypto';
import { json, type RequestHandler } from '@sveltejs/kit';
import { createLogger } from '$lib/logger';
import { subscriptionConfig } from '$lib/server/subscriptions/config';
import { handleTelegramChatMemberUpdate } from '$lib/server/subscriptions/sources';

const log = createLogger('TelegramWebhook');

const MAX_WEBHOOK_BYTES = 64 * 1024;
const MAX_TRACKED_UPDATES = 5_000;
const UPDATE_DEDUP_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_MEMBERS = 5_000;

type MemberStatus = 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
const ALLOWED_MEMBER_STATUSES = new Set<MemberStatus>([
	'creator',
	'administrator',
	'member',
	'restricted',
	'left',
	'kicked'
]);

const seenUpdateIds = new Map<number, number>();
const lastMemberEventDate = new Map<string, number>();

function secureEqual(left: string, right: string): boolean {
	if (!left || !right) return false;
	const leftDigest = createHash('sha256').update(left, 'utf8').digest();
	const rightDigest = createHash('sha256').update(right, 'utf8').digest();
	return timingSafeEqual(leftDigest, rightDigest);
}

function recordUpdateId(updateId: number): boolean {
	const now = Date.now();
	const existing = seenUpdateIds.get(updateId);
	if (existing !== undefined && existing > now) {
		return false;
	}
	if (seenUpdateIds.size >= MAX_TRACKED_UPDATES) {
		for (const [id, expiresAt] of seenUpdateIds) {
			if (expiresAt <= now) seenUpdateIds.delete(id);
		}
		while (seenUpdateIds.size >= MAX_TRACKED_UPDATES) {
			const oldest = seenUpdateIds.keys().next().value;
			if (oldest === undefined) break;
			seenUpdateIds.delete(oldest);
		}
	}
	seenUpdateIds.set(updateId, now + UPDATE_DEDUP_TTL_MS);
	return true;
}

function acceptMemberEventDate(key: string, eventDate: number): boolean {
	const previous = lastMemberEventDate.get(key);
	if (previous !== undefined && eventDate < previous) {
		return false;
	}
	if (lastMemberEventDate.has(key)) lastMemberEventDate.delete(key);
	while (lastMemberEventDate.size >= MAX_TRACKED_MEMBERS) {
		const oldest = lastMemberEventDate.keys().next().value;
		if (oldest === undefined) break;
		lastMemberEventDate.delete(oldest);
	}
	lastMemberEventDate.set(key, eventDate);
	return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSafeInt(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value);
}

async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
	const contentLength = Number(request.headers.get('content-length') ?? '0');
	if (Number.isFinite(contentLength) && contentLength > maxBytes) {
		return null;
	}
	if (!request.body) {
		const text = await request.text();
		return Buffer.byteLength(text, 'utf8') > maxBytes ? null : text;
	}
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value || value.byteLength === 0) continue;
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel().catch(() => {});
				return null;
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	return Buffer.concat(chunks).toString('utf8');
}

export const POST: RequestHandler = async ({ request }) => {
	const secret = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
	if (!secureEqual(secret, subscriptionConfig.telegramWebhookSecret)) {
		return json({ ok: false, error: 'unauthorized' }, { status: 401 });
	}

	const rawBody = await readBoundedText(request, MAX_WEBHOOK_BYTES);
	if (rawBody === null) {
		return json({ ok: false, error: 'payload_too_large' }, { status: 413 });
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawBody);
	} catch {
		return json({ ok: true });
	}
	if (!isPlainObject(parsed)) {
		return json({ ok: true });
	}

	if (parsed.update_id !== undefined) {
		if (!isSafeInt(parsed.update_id)) {
			return json({ ok: true });
		}
		if (!recordUpdateId(parsed.update_id)) {
			return json({ ok: true });
		}
	}

	try {
		if (isPlainObject(parsed.chat_member)) {
			const chatMember = parsed.chat_member;
			const chat = chatMember.chat;
			const member = chatMember.new_chat_member;
			if (
				!isPlainObject(chat) ||
				!isSafeInt(chat.id) ||
				!isPlainObject(member) ||
				!isPlainObject(member.user) ||
				!isSafeInt(member.user.id) ||
				typeof member.status !== 'string' ||
				!ALLOWED_MEMBER_STATUSES.has(member.status as MemberStatus)
			) {
				return json({ ok: true });
			}
			if (member.is_member !== undefined && typeof member.is_member !== 'boolean') {
				return json({ ok: true });
			}
			if (chatMember.date !== undefined) {
				if (typeof chatMember.date !== 'number' || !Number.isFinite(chatMember.date)) {
					return json({ ok: true });
				}
				const eventKey = `${chat.id}:${member.user.id}`;
				if (!acceptMemberEventDate(eventKey, chatMember.date)) {
					return json({ ok: true });
				}
			}

			const result = await handleTelegramChatMemberUpdate({
				chatId: String(chat.id),
				telegramUserId: String(member.user.id),
				status: member.status as MemberStatus,
				isMember: member.is_member
			});
			if (result.handled) {
				log.info(`chat_member: user ${member.user.id} -> ${member.status} (chat ${chat.id})`);
			}
		} else if (isPlainObject(parsed.my_chat_member)) {
			const myChatMember = parsed.my_chat_member;
			const chat = myChatMember.chat;
			const member = myChatMember.new_chat_member;
			if (
				isPlainObject(chat) &&
				isSafeInt(chat.id) &&
				isPlainObject(member) &&
				typeof member.status === 'string'
			) {
				log.info(`my_chat_member: bot status ${member.status} in chat ${chat.id}`);
			}
		}
	} catch (error) {
		log.error('Failed to process Telegram update', error);
	}

	// Telegram retries non-2xx responses. The source state is reconciled by the next check.
	return json({ ok: true });
};
