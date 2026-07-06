import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { passkey } from '@better-auth/passkey';
import { db } from '$lib/server/db';
import { telegramAuthPlugin } from './telegramAuth';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	socialProviders: {
		discord: {
			clientId: env.DISCORD_CLIENT_ID!,
			clientSecret: env.DISCORD_CLIENT_SECRET!
		}
	},
	plugins: [passkey(), telegramAuthPlugin(), sveltekitCookies(getRequestEvent)]
});
