import { and, eq, gt, isNull, desc, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	subscriptionEvents,
	subscriptionPriceChanges,
	subscriptionPriceNotices,
	subscriptionSettings,
	subscriptions
} from '$lib/server/db/schema';
import { subscriptionConfig } from './config';
import { getActiveSubscriberIds } from './reports';
import { repriceRemainingMs } from '$lib/subscriptions/domain';

export type PriceScope = 'all' | 'new';

export class PriceChangeError extends Error {}

export interface PriceChangeResult {
	oldPrice: number;
	newPrice: number;
	scope: PriceScope;
	repricedCount: number;
	noticedCount: number;
}

export async function getSubscriptionPricePerDay(): Promise<number> {
	const [row] = await db
		.select({ pricePerDay: subscriptionSettings.pricePerDay })
		.from(subscriptionSettings)
		.where(eq(subscriptionSettings.id, 'default'))
		.limit(1);
	if (row) return row.pricePerDay;

	const fallback = subscriptionConfig.pricePerDay;
	await db
		.insert(subscriptionSettings)
		.values({ id: 'default', pricePerDay: fallback })
		.onConflictDoNothing();
	return fallback;
}

export async function setSubscriptionPrice(params: {
	newPrice: number;
	scope: PriceScope;
	adminUserId: string;
	now?: Date;
}): Promise<PriceChangeResult> {
	const now = params.now ?? new Date();
	const newPrice = Math.floor(Number(params.newPrice));
	if (!Number.isFinite(newPrice) || newPrice < 1 || newPrice > 100000) {
		throw new PriceChangeError('Цена дня должна быть от 1 до 100 000 ₽');
	}
	if (params.scope !== 'all' && params.scope !== 'new') {
		throw new PriceChangeError('Некорректный режим смены цены');
	}

	return db.transaction(async (tx) => {
		await tx
			.insert(subscriptionSettings)
			.values({ id: 'default', pricePerDay: subscriptionConfig.pricePerDay })
			.onConflictDoNothing();
		const [current] = await tx
			.select()
			.from(subscriptionSettings)
			.where(eq(subscriptionSettings.id, 'default'))
			.for('update');
		if (!current) throw new PriceChangeError('Не удалось прочитать настройки цены');
		const oldPrice = current.pricePerDay;
		if (oldPrice === newPrice) throw new PriceChangeError('Цена уже такая');

		await tx
			.update(subscriptionSettings)
			.set({ pricePerDay: newPrice, updatedBy: params.adminUserId })
			.where(eq(subscriptionSettings.id, 'default'));

		const [change] = await tx
			.insert(subscriptionPriceChanges)
			.values({
				oldPrice,
				newPrice,
				scope: params.scope,
				adminUserId: params.adminUserId
			})
			.returning({ id: subscriptionPriceChanges.id });
		if (!change) throw new PriceChangeError('Не удалось создать запись об изменении цены');

		// A new price notice supersedes older undismissed notices.
		await tx
			.update(subscriptionPriceNotices)
			.set({ dismissedAt: now, dismissedReason: 'superseded' })
			.where(isNull(subscriptionPriceNotices.dismissedAt));

		let repricedCount = 0;
		if (params.scope === 'all') {
			const rows = await tx
				.select({
					userId: subscriptions.userId,
					manualExpiresAt: subscriptions.manualExpiresAt,
					revokedAt: subscriptions.revokedAt,
					revokedRemainingMs: subscriptions.revokedRemainingMs,
					blockedAt: subscriptions.blockedAt,
					blockedRemainingMs: subscriptions.blockedRemainingMs
				})
				.from(subscriptions)
				.where(
					and(
						eq(subscriptions.isLifetime, false),
						or(
							and(
								isNull(subscriptions.revokedAt),
								isNull(subscriptions.blockedAt),
								gt(subscriptions.manualExpiresAt, now)
							),
							gt(subscriptions.revokedRemainingMs, 0),
							gt(subscriptions.blockedRemainingMs, 0)
						)
					)
				)
				.for('update');

			const maxMs = 36500 * 86_400_000;
			for (const row of rows) {
				let changed = false;
				let nextManualExpiresAt = row.manualExpiresAt;
				let nextRevokedRemainingMs = row.revokedRemainingMs;
				let nextBlockedRemainingMs = row.blockedRemainingMs;

				if (!row.revokedAt && !row.blockedAt && row.manualExpiresAt) {
					const remainingMs = row.manualExpiresAt.getTime() - now.getTime();
					if (remainingMs > 0) {
						const recalculatedMs = Math.min(
							repriceRemainingMs(remainingMs, oldPrice, newPrice),
							maxMs
						);
						nextManualExpiresAt = new Date(now.getTime() + recalculatedMs);
						changed = true;
					}
				}
				if (row.revokedRemainingMs != null && row.revokedRemainingMs > 0) {
					nextRevokedRemainingMs = Math.min(
						repriceRemainingMs(row.revokedRemainingMs, oldPrice, newPrice),
						maxMs
					);
					changed = true;
				}
				if (row.blockedRemainingMs != null && row.blockedRemainingMs > 0) {
					nextBlockedRemainingMs = Math.min(
						repriceRemainingMs(row.blockedRemainingMs, oldPrice, newPrice),
						maxMs
					);
					changed = true;
				}
				if (!changed) continue;

				await tx
					.update(subscriptions)
					.set({
						manualExpiresAt: nextManualExpiresAt,
						revokedRemainingMs: nextRevokedRemainingMs,
						blockedRemainingMs: nextBlockedRemainingMs,
						updatedBy: params.adminUserId
					})
					.where(eq(subscriptions.userId, row.userId));
				await tx.insert(subscriptionEvents).values({
					userId: row.userId,
					type: 'price_recalc',
					source: 'system',
					beforeExpiresAt: row.manualExpiresAt,
					afterExpiresAt: nextManualExpiresAt,
					pricePerDay: newPrice,
					adminUserId: params.adminUserId,
					note: `Цена дня ${oldPrice} → ${newPrice} ₽; остаток пересчитан`
				});
				repricedCount += 1;
			}
		}

		const activeIds = await getActiveSubscriberIds(now, tx);
		if (activeIds.length > 0) {
			await tx
				.insert(subscriptionPriceNotices)
				.values(
					activeIds.map((userId) => ({
						userId,
						priceChangeId: change.id,
						oldPrice,
						newPrice,
						scope: params.scope
					}))
				)
				.onConflictDoNothing();
		}

		return {
			oldPrice,
			newPrice,
			scope: params.scope,
			repricedCount,
			noticedCount: activeIds.length
		};
	});
}

