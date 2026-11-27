import dns from 'node:dns/promises';
import net from 'node:net';
import { allowedChatHosts } from '../broadcasts/domain';

export interface LinkPreview {
	url: string;
	title: string | null;
	description: string | null;
	image: string | null;
}

const cache = new Map<string, { value: LinkPreview; expiresAt: number }>();
const CACHE_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 512 * 1024;
const ALLOWED_PORTS = new Set(['', '80', '443']);

export function isPrivateIp(rawIp: string): boolean {
	const ip = rawIp.trim().toLowerCase().split('%')[0] ?? '';
	if (!ip) return true;

	if (net.isIPv4(ip)) {
		const parts = ip.split('.').map(Number);
		if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
			return true;
		}
		const [a, b] = parts;
		if (a === 0 || a === 10 || a === 127) return true;
		if (a === 169 && b === 254) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 100 && b >= 64 && b <= 127) return true;
		if (a >= 224) return true;
		return false;
	}

	if (net.isIPv6(ip)) {
		if (ip === '::' || ip === '::1') return true;
		if (ip.startsWith('::ffff:')) return true;
		const firstGroup = ip.split(':')[0] ?? '';
		if (firstGroup) {
			const first = Number.parseInt(firstGroup, 16);
			if (!Number.isNaN(first)) {
				// fc00::/7 (ULA), fe80::/10 (link-local), ff00::/8 (multicast)
				if ((first & 0xfe00) === 0xfc00) return true;
				if ((first & 0xffc0) === 0xfe80) return true;
				if ((first & 0xff00) === 0xff00) return true;
			}
		}
		return false;
	}

	return true;
}

export function isAllowedPreviewUrl(raw: string, currentHost?: string): boolean {
	try {
		const url = new URL(raw);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
		if (!ALLOWED_PORTS.has(url.port)) return false;
		const host = url.hostname.toLowerCase();
		return [...allowedChatHosts(currentHost)].some(
			(allowed) => host === allowed || host.endsWith('.' + allowed)
		);
	} catch {
		return false;
	}
}

async function resolvesToPublicIp(
	hostname: string,
	lookup: typeof dns.lookup = dns.lookup
): Promise<boolean> {
	const host =
		hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
	if (net.isIP(host)) return !isPrivateIp(host);
	try {
		const records = await lookup(host, { all: true, verbatim: true });
		if (!records.length) return false;
		return records.every((record) => !isPrivateIp(record.address));
	} catch {
		return false;
	}
}

export async function readLimitedResponseText(
	response: Response,
	maxBytes = MAX_HTML_BYTES
): Promise<string> {
	if (!response.body) {
		return (await response.text()).slice(0, maxBytes);
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder('utf-8', { fatal: false });
	let received = 0;
	let html = '';
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value || value.byteLength === 0) continue;
			const remaining = maxBytes - received;
			if (value.byteLength >= remaining) {
				html += decoder.decode(value.subarray(0, remaining), { stream: false });
				await reader.cancel().catch(() => {});
				return html;
			}
			html += decoder.decode(value, { stream: true });
			received += value.byteLength;
		}
		html += decoder.decode();
		return html;
	} finally {
		reader.releaseLock();
	}
}

function getCached(key: string): LinkPreview | null {
	const cached = cache.get(key);
	if (!cached) return null;
	if (cached.expiresAt <= Date.now()) {
		cache.delete(key);
		return null;
	}
	cache.delete(key);
	cache.set(key, cached);
	return cached.value;
}

function setCached(key: string, value: LinkPreview): void {
	const now = Date.now();
	if (cache.has(key)) cache.delete(key);
	if (cache.size >= MAX_CACHE_ENTRIES) {
		for (const [k, entry] of cache) {
			if (entry.expiresAt <= now) cache.delete(k);
		}
	}
	while (cache.size >= MAX_CACHE_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
	cache.set(key, { value, expiresAt: now + CACHE_MS });
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

export interface FetchLinkPreviewDeps {
	fetchImpl?: typeof fetch;
	lookupImpl?: typeof dns.lookup;
	bypassCache?: boolean;
}

export async function fetchLinkPreview(
	rawUrl: string,
	currentHost?: string,
	deps: FetchLinkPreviewDeps = {}
): Promise<LinkPreview | null> {
	if (!isAllowedPreviewUrl(rawUrl, currentHost)) return null;
	if (!deps.bypassCache) {
		const cached = getCached(rawUrl);
		if (cached) return cached;
	}

	const fetchImpl = deps.fetchImpl ?? fetch;
	const lookupImpl = deps.lookupImpl ?? dns.lookup;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);

	try {
		let currentUrl = rawUrl;
		let finalResponse: Response | null = null;

		for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
			if (!isAllowedPreviewUrl(currentUrl, currentHost)) return null;
			const parsed = new URL(currentUrl);
			const isDevLocalhost =
				process.env.NODE_ENV !== 'production' &&
				(parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost'));

			if (!isDevLocalhost && !(await resolvesToPublicIp(parsed.hostname, lookupImpl))) {
				return null;
			}

			const fetchUrl = new URL(parsed.toString());
			if (isDevLocalhost) {
				fetchUrl.protocol = 'http:';
				fetchUrl.port = '5180';
			}

			const response = await fetchImpl(fetchUrl.toString(), {
				redirect: 'manual',
				signal: controller.signal,
				headers: { 'user-agent': 'HedgehogBot/1.0 (+https://hedgehog-inc.one)' }
			});

			if (response.status >= 300 && response.status < 400) {
				await response.body?.cancel().catch(() => {});
				if (hop === MAX_REDIRECTS) return null;
				const location = response.headers.get('location');
				if (!location) return null;
				currentUrl = new URL(location, parsed).toString();
				continue;
			}

			finalResponse = response;
			break;
		}

		if (!finalResponse || !finalResponse.ok) return null;
		if (!isAllowedPreviewUrl(currentUrl, currentHost)) return null;

		const type = finalResponse.headers.get('content-type') ?? '';
		if (!type.toLowerCase().includes('text/html')) {
			await finalResponse.body?.cancel().catch(() => {});
			return null;
		}

		const html = await readLimitedResponseText(finalResponse, MAX_HTML_BYTES);
		const imageRaw = metaContent(html, 'og:image') ?? metaContent(html, 'twitter:image');
		let image: string | null = null;
		if (imageRaw) {
			try {
				const resolved = new URL(imageRaw, currentUrl);
				const clientSource = new URL(rawUrl);
				if (
					resolved.protocol === 'http:' &&
					clientSource.protocol === 'https:' &&
					resolved.hostname === clientSource.hostname
				) {
					resolved.protocol = 'https:';
					if (!clientSource.port) resolved.port = '';
				}
				if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
					image = resolved.toString();
				}
			} catch {
				image = null;
			}
		}

		const value: LinkPreview = {
			url: currentUrl,
			title: metaContent(html, 'og:title') ?? metaContent(html, 'twitter:title'),
			description: metaContent(html, 'og:description') ?? metaContent(html, 'twitter:description'),
			image
		};
		if (!deps.bypassCache) setCached(rawUrl, value);
		return value;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
