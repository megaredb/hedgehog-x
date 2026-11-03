/**
 * Parses Telegram post URLs or paths:
 * - https://t.me/channel_name/123
 * - http://t.me/channel_name/123
 * - t.me/channel_name/123
 * - channel_name/123
 *
 * Returns 'channel_name/123' format required for Telegram comments widget.
 */
export function extractTelegramDiscussion(urlOrPath: string | null | undefined): string | null {
	if (!urlOrPath) return null;
	const trimmed = urlOrPath.trim();
	const match = trimmed.match(/(?:https?:\/\/)?(?:t\.me\/)?([a-zA-Z0-9_]+)\/(\d+)/i);
	if (match) {
		return `${match[1]}/${match[2]}`;
	}
	return null;
}
