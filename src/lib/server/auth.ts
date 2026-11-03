import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { telegram } from 'better-auth-telegram';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { createLogger } from '$lib/logger';

const log = createLogger('Auth');

// Dynamic baseURL configuration based on allowed hosts from environment
const allowedHosts = env.BETTER_AUTH_ALLOWED_HOSTS
	? env.BETTER_AUTH_ALLOWED_HOSTS.split(',')
			.map((h) => h.trim())
			.filter((h) => h.length > 0)
	: undefined;

const baseURL = allowedHosts?.length
	? { allowedHosts, fallback: env.BETTER_AUTH_FALLBACK_URL }
	: undefined;

/**
 * Extracts real Telegram user ID from OIDC claims.
 */
function telegramUserIdFromClaims(claims: { sub: string; id?: number | null }): string | null {
	return String(claims.id);
}

export const auth = betterAuth({
	baseURL,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: false },
	// Additional user profile fields stored separately for Telegram & Discord
	user: {
		additionalFields: {
			telegramAvatar: { type: 'string' },
			telegramOidcUsername: { type: 'string' },
			discordAvatar: { type: 'string' },
			discordUsername: { type: 'string' },
			role: { type: 'string', defaultValue: 'user' }
		}
	},
	socialProviders: {
		discord: {
			clientId: env.DISCORD_CLIENT_ID,
			clientSecret: env.DISCORD_CLIENT_SECRET,
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
				after: async (session, context) => {
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
