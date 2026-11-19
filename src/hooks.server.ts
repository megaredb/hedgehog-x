import type { Handle, RequestEvent } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { ensureDefaultBooks } from '$lib/server/db/seed';

if (!building) {
	ensureDefaultBooks().catch((err) => {
		console.error('[hooks.server] Failed to run initial database seed:', err);
	});
}

const MAX_UPLOAD_REQUEST_BYTES = 520 * 1024 * 1024; // 500 MB audio + form overhead
const UPLOAD_RATE_WINDOW_MS = 60_000;
const UPLOAD_RATE_MAX = 30;
const uploadRate = new Map<string, { count: number; resetAt: number }>();

function allowUpload(event: RequestEvent): boolean {
	const now = Date.now();
	let key = 'unknown';
	// Behind Traefik the socket address is the proxy; use the forwarded client IP.
	const forwarded = event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
	if (forwarded) {
		key = forwarded;
	} else {
		try {
			key = event.getClientAddress();
		} catch {
			// Keep the shared fallback bucket for non-HTTP test contexts.
		}
	}
	const current = uploadRate.get(key);
	if (!current || current.resetAt <= now) {
		uploadRate.set(key, { count: 1, resetAt: now + UPLOAD_RATE_WINDOW_MS });
		if (uploadRate.size > 1000) {
			for (const [ip, bucket] of uploadRate) {
				if (bucket.resetAt <= now) uploadRate.delete(ip);
			}
		}
		return true;
	}
	current.count += 1;
	return current.count <= UPLOAD_RATE_MAX;
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const isUploadRequest =
		event.request.method === 'POST' && event.url.pathname.startsWith('/admin');
	if (isUploadRequest) {
		const length = Number(event.request.headers.get('content-length') ?? '0');
		if (Number.isFinite(length) && length > MAX_UPLOAD_REQUEST_BYTES) {
			return new Response('Payload Too Large', { status: 413 });
		}
		if (!allowUpload(event)) {
			return new Response('Too Many Requests', {
				status: 429,
				headers: { 'Retry-After': '60' }
			});
		}
	}

	if (!building && event.url.pathname.startsWith('/api/books')) {
		await ensureDefaultBooks().catch(() => {});
	}

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const response = await svelteKitHandler({ event, resolve, auth, building });
	// Baseline hardening; CSP is intentionally not enforced until the app's
	// inline Umami/bootstrap requirements are moved behind a nonce.
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' https:",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https:",
			"media-src 'self' blob: https:",
			"connect-src 'self' https:",
			"font-src 'self' data:",
			"frame-src 'self' https://t.me https://telegram.org",
			"object-src 'none'",
			"base-uri 'self'",
			"form-action 'self' https://t.me",
			"frame-ancestors 'none'"
		].join('; ')
	);
	return response;
};

export const handle: Handle = handleBetterAuth;
