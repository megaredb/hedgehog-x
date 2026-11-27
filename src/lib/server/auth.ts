import dns from 'node:dns';
import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { telegram } from 'better-auth-telegram';
import { getRequestEvent } from '$app/server';
import { building } from '$app/environment';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { createLogger } from '$lib/logger';
import { getSubscriptionRecord } from '$lib/server/subscriptions/entitlement';
import { checkAllSubscriptionSources } from '$lib/server/subscriptions/sources';

const log = createLogger('Auth');

// Node's outbound TLS to Telegram occasionally gets ECONNRESET on the first
// connection (especially through a local proxy). Prefer IPv4 and retry
// transient transport failures during OAuth code exchange. Do not retry HTTP
// responses: only thrown network errors.
dns.setDefaultResultOrder('ipv4first');
type GlobalWithTelegramRetry = typeof globalThis & {
	__hedgehogTelegramFetchRetry?: boolean;
};
if (!(globalThis as GlobalWithTelegramRetry).__hedgehogTelegramFetchRetry) {
	const nativeFetch = globalThis.fetch.bind(globalThis);
	const patchedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url =
			typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		if (!url.includes('telegram.org')) return nativeFetch(input, init);

		let lastError: unknown;
		for (let attempt = 0; attempt < 3; attempt += 1) {
			try {
				return await nativeFetch(input instanceof Request ? input.clone() : input, init);
			} catch (error) {
				lastError = error;
				const message = error instanceof Error ? error.message : 'network error';
				log.warn(`Telegram OAuth request failed (attempt ${attempt + 1}/3): ${message}`);
				if (attempt < 2) {
					await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
				}
			}
		}
		throw lastError;
	};
	globalThis.fetch = patchedFetch as typeof fetch;
	(globalThis as GlobalWithTelegramRetry).__hedgehogTelegramFetchRetry = true;
}

// Dynamic baseURL configuration based on allowed hosts from environment
const allowedHosts = env.BETTER_AUTH_ALLOWED_HOSTS
	? env.BETTER_AUTH_ALLOWED_HOSTS.split(',')
			.map((h) => h.trim())
			.filter((h) => h.length > 0)
	: undefined;

const baseURL = allowedHosts?.length
	? { allowedHosts, fallback: env.BETTER_AUTH_FALLBACK_URL }
	: undefined;

const cookieDomain = env.BETTER_AUTH_COOKIE_DOMAIN?.trim();

// better-auth requires string provider credentials even when an optional provider
// is not configured. Empty values keep the provider registered and let better-auth
// emit its "missing clientId/clientSecret" warning instead of failing type-checking.
const discordClientId = env.DISCORD_CLIENT_ID ?? '';
const discordClientSecret = env.DISCORD_CLIENT_SECRET ?? '';

const authSecret = env.BETTER_AUTH_SECRET?.trim();
if (!building && (!authSecret || authSecret.length < 32)) {
	throw new Error(
		'BETTER_AUTH_SECRET is required and must be at least 32 characters. ' +
			'Generate one with: openssl rand -base64 32'
	);
}

/**
 * Extracts real Telegram user ID from OIDC claims.
 */
function telegramUserIdFromClaims(claims: { sub: string; id?: number | null }): string | null {
	if (claims.id == null || !Number.isFinite(claims.id)) return null;
	return String(claims.id);
}

export const auth = betterAuth({
	baseURL,
	secret: authSecret ?? 'build-time-placeholder-secret-32-chars',
	advanced: cookieDomain
		? {
				crossSubDomainCookies: {
					enabled: true,
					domain: cookieDomain
				}
			}
		: undefined,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: false },
	// Additional user profile fields stored separately for Telegram & Discord
	user: {
		additionalFields: {
			telegramAvatar: { type: 'string' },
			telegramOidcUsername: { type: 'string' },
			discordAvatar: { type: 'string' },
			discordUsername: { type: 'string' },
			role: { type: 'string', defaultValue: 'user', input: false }
		}
	},
	socialProviders: {
		discord: {
			clientId: discordClientId,
			clientSecret: discordClientSecret,
			scope: ['identify', 'email', 'guilds.members.read'],
			mapProfileToUser: (profile) => ({
				discordAvatar: profile.image_url,
				discordUsername: profile.username ?? null
			}),
			overrideUserInfoOnSignIn: true
		}
	},
	account: {
		accountLinking: {
			enabled: true,
			allowUnlinkingAll: false,
			allowDifferentEmails: true,
			trustedProviders: ['discord', 'telegram-oidc'],
			updateUserInfoOnLink: true
		}
	},
	databaseHooks: {
		session: {
			create: {
				before: async (session) => {
					if (building) return;
					try {
						const record = await getSubscriptionRecord(session.userId);
						if (record?.blockedAt) return false;
					} catch (error) {
						log.warn('Failed to check account block before session create:', error);
					}
				},
				after: async (session, context) => {
					// Subscription sources are checked once after login/registration,
					// not on every page load. Wait briefly so the OAuth transaction has
					// committed the account/session rows.
					setTimeout(() => {
						void checkAllSubscriptionSources(session.userId).catch((error) => {
							log.warn('Failed to check subscription sources after login:', error);
						});
					}, 750);
					try {
						const ctx = context as unknown as {
							request?: { url?: string };
							context?: {
								internalAdapter: {
									findUserById(u: string): Promise<Record<string, unknown> | null>;
									updateUser(
										u: string,
										d: Record<string, unknown>
									): Promise<Record<string, unknown>>;
								};
							};
						} | null;
						const url = ctx?.request?.url ?? '';
						if (!url.includes('/callback/')) return;
						const providerId = url.split('/callback/')[1]?.split('?')[0];
						if (!providerId || !ctx?.context) return;
						const { internalAdapter } = ctx.context;
						const user = await internalAdapter?.findUserById(session.userId);
						if (!user) return;
						const avatarField =
							providerId === 'discord'
								? 'discordAvatar'
								: providerId === 'telegram-oidc'
									? 'telegramAvatar'
									: null;
						const image = avatarField ? user[avatarField] : null;
						if (typeof image === 'string' && image.length > 0 && image !== user.image) {
							await internalAdapter.updateUser(session.userId, { image });
						}
					} catch (e) {
						log.warn('Failed to sync profile avatar:', e);
					}
				}
			}
		}
	},
	plugins: [
		telegram({
			loginWidget: false,
			botToken: env.TELEGRAM_BOT_TOKEN ?? '',
			oidc: {
				enabled: true,
				clientId: env.TELEGRAM_OIDC_CLIENT_ID,
				clientSecret: env.TELEGRAM_OIDC_CLIENT_SECRET,
				scopes: ['openid', 'profile'],
				mapOIDCProfileToUser: (claims) => {
					const userId = telegramUserIdFromClaims(claims);
					return {
						telegramAvatar: claims.picture ?? null,
						telegramOidcUsername: claims.preferred_username ?? null,
						...(userId ? { id: userId, email: `${userId}@telegram.oidc` } : {})
					};
				}
			}
		}),
		sveltekitCookies(getRequestEvent)
	]
});
