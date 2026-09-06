import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';
import { getHedgehogSubscription } from '$lib/server/boosty/subscriptions';

/**
 * GET /api/boosty/subscription
 * Проверяет подписку текущего пользователя на блог HEDGEHOG.INC в Boosty.
 *
 * Требует авторизации. Boosty-креды берём из account (provider 'boosty')
 * текущего юзера: refreshToken + device_id (в scope).
 * Ответ: HedgehogSubscriptionStatus (см. subscriptions.ts).
 */
export const GET = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	// Ищем boosty-аккаунт пользователя (самый свежий — последний вход).
	const boostyAccounts = await db
		.select({
			refreshToken: account.refreshToken,
			scope: account.scope,
			createdAt: account.createdAt
		})
		.from(account)
		.where(eq(account.providerId, 'boosty'))
		.orderBy(account.createdAt);
	const boosty = [...boostyAccounts].reverse().find((a) => a.refreshToken != null);
	if (!boosty?.refreshToken) {
		return json({
			linked: false,
			subscribed: false,
			levelName: null,
			priceRub: null,
			periodMonths: null,
			nextPayTime: null,
			onTime: null,
			isFeePaid: false,
			isPaused: false,
			error: null
		});
	}
	const deviceId = boosty.scope?.replace('device_id=', '') ?? '';
	const result = await getHedgehogSubscription({
		refreshToken: boosty.refreshToken,
		deviceId
	});
	// refresh_token ротируется при каждом обновлении — сохраняем новый.
	if (result.newRefreshToken && result.newRefreshToken !== boosty.refreshToken) {
		await db
			.update(account)
			.set({ refreshToken: result.newRefreshToken, updatedAt: new Date() })
			.where(eq(account.userId, currentUser.id));
	}
	return json(result.status);
};
