/**
 * Парсит ссылки на Telegram посты вида:
 * - https://t.me/channel_name/123
 * - http://t.me/channel_name/123
 * - t.me/channel_name/123
 * - channel_name/123
 *
 * Возвращает строку формата 'channel_name/123', необходимую для виджета Telegram comments.
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
