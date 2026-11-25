import { DEFAULT_FEEDBACK_URL } from '$lib/types/site';

export function safeFeedbackTarget(value: unknown, fallback = DEFAULT_FEEDBACK_URL): string {
	if (typeof value !== 'string' || !value.trim()) return fallback;
	try {
		const url = new URL(value.trim());
		if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'tg:') {
			return url.toString();
		}
	} catch {
		// Fall through to the placeholder.
	}
	return fallback;
}