export async function getActivePriceNotices(userId: string) {
	return db
		.select({
			id: subscriptionPriceNotices.id,
			oldPrice: subscriptionPriceNotices.oldPrice,
			newPrice: subscriptionPriceNotices.newPrice,
			scope: subscriptionPriceNotices.scope,
			createdAt: subscriptionPriceNotices.createdAt
		})
		.from(subscriptionPriceNotices)
		.where(
			and(eq(subscriptionPriceNotices.userId, userId), isNull(subscriptionPriceNotices.dismissedAt))
		)
		.orderBy(desc(subscriptionPriceNotices.createdAt));
}

export async function dismissPriceNotice(
	userId: string,
	noticeId: string,
	now = new Date()
): Promise<boolean> {
	const updated = await db
		.update(subscriptionPriceNotices)
		.set({ dismissedAt: now, dismissedReason: 'user' })
		.where(
			and(
				eq(subscriptionPriceNotices.id, noticeId),
				eq(subscriptionPriceNotices.userId, userId),
				isNull(subscriptionPriceNotices.dismissedAt)
			)
		)
		.returning({ id: subscriptionPriceNotices.id });
	return updated.length > 0;
}

export async function dismissNoticesForUser(
	userId: string,
	reason: 'renewal' | 'user' | 'admin' = 'renewal',
	now = new Date()
): Promise<number> {
	const updated = await db
		.update(subscriptionPriceNotices)
		.set({ dismissedAt: now, dismissedReason: reason })
		.where(
			and(eq(subscriptionPriceNotices.userId, userId), isNull(subscriptionPriceNotices.dismissedAt))
		)
		.returning({ id: subscriptionPriceNotices.id });
	return updated.length;
}
