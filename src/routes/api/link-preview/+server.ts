import { error, json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { isAdminRole } from '$lib/server/admin';
import { hasBroadcastSubscription } from '$lib/server/broadcasts';
import { fetchLinkPreview, isAllowedPreviewUrl } from '$lib/server/og-preview';
import type { RequestHandler } from './$types';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 20;
const RATE_MAX_BUCKETS = 2_000;
const userRateBuckets = new Map<string, { count: number; resetAt: number }>();

function allowUserPreview(userId: string): boolean {
	const now = Date.now();
	const current = userRateBuckets.get(userId);
	if (!current || current.resetAt <= now) {
		if (userRateBuckets.size >= RATE_MAX_BUCKETS) {
			for (const [key, bucket] of userRateBuckets) {
				if (bucket.resetAt <= now) userRateBuckets.delete(key);
			}
			while (userRateBuckets.size >= RATE_MAX_BUCKETS) {
				const oldest = userRateBuckets.keys().next().value;
				if (oldest === undefined) break;
				userRateBuckets.delete(oldest);
			}
		}
		userRateBuckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
		return true;
	}
	current.count += 1;
	return current.count <= RATE_MAX_REQUESTS;
}

function parseHostname(raw: string | undefined): string | null {
	if (!raw) return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;
	try {
		const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
		return parsed.hostname.toLowerCase() || null;
	} catch {
		return null;
	}
}

function resolveTrustedHost(fallbackHostname: string): string {
	const fromPublic = parseHostname(publicEnv.PUBLIC_SITE_URL);
	if (fromPublic) return fromPublic;

	const fromAuth = parseHostname(privateEnv.BETTER_AUTH_URL);
	if (fromAuth) return fromAuth;

	if (privateEnv.BETTER_AUTH_ALLOWED_HOSTS) {
		const firstAllowed = privateEnv.BETTER_AUTH_ALLOWED_HOSTS.split(',')
			.map((item) => parseHostname(item))
			.find((host): host is string => Boolean(host));
		if (firstAllowed) return firstAllowed;
	}

	return fallbackHostname;
}

export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) throw error(401, 'Требуется вход');
	if (!isAdminRole(locals.user.role) && !(await hasBroadcastSubscription(locals.user.id))) {
		throw error(403, 'Нужна подписка');
	}
	if (!allowUserPreview(locals.user.id)) {
		throw error(429, 'Слишком много запросов');
	}

	const payload = await request.json().catch(() => null);
	const raw = typeof payload?.url === 'string' ? payload.url.trim() : '';
	if (!raw) throw error(400, 'Ссылка не указана');

	const trustedHost = resolveTrustedHost(url.hostname);
	try {
		new URL(raw);
	} catch {
		throw error(400, 'Некорректная ссылка');
	}
	if (!isAllowedPreviewUrl(raw, trustedHost)) {
		throw error(400, 'Ссылка не разрешена');
	}

	const preview = await fetchLinkPreview(raw, trustedHost);
	return json({ preview });
};
