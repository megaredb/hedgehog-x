import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { telegram } from 'better-auth-telegram';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

// Динамический baseURL: лучше-auth сам определяет origin из запроса
// и добавляет все allowedHosts в trustedOrigins (иначе POST /api/auth/*
// с заголовком Origin не пройдёт origin-check и вернёт 403 Invalid origin).
// Протокол берётся из запроса (default 'auto'): для localhost — http, для
// HTTPS-хоста (mkcert hedgehog-inc.localhost) — https.
// fallback — используется, когда origin не определяется из запроса.
const baseURL = {
	allowedHosts: [
		'hedgehog-inc.localhost',
		'preview.hedgehog-inc.localhost',
		// dev/preview порты (Host заголовок включает порт)
		'localhost',
		'localhost:5173',
		'localhost:5174',
		'localhost:4173',
		'127.0.0.1',
		'127.0.0.1:5173',
		'127.0.0.1:5174',
		'127.0.0.1:4173',
		'[::1]',
		'[::1]:5173',
		'[::1]:5174'
	],
	fallback: 'http://localhost:5173'
};

export const auth = betterAuth({
	baseURL,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true },
	plugins: [
		telegram({
			// OIDC (Login Widget помечен Telegram как legacy — используем OAuth 2.0 + PKCE)
			loginWidget: false,
			botToken: env.TELEGRAM_BOT_TOKEN ?? '',
			oidc: {
				enabled: true,
				clientId: env.TELEGRAM_OIDC_CLIENT_ID,
				clientSecret: env.TELEGRAM_OIDC_CLIENT_SECRET,
				scopes: ['openid', 'profile']
			}
		}),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
