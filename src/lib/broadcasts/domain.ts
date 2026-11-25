export const MAX_CHAT_LENGTH = 500;
export const CHAT_RATE_LIMIT = 5;
export const CHAT_RATE_WINDOW_MS = 10_000;
export const ALLOWED_CHAT_LINK_HOSTS = [
	't.me',
	'telegram.me',
	'telegram.org',
	'boosty.to',
	'discord.gg',
	'discord.com',
	'hedgehog-inc.one',
	'hedgehog-inc.ru'
];

export type BroadcastKind = 'scheduled' | 'live' | 'ended' | 'published';

export interface BroadcastState {
	id: string;
	chapterId: string;
	title: string;
	description: string | null;
	coverUrl: string | null;
	coverBlurhash: string | null;
	volumeBlurhash: string | null;
	scheduledStartAt: Date;
	startedAt: Date | null;
	endedAt: Date | null;
	saveRecording: boolean;
	publishAfterEnd: boolean;
	chatEnabled: boolean;
	publishedAt: Date | null;
	chapterTitle: string;
	volumeTitle: string;
	bookTitle: string;
	audioUrl: string;
	durationSeconds: number;
	volumeId: string;
	bookId: string;
}

export function broadcastKind(state: BroadcastState, now = new Date()): BroadcastKind {
	if (state.publishedAt && state.endedAt) return 'published';
	if (state.endedAt) return 'ended';
	if (state.startedAt && now.getTime() < state.startedAt.getTime() + state.durationSeconds * 1000) {
		return 'live';
	}
	return 'scheduled';
}

export function canReplay(state: BroadcastState): boolean {
	return Boolean(state.endedAt && state.publishedAt && state.saveRecording);
}

export function canJoinLive(state: BroadcastState, now = new Date()): boolean {
	return broadcastKind(state, now) === 'live';
}

export function allowedChatHosts(currentHost?: string): Set<string> {
	const hosts = new Set(ALLOWED_CHAT_LINK_HOSTS);
	if (currentHost) {
		const host = currentHost.split(':')[0]?.toLowerCase();
		if (host) hosts.add(host);
	}
	return hosts;
}

export type ChatValidationError = 'empty' | 'too_long' | 'invalid_link';

export interface ChatValidationResult {
	text: string;
	error: ChatValidationError | null;
}

/** Validates text and exposes a machine-readable reason for the UI. */
export function validateChatBodyDetailed(
	body: unknown,
	currentHost?: string
): ChatValidationResult {
	if (typeof body !== 'string') return { text: '', error: 'empty' };
	const text = [...body]
		.filter((char) => {
			const code = char.charCodeAt(0);
			return code === 9 || code === 10 || code === 13 || code >= 32;
		})
		.join('')
		.trim();
	if (!text) return { text: '', error: 'empty' };
	if (text.length > MAX_CHAT_LENGTH) return { text, error: 'too_long' };
	const hosts = allowedChatHosts(currentHost);
	const links = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
	for (const raw of links) {
		try {
			const url = new URL(raw);
			const host = url.hostname.toLowerCase();
			if (![...hosts].some((allowed) => host === allowed || host.endsWith('.' + allowed))) {
				return { text, error: 'invalid_link' };
			}
		} catch {
			return { text, error: 'invalid_link' };
		}
	}
	return { text, error: null };
}

/** Validates text and permits links only to site/social hosts. */
export function validateChatBody(body: unknown, currentHost?: string): string | null {
	const result = validateChatBodyDetailed(body, currentHost);
	return result.error ? null : result.text;
}
