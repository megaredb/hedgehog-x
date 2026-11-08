export type MirrorPreference = 'auto' | 'primary' | 'ru';

export const MIRROR_STORAGE_KEY = 'hedgehog:mirror_preference';

export const PRIMARY_CDN_HOST = 'files.hedgehog-inc.one';
export const RU_CDN_HOST = 'ru-files.hedgehog-inc.one';

/**
 * Checks if the current browser hostname belongs to the Russian domain/mirror.
 */
export function isRuHost(): boolean {
	if (typeof window === 'undefined') return false;
	const hostname = window.location.hostname.toLowerCase();
	return hostname.startsWith('ru.') || hostname.includes('ru-files') || hostname.endsWith('.ru');
}

/**
 * Retrieves the user's mirror preference from localStorage (or 'auto' by default).
 */
export function getMirrorPreference(): MirrorPreference {
	if (typeof localStorage === 'undefined') return 'auto';
	try {
		const stored = localStorage.getItem(MIRROR_STORAGE_KEY);
		if (stored === 'primary' || stored === 'ru' || stored === 'auto') {
			return stored;
		}
	} catch {
		// Ignore storage errors (private mode, etc.)
	}
	return 'auto';
}

/**
 * Stores the user's mirror preference in localStorage.
 */
export function setMirrorPreference(preference: MirrorPreference): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(MIRROR_STORAGE_KEY, preference);
	} catch {
		// Ignore storage errors
	}
}

/**
 * Returns the currently active mirror CDN host according to the preference and domain detection.
 */
export function getActiveMirrorHost(preference?: MirrorPreference): string {
	const pref = preference ?? getMirrorPreference();
	const isRu = pref === 'ru' || (pref === 'auto' && isRuHost());
	return isRu ? RU_CDN_HOST : PRIMARY_CDN_HOST;
}

/**
 * Resolves an audio or media URL according to the active mirror preference and domain detection.
 *
 * Rules:
 * - Empty/null/undefined returns empty string.
 * - Relative URLs (e.g. `/audio/...`) or third-party URLs pass through unmodified.
 * - In 'auto' mode: switches to RU mirror if on RU host; switches to primary mirror otherwise.
 * - In 'ru' mode: switches to RU mirror (`ru-files.hedgehog-inc.one`).
 * - In 'primary' mode: switches to primary mirror (`files.hedgehog-inc.one`).
 */
export function resolveMediaUrl(
	url: string | null | undefined,
	preference?: MirrorPreference
): string {
	if (!url) return '';
	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return url;
	}

	const pref = preference ?? getMirrorPreference();
	const isRu = pref === 'ru' || (pref === 'auto' && isRuHost());

	if (isRu) {
		if (url.includes(PRIMARY_CDN_HOST) && !url.includes(RU_CDN_HOST)) {
			return url.replace(PRIMARY_CDN_HOST, RU_CDN_HOST);
		}
	} else {
		if (url.includes(RU_CDN_HOST)) {
			return url.replace(RU_CDN_HOST, PRIMARY_CDN_HOST);
		}
	}

	return url;
}

/**
 * Returns the fallback mirror URL for a given media URL, or null if not a Hedgehog CDN URL.
 * Toggles between `files.hedgehog-inc.one` and `ru-files.hedgehog-inc.one`.
 */
export function getFallbackMediaUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return null;
	}

	if (url.includes(PRIMARY_CDN_HOST) && !url.includes(RU_CDN_HOST)) {
		return url.replace(PRIMARY_CDN_HOST, RU_CDN_HOST);
	}

	if (url.includes(RU_CDN_HOST)) {
		return url.replace(RU_CDN_HOST, PRIMARY_CDN_HOST);
	}

	return null;
}
