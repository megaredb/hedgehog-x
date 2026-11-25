import { allowedChatHosts } from '../broadcasts/domain';

export interface LinkPreview {
	url: string;
	title: string | null;
	description: string | null;
	image: string | null;
}

const cache = new Map<string, { value: LinkPreview; expiresAt: number }>();
const CACHE_MS = 10 * 60 * 1000;

function isAllowed(raw: string, currentHost?: string): boolean {
	try {
		const url = new URL(raw);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
		const host = url.hostname.toLowerCase();
		return [...allowedChatHosts(currentHost)].some(
			(allowed) => host === allowed || host.endsWith('.' + allowed)
		);
	} catch {
		return false;
	}
}

function decode(value: string): string {
	return value
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.trim();
}

function metaContent(html: string, key: string): string | null {
	const patterns = [
		new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i'),
		new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i')
	];
	for (const pattern of patterns) {
		const match = html.match(pattern);
		if (match?.[1]) return decode(match[1]);
	}
	return null;
}

export async function fetchLinkPreview(
	rawUrl: string,
	currentHost?: string
): Promise<LinkPreview | null> {
	if (!isAllowed(rawUrl, currentHost)) return null;
	const cached = cache.get(rawUrl);
	if (cached && cached.expiresAt > Date.now()) return cached.value;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);
	const requestedUrl = new URL(rawUrl);
	const fetchUrl = requestedUrl;
	if (requestedUrl.hostname === 'localhost' || requestedUrl.hostname.endsWith('.localhost')) {
		fetchUrl.protocol = 'http:';
		fetchUrl.port = '5180';
	}
	try {
		const response = await fetch(fetchUrl.toString(), {
			redirect: 'follow',
			signal: controller.signal,
			headers: { 'user-agent': 'HedgehogBot/1.0 (+https://hedgehog-inc.one)' }
		});
		if (!response.ok || !isAllowed(response.url, currentHost)) return null;
		const type = response.headers.get('content-type') ?? '';
		if (!type.includes('text/html')) return null;
		const html = (await response.text()).slice(0, 512 * 1024);
		const imageRaw = metaContent(html, 'og:image') ?? metaContent(html, 'twitter:image');
		let image: string | null = null;
		if (imageRaw) {
			try {
				const resolved = new URL(imageRaw, response.url);
				const clientSource = new URL(rawUrl);
				if (
					resolved.protocol === 'http:' &&
					clientSource.protocol === 'https:' &&
					resolved.hostname === clientSource.hostname
				) {
					resolved.protocol = 'https:';
					if (!clientSource.port) resolved.port = '';
				}
				if (resolved.protocol === 'http:' || resolved.protocol === 'https:')
					image = resolved.toString();
			} catch {
				image = null;
			}
		}
		const value: LinkPreview = {
			url: response.url,
			title: metaContent(html, 'og:title') ?? metaContent(html, 'twitter:title'),
			description: metaContent(html, 'og:description') ?? metaContent(html, 'twitter:description'),
			image
		};
		cache.set(rawUrl, { value, expiresAt: Date.now() + CACHE_MS });
		return value;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
