export type OgType = 'website' | 'book' | 'music.album' | 'music.song';

export interface OpenGraphMetaProps {
	title: string;
	description?: string | null;
	image?: string | null;
	type?: OgType;
	audio?: string | null;
	url?: string | null;
	siteName?: string;
}

export interface ResolvedOgMetadata {
	title: string;
	description: string;
	type: OgType;
	image: string;
	audio: string | null;
	url: string;
	siteName: string;
}

export const DEFAULT_OG_SITE_NAME = 'Hedgehog X';
export const DEFAULT_OG_DESCRIPTION = 'Слушайте аудиокниги онлайн на Hedgehog X';
export const DEFAULT_OG_IMAGE = '/logo.webp';
export const DEFAULT_OG_TYPE: OgType = 'website';

/**
 * Resolves a given URL to an absolute URL using the provided origin.
 * If the URL is already absolute (http://, https://, or data:), it is returned trimmed.
 * If the URL is protocol-relative (//example.com/...), it is prefixed with https: or the origin's protocol.
 * If origin is provided and the URL is relative, combines them without duplicate slashes.
 * If URL is empty or nullish, returns empty string.
 */
export function toAbsoluteUrl(url?: string | null, origin?: string | null): string {
	if (!url || typeof url !== 'string') {
		return '';
	}

	const trimmedUrl = url.trim();
	if (!trimmedUrl) {
		return '';
	}

	// Already absolute with scheme
	if (
		/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedUrl) ||
		trimmedUrl.startsWith('data:') ||
		trimmedUrl.startsWith('blob:')
	) {
		return trimmedUrl;
	}

	// Protocol-relative URL (e.g. //cdn.example.com/image.png)
	if (trimmedUrl.startsWith('//')) {
		if (origin && origin.trim()) {
			const originScheme = origin.trim().split(':')[0];
			if (originScheme && originScheme.startsWith('http')) {
				return `${originScheme}:${trimmedUrl}`;
			}
		}
		return `https:${trimmedUrl}`;
	}

	// Relative URL - resolve against origin if available
	if (origin && origin.trim()) {
		const cleanOrigin = origin.trim().replace(/\/+$/, '');
		const cleanPath = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;
		return `${cleanOrigin}${cleanPath}`;
	}

	return trimmedUrl;
}

/**
 * Resolves OpenGraph metadata with proper fallbacks and absolute URL conversions.
 */
export function resolveOgMetadata(
	props: OpenGraphMetaProps,
	currentUrl?: string | null,
	origin?: string | null
): ResolvedOgMetadata {
	const siteName = props.siteName?.trim() || DEFAULT_OG_SITE_NAME;
	const title = props.title?.trim() || siteName;
	const description = props.description?.trim() || DEFAULT_OG_DESCRIPTION;
	const type = props.type || DEFAULT_OG_TYPE;

	const rawImage = props.image?.trim() || DEFAULT_OG_IMAGE;
	const image = toAbsoluteUrl(rawImage, origin);

	const audio = props.audio?.trim() ? toAbsoluteUrl(props.audio.trim(), origin) : null;

	let url: string;
	if (props.url?.trim()) {
		url = toAbsoluteUrl(props.url.trim(), origin);
	} else if (currentUrl?.trim()) {
		url = currentUrl.trim();
	} else if (origin?.trim()) {
		url = origin.trim().replace(/\/+$/, '');
	} else {
		url = '';
	}

	return {
		title,
		description,
		type,
		image,
		audio,
		url,
		siteName
	};
}

/**
 * Helper to build formatted title for book pages.
 */
export function formatBookOgTitle(bookTitle?: string | null, fallback = 'Книга'): string {
	const title = bookTitle?.trim() || fallback;
	return `${title} | Тома`;
}

/**
 * Helper to build formatted title for volume/audiobook pages.
 */
export function formatVolumeOgTitle(
	volumeTitle?: string | null,
	bookTitle?: string | null,
	siteName: string = DEFAULT_OG_SITE_NAME
): string {
	const cleanVolume = volumeTitle?.trim();
	const cleanBook = bookTitle?.trim();

	if (cleanVolume && cleanBook) {
		return `${cleanVolume} | ${cleanBook} | ${siteName}`;
	}
	if (cleanVolume) {
		return `${cleanVolume} | ${siteName}`;
	}
	if (cleanBook) {
		return `${cleanBook} | ${siteName}`;
	}
	return `Аудиокнига | ${siteName}`;
}
