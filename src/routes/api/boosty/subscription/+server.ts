import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/auth.schema';
import { and, desc, eq } from 'drizzle-orm';
import { getHedgehogSubscription } from '$lib/server/boosty/subscriptions';

/**
 * GET /api/boosty/subscription
 * Проверяет подписку текущего пользователя на блог HEDGEHOG.INC в Boosty.
 *
 * Требует авторизации. Boosty-креды берём из account (provider 'boosty')
 * ТЕКУЩЕГО юзера: refreshToken + device_id (в scope).
 * Ответ: HedgehogSubscriptionStatus (см. subscriptions.ts).
 */
export const GET = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	// Ищем boosty-аккаунт ТЕКУЩЕГО пользователя (защита от IDOR: только свои
	// аккаунты; самый свежий — последний вход).
	const boostyAccounts = await db
		.select({
			id: account.id,
			refreshToken: account.refreshToken,
			scope: account.scope
		})
		.from(account)
		.where(and(eq(account.providerId, 'boosty'), eq(account.userId, currentUser.id)))
		.orderBy(desc(account.createdAt));
	const boosty = boostyAccounts.find((a) => a.refreshToken != null);
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
			isError: false,
			error: null
		});
	}
	const deviceId = boosty.scope?.replace('device_id=', '') ?? '';
	const result = await getHedgehogSubscription({
		refreshToken: boosty.refreshToken,
		deviceId
	});
	// refresh_token ротируется при каждом обновлении — сохраняем новый строго
	// в найденный аккаунт (по его id), а не по userId.
	if (result.newRefreshToken && result.newRefreshToken !== boosty.refreshToken) {
		await db
			.update(account)
			.set({ refreshToken: result.newRefreshToken, updatedAt: new Date() })
			.where(eq(account.id, boosty.id));
	}
	return json(result.status);
};
