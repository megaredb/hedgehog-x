import { DEFAULT_SITE_MIRRORS, type SiteMirror } from '$lib/types/site';

export type MirrorPreference = string;

export const MIRROR_STORAGE_KEY = 'hedgehog:mirror_preference';

export const PRIMARY_CDN_HOST = 'files.hedgehog-inc.one';
export const RU_CDN_HOST = 'ru-files.hedgehog-inc.one';

let configuredMirrors: SiteMirror[] = structuredClone(DEFAULT_SITE_MIRRORS);

/** Applies mirrors loaded from site settings for the current app session. */
export function configureMirrors(mirrors: SiteMirror[] | null | undefined): void {
	configuredMirrors =
		Array.isArray(mirrors) && mirrors.length > 0
			? mirrors.map((mirror) => ({ ...mirror }))
			: structuredClone(DEFAULT_SITE_MIRRORS);
}

export function getMirrorOptions(): Array<{
	value: 'auto' | string;
	label: string;
	description: string;
}> {
	return [
		{
			value: 'auto',
			label: 'Автоматически',
			description: 'Определение по домену + авто-fallback при сбоях'
		},
		...configuredMirrors
			.filter((mirror) => mirror.enabled)
			.map((mirror) => ({
				value: mirror.id,
				label: mirror.label,
				description: mirror.description || mirror.host
			}))
	];
}

/**
 * Checks if the current browser hostname belongs to the Russian domain/mirror.
 */
export function isRuHost(): boolean {
	if (typeof window === 'undefined') return false;
	const hostname = window.location.hostname.toLowerCase();
	return hostname.startsWith('ru.') || hostname.includes('ru-files') || hostname.endsWith('.ru');
}

function autoMirror(): SiteMirror | null {
	const enabled = configuredMirrors.filter((mirror) => mirror.enabled);
	if (enabled.length === 0) return null;
	if (isRuHost()) {
		return (
			enabled.find((mirror) => mirror.autoRole === 'ru') ??
			enabled.find((mirror) => mirror.autoRole === 'default') ??
			enabled[0]
		);
	}
	return enabled.find((mirror) => mirror.autoRole === 'default') ?? enabled[0];
}

function activeMirror(preference?: MirrorPreference): SiteMirror | null {
	const pref = preference ?? getMirrorPreference();
	if (pref === 'auto') return autoMirror();
	return configuredMirrors.find((mirror) => mirror.id === pref && mirror.enabled) ?? autoMirror();
}

/**
 * Retrieves the user's mirror preference from localStorage (or 'auto' by default).
 */
export function getMirrorPreference(): MirrorPreference {
	if (typeof localStorage === 'undefined') return 'auto';
	try {
		const stored = localStorage.getItem(MIRROR_STORAGE_KEY);
		if (stored && (stored === 'auto' || configuredMirrors.some((mirror) => mirror.id === stored))) {
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
	return activeMirror(preference)?.host ?? PRIMARY_CDN_HOST;
}

/**
 * Resolves an audio or media URL according to the active mirror preference and domain detection.
 *
 * Rules:
 * - Empty/null/undefined returns empty string.
 * - Relative URLs (e.g. `/audio/...`) or third-party URLs pass through unmodified.
 * - Any known mirror host is replaced with the active mirror host.
 * - In 'auto' mode the RU mirror is preferred on RU domains, otherwise the default mirror.
 */
export function resolveMediaUrl(
	url: string | null | undefined,
	preference?: MirrorPreference
): string {
	if (!url) return '';
	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return url;
	}

	const active = activeMirror(preference);
	if (!active) return url;

	const source = configuredMirrors
		.filter((mirror) => mirror.host && url.includes(mirror.host))
		.sort((a, b) => b.host.length - a.host.length)[0];
	if (source && source.host !== active.host) {
		return url.replace(source.host, active.host);
	}
	return url;
}

/**
 * Returns the fallback mirror URL for a given media URL, or null if not a known CDN URL.
 */
export function getFallbackMediaUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return null;
	}

	const enabled = configuredMirrors.filter((mirror) => mirror.enabled);
	const source = enabled
		.filter((mirror) => mirror.host && url.includes(mirror.host))
		.sort((a, b) => b.host.length - a.host.length)[0];
	if (!source) return null;
	const fallback = enabled.find((mirror) => mirror.host !== source.host);
	if (!fallback) return null;
	return url.replace(source.host, fallback.host);
}
