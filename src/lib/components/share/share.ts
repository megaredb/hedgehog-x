/**
 * Pure helpers for volume, chapter, and timestamp sharing.
 */

export interface BuildShareUrlParams {
	origin?: string;
	bookId: string;
	volumeId: string;
	chapterId?: string | null;
	timestamp?: number | null;
}

export interface BuildShareTextParams {
	bookTitle?: string | null;
	volumeTitle?: string | null;
	volumeNumber?: number | null;
	chapterTitle?: string | null;
	chapterNumber?: number | null;
	timestamp?: number | null;
	url: string;
	includeTimestamp?: boolean;
}

export interface ParsedShareParams {
	chapterId: string | null;
	timestamp: number | null;
}

/**
 * Formats seconds into human-readable timestamp string (e.g. 1:15 or 1:01:05).
 */
export function formatShareTime(seconds: number): string {
	if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) {
		return '0:00';
	}
	const totalSeconds = Math.floor(seconds);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const secs = totalSeconds % 60;

	const paddedSecs = secs.toString().padStart(2, '0');

	if (hours > 0) {
		const paddedMins = minutes.toString().padStart(2, '0');
		return `${hours}:${paddedMins}:${paddedSecs}`;
	}
	return `${minutes}:${paddedSecs}`;
}

/**
 * Builds a clean canonical share URL with optional chapter and timecode parameters.
 */
export function buildShareUrl(params: BuildShareUrlParams): string {
	const origin = params.origin ? params.origin.replace(/\/+$/, '') : '';
	const bookPart = encodeURIComponent(params.bookId || '');
	const volumePart = encodeURIComponent(params.volumeId || '');
	let path = `/books/${bookPart}/${volumePart}`;

	const searchParams = new URLSearchParams();
	if (params.chapterId && params.chapterId.trim() !== '') {
		searchParams.set('ch', params.chapterId.trim());
		if (params.timestamp != null && isFinite(params.timestamp) && params.timestamp > 0) {
			searchParams.set('t', Math.floor(params.timestamp).toString());
		}
	}

	const query = searchParams.toString();
	if (query) {
		path += `?${query}`;
	}

	return origin ? `${origin}${path}` : path;
}

/**
 * Extracts and validates `ch` and `t` query parameters from URLSearchParams or similar object.
 */
export function parseShareParams(
	searchParams: URLSearchParams | { get: (name: string) => string | null }
): ParsedShareParams {
	const chRaw = searchParams.get('ch');
	const chapterId = chRaw && chRaw.trim().length > 0 ? chRaw.trim() : null;

	const tRaw = searchParams.get('t');
	let timestamp: number | null = null;

	if (tRaw !== null && tRaw.trim().length > 0) {
		const parsed = parseFloat(tRaw.trim());
		if (!isNaN(parsed) && isFinite(parsed) && parsed >= 0) {
			timestamp = Math.max(0, parsed);
		}
	}

	return { chapterId, timestamp };
}

/**
 * Formats a clean, multi-line message suitable for messengers (Telegram, VK, WhatsApp).
 */
export function buildShareText(params: BuildShareTextParams): string {
	const lines: string[] = [];

	const book = params.bookTitle?.trim();
	const volume = params.volumeTitle?.trim();
	if (book && volume) {
		lines.push(`🎧 ${book} — ${volume}`);
	} else if (volume) {
		lines.push(`🎧 ${volume}`);
	} else if (book) {
		lines.push(`🎧 ${book}`);
	} else {
		lines.push('🎧 Аудиокнига на Hedgehog X');
	}

	const chapter = params.chapterTitle?.trim();
	const chapterNum = params.chapterNumber;
	if (chapter) {
		lines.push(`📖 ${chapter}`);
	} else if (chapterNum != null) {
		lines.push(`📖 Глава ${chapterNum}`);
	}

	if (
		params.includeTimestamp &&
		params.timestamp != null &&
		params.timestamp > 0 &&
		isFinite(params.timestamp)
	) {
		lines.push(`⏱ Таймкод: ${formatShareTime(params.timestamp)}`);
	}

	lines.push(params.url);

	return lines.join('\n');
}
