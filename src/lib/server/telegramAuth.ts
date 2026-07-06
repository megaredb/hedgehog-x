import { createAuthEndpoint } from 'better-auth/api';
import type { BetterAuthPlugin } from 'better-auth';
import crypto from 'crypto';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import { APIError } from 'better-auth/api';

export const telegramAuthPlugin = () => {
	return {
		id: 'telegram-auth',
		endpoints: {
			telegramCallback: createAuthEndpoint(
				'/telegram/callback',
				{
					method: 'POST',
					body: z.object({
						id: z.number(),
						first_name: z.string(),
						last_name: z.string().optional(),
						username: z.string().optional(),
						photo_url: z.string().optional(),
						auth_date: z.number(),
						hash: z.string()
					})
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				async (ctx: any) => {
					const botToken = env.TELEGRAM_BOT_TOKEN;
					if (!botToken) {
						throw new APIError('BAD_REQUEST', {
							message: 'Telegram bot token is not configured'
						});
					}

					interface TelegramBody {
						id: number;
						first_name: string;
						last_name?: string;
						username?: string;
						photo_url?: string;
						auth_date: number;
						hash: string;
					}

					const data: TelegramBody = ctx.body;

					// 1. Verify hash
					const dataCheckArr: string[] = [];
					for (const [key, value] of Object.entries(data)) {
						if (key !== 'hash' && value !== undefined) {
							dataCheckArr.push(`${key}=${value}`);
						}
					}
					dataCheckArr.sort();
					const dataCheckString = dataCheckArr.join('\n');

					const secretKey = crypto.createHash('sha256').update(botToken).digest();
					const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

					if (hmac !== data.hash) {
						throw new APIError('UNAUTHORIZED', { message: 'Invalid Telegram hash' });
					}

					// 2. Check auth_date (prevent outdated logins, e.g. 24 hours)
					const now = Math.floor(Date.now() / 1000);
					if (now - data.auth_date > 86400) {
						throw new APIError('UNAUTHORIZED', { message: 'Auth data is outdated' });
					}

					// 3. Find or Create User & Account
					// Telegram doesn't give emails by default, so we construct a placeholder
					const email = `${data.id}@telegram.local`;
					const name = data.first_name + (data.last_name ? ` ${data.last_name}` : '');

					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const adapter = ctx.context.internalAdapter as any;
					const foundUser = await adapter.findUserByEmail(email);

					let actualUser: { id: string; email: string; name: string; image?: string | null };

					if (!foundUser) {
						const createdUser = await adapter.createUser({
							email,
							name,
							image: data.photo_url || undefined,
							emailVerified: true,
							createdAt: new Date(),
							updatedAt: new Date()
						});

						await adapter.createAccount({
							userId: createdUser.id,
							providerId: 'telegram',
							accountId: data.id.toString(),
							createdAt: new Date(),
							updatedAt: new Date()
						});
						actualUser = createdUser;
					} else {
						actualUser = foundUser.user;
					}

					// 4. Create Session
					const session = await adapter.createSession(
						actualUser.id,
						false // dontPersist
					);

					// Set cookies using context
					if (session) {
						ctx.setCookie(
							ctx.context.authCookies.sessionToken.name,
							session.token,
							ctx.context.authCookies.sessionToken.options
						);
					}

					return ctx.json({
						session,
						user: actualUser
					});
				}
			)
		}
	} satisfies BetterAuthPlugin;
};
