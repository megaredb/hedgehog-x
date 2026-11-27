import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	donationLedger,
	subscriptionEvents,
	subscriptionSources,
	subscriptions
} from '$lib/server/db/schema';
import { session } from '$lib/server/db/auth.schema';
import {
	computeManualExpiry,
	daysFromAmount,
	MAX_MANUAL_AMOUNT_RUB,
	MAX_MANUAL_DAYS,
	summarizeSubscription,
	type SubscriptionRecord,
	type SubscriptionSourceRecord,
	type SubscriptionSummary
} from '$lib/subscriptions/domain';
import { dismissNoticesForUser } from './pricing';
import { donationLedgerValues } from './ledger';

export class SubscriptionError extends Error {}

export interface ManualGrantInput {
	userId: string;
	adminUserId: string;
	days?: number | null;
	amountRub?: number | null;
	lifetime?: boolean;
	note?: string | null;
	idempotencyKey?: string | null;
	pricePerDay: number;
	now?: Date;
}

export async function getSubscriptionRecord(userId: string): Promise<SubscriptionRecord | null> {
	const [row] = await db
		.select({
			manualExpiresAt: subscriptions.manualExpiresAt,
			isLifetime: subscriptions.isLifetime,
			revokedAt: subscriptions.revokedAt,
			revokedRemainingMs: subscriptions.revokedRemainingMs,
			blockedAt: subscriptions.blockedAt,
			blockedReason: subscriptions.blockedReason,
			blockedRemainingMs: subscriptions.blockedRemainingMs
		})
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.limit(1);
	return row ?? null;
}

export async function getSubscriptionSources(userId: string): Promise<SubscriptionSourceRecord[]> {
	return db
		.select({
			provider: subscriptionSources.provider,
			externalId: subscriptionSources.externalId,
			active: subscriptionSources.active,
			checkedAt: subscriptionSources.checkedAt,
			lastError: subscriptionSources.lastError
		})
		.from(subscriptionSources)
		.where(eq(subscriptionSources.userId, userId));
}

export async function getSubscriptionSummary(
	userId: string,
	now = new Date()
): Promise<SubscriptionSummary> {
	const [record, sources] = await Promise.all([
		getSubscriptionRecord(userId),
		getSubscriptionSources(userId)
	]);
	return summarizeSubscription({ subscription: record, sources, now });
}

export async function getSubscriptionSummaries(
	userIds: string[],
	now = new Date()
): Promise<Map<string, SubscriptionSummary>> {
	const ids = Array.from(new Set(userIds.filter(Boolean)));
	const result = new Map<string, SubscriptionSummary>();
	if (ids.length === 0) return result;

	const [subscriptionRows, sourceRows] = await Promise.all([
		db
			.select({
				userId: subscriptions.userId,
				manualExpiresAt: subscriptions.manualExpiresAt,
				isLifetime: subscriptions.isLifetime,
				revokedAt: subscriptions.revokedAt,
				revokedRemainingMs: subscriptions.revokedRemainingMs,
				blockedAt: subscriptions.blockedAt,
				blockedReason: subscriptions.blockedReason,
				blockedRemainingMs: subscriptions.blockedRemainingMs
			})
			.from(subscriptions)
			.where(inArray(subscriptions.userId, ids)),
		db
			.select({
				userId: subscriptionSources.userId,
				provider: subscriptionSources.provider,
				externalId: subscriptionSources.externalId,
				active: subscriptionSources.active,
				checkedAt: subscriptionSources.checkedAt,
				lastError: subscriptionSources.lastError
			})
			.from(subscriptionSources)
			.where(inArray(subscriptionSources.userId, ids))
	]);

	const subscriptionByUser = new Map(
		subscriptionRows.map((row) => [
			row.userId,
			{
				manualExpiresAt: row.manualExpiresAt,
				isLifetime: row.isLifetime,
				revokedAt: row.revokedAt,
				revokedRemainingMs: row.revokedRemainingMs,
				blockedAt: row.blockedAt,
				blockedReason: row.blockedReason,
				blockedRemainingMs: row.blockedRemainingMs
			} satisfies SubscriptionRecord
		])
	);
	const sourcesByUser = new Map<string, SubscriptionSourceRecord[]>();
	for (const row of sourceRows) {
		const list = sourcesByUser.get(row.userId) ?? [];
		list.push({
			provider: row.provider,
			externalId: row.externalId,
			active: row.active,
			checkedAt: row.checkedAt,
			lastError: row.lastError
		});
		sourcesByUser.set(row.userId, list);
	}

	for (const id of ids) {
		result.set(
			id,
			summarizeSubscription({
				subscription: subscriptionByUser.get(id) ?? null,
				sources: sourcesByUser.get(id) ?? [],
				now
			})
		);
	}
	return result;
}

function normalizeDays(input: ManualGrantInput, pricePerDay: number): number {
	if (input.lifetime) return 0;
	if (input.days != null) {
		const days = Math.floor(Number(input.days));
		if (!Number.isFinite(days) || days < 1 || days > MAX_MANUAL_DAYS) {
			throw new SubscriptionError(`Количество дней должно быть от 1 до ${MAX_MANUAL_DAYS}`);
		}
		return days;
	}
	if (input.amountRub != null) {
		const amount = Math.floor(Number(input.amountRub));
		if (!Number.isFinite(amount) || amount < pricePerDay || amount > MAX_MANUAL_AMOUNT_RUB) {
			throw new SubscriptionError(
				`Сумма должна быть от ${pricePerDay} до ${MAX_MANUAL_AMOUNT_RUB.toLocaleString('ru-RU')} ₽`
			);
		}
		const days = daysFromAmount(amount, pricePerDay);
		if (days < 1) throw new SubscriptionError('Сумма меньше стоимости одного дня');
		return Math.min(days, MAX_MANUAL_DAYS);
	}
	throw new SubscriptionError('Укажите дни, сумму или вечную подписку');
}

export async function grantManual(input: ManualGrantInput) {
	const now = input.now ?? new Date();
	const price = Math.max(1, Math.floor(input.pricePerDay));
	const days = normalizeDays(input, price);
	let amountRub: number | null = null;
	if (input.amountRub != null) {
		const rawAmount = Number(input.amountRub);
		if (!Number.isFinite(rawAmount) || Math.floor(rawAmount) <= 0) {
			throw new SubscriptionError('Сумма доната должна быть положительным числом');
		}
		amountRub = Math.min(Math.floor(rawAmount), MAX_MANUAL_AMOUNT_RUB);
	}
	const idempotencyKey = input.idempotencyKey?.trim() || null;

	const result = await db.transaction(async (tx) => {
		await tx.insert(subscriptions).values({ userId: input.userId }).onConflictDoNothing();
		const [current] = await tx
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.userId, input.userId))
			.for('update');
		if (!current) throw new SubscriptionError('Не удалось создать запись подписки');

		if (idempotencyKey) {
			const [existingLedger] = await tx
				.select({ amountRub: donationLedger.amountRub })
				.from(donationLedger)
				.where(eq(donationLedger.idempotencyKey, idempotencyKey))
				.limit(1);
			if (existingLedger) {
				return {
					days: current.isLifetime ? null : days,
					amountRub: existingLedger.amountRub,
					expiresAt: current.manualExpiresAt,
					isLifetime: current.isLifetime
				};
			}
		}

		const beforeExpiresAt = current.manualExpiresAt;
		const beforeLifetime = current.isLifetime;
		if (current.revokedAt) {
			throw new SubscriptionError('Подписка отозвана. Сначала восстановите её');
		}
		if (current.isLifetime && !input.lifetime) {
			throw new SubscriptionError('У пользователя уже вечная подписка');
		}

		const MAX_MANUAL_MS = MAX_MANUAL_DAYS * 86_400_000;
		let manualExpiresAt: Date | null = null;
		let isLifetime = false;
		let bookedDays: number | null = null;
		let blockedRemainingMs = current.blockedRemainingMs;

		if (input.lifetime) {
			isLifetime = true;
			if (current.blockedAt != null) blockedRemainingMs = null;
		} else if (current.blockedAt != null) {
			blockedRemainingMs = Math.min(
				(current.blockedRemainingMs ?? 0) + days * 86_400_000,
				MAX_MANUAL_MS
			);
			manualExpiresAt = null;
			bookedDays = days;
		} else {
			const expiresAt = computeManualExpiry(current.manualExpiresAt, days, now);
			manualExpiresAt = expiresAt;
			bookedDays = days;
			if (manualExpiresAt.getTime() > new Date('9999-12-31T00:00:00Z').getTime()) {
				throw new SubscriptionError('Дата окончания слишком далеко');
			}
		}

		await tx
			.update(subscriptions)
			.set({
				manualExpiresAt,
				isLifetime,
				blockedRemainingMs,
				updatedBy: input.adminUserId
			})
			.where(eq(subscriptions.userId, input.userId));

		const eventId = crypto.randomUUID();
		await tx.insert(subscriptionEvents).values({
			id: eventId,
			userId: input.userId,
			type: 'grant',
			source: 'manual',
			days: bookedDays,
			amountRub,
			pricePerDay: amountRub != null ? price : null,
			beforeExpiresAt,
			afterExpiresAt: manualExpiresAt,
			beforeLifetime,
			afterLifetime: isLifetime,
			adminUserId: input.adminUserId,
			note: input.note?.trim().slice(0, 500) || null
		});
		if (amountRub != null && amountRub > 0) {
			await tx.insert(donationLedger).values(
				donationLedgerValues({
					userId: input.userId,
					amountRub,
					pricePerDay: price,
					createdAt: now,
					source: 'manual',
					note: input.note,
					idempotencyKey: idempotencyKey ?? `grant:${eventId}`
				})
			);
		}

		return {
			days: bookedDays,
			amountRub,
			expiresAt: manualExpiresAt,
			isLifetime
		};
	});

	// A renewal closes the price-change notice until the next price change.
	await dismissNoticesForUser(input.userId, 'renewal', now);
	return result;
}

export async function revokeManual(
	userId: string,
	adminUserId: string,
	note?: string | null,
	now = new Date()
) {
	return db.transaction(async (tx) => {
		await tx.insert(subscriptions).values({ userId }).onConflictDoNothing();
		const [current] = await tx
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.userId, userId))
			.for('update');
		if (!current || current.revokedAt) return false;

		const remainingMs = current.isLifetime
			? null
			: current.blockedAt && current.blockedRemainingMs != null
				? current.blockedRemainingMs
				: current.manualExpiresAt && current.manualExpiresAt.getTime() > now.getTime()
					? current.manualExpiresAt.getTime() - now.getTime()
					: 0;

		await tx
			.update(subscriptions)
			.set({
				manualExpiresAt: null,
				blockedRemainingMs: current.blockedAt ? null : current.blockedRemainingMs,
				revokedAt: now,
				revokedRemainingMs: remainingMs,
				updatedBy: adminUserId
			})
			.where(eq(subscriptions.userId, userId));
		await tx.insert(subscriptionEvents).values({
			userId,
			type: 'revoke',
			source: 'manual',
			beforeExpiresAt: current.manualExpiresAt,
			afterExpiresAt: null,
			beforeLifetime: current.isLifetime,
			afterLifetime: current.isLifetime,
			adminUserId,
			note: note?.trim().slice(0, 500) || null
		});
		return true;
	});
}

export async function restoreSubscription(
	userId: string,
	adminUserId: string,
	note?: string | null,
	now = new Date()
) {
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.userId, userId))
			.for('update');
		if (!current?.revokedAt) return false;

		const remainingMs = current.revokedRemainingMs ?? 0;
		const isBlocked = current.blockedAt != null;
		const manualExpiresAt =
			isBlocked || current.isLifetime || remainingMs <= 0
				? null
				: new Date(now.getTime() + remainingMs);
		const blockedRemainingMs = isBlocked
			? current.isLifetime
				? null
				: remainingMs
			: current.blockedRemainingMs;

		await tx
			.update(subscriptions)
			.set({
				manualExpiresAt,
				blockedRemainingMs,
				revokedAt: null,
				revokedRemainingMs: null,
				updatedBy: adminUserId
			})
			.where(eq(subscriptions.userId, userId));
		await tx.insert(subscriptionEvents).values({
			userId,
			type: 'restore',
			source: 'manual',
			beforeExpiresAt: current.manualExpiresAt,
			afterExpiresAt: manualExpiresAt,
			beforeLifetime: current.isLifetime,
			afterLifetime: current.isLifetime,
			adminUserId,
			note: note?.trim().slice(0, 500) || null
		});
		return true;
	});
}

export async function setManualExpiry(
	userId: string,
	expiresAt: Date | null,
	adminUserId: string,
	note?: string | null
) {
	return db.transaction(async (tx) => {
		await tx.insert(subscriptions).values({ userId }).onConflictDoNothing();
		const [current] = await tx
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.userId, userId))
			.for('update');
		if (!current) return;
		await tx
			.update(subscriptions)
			.set({
				manualExpiresAt: expiresAt,
				isLifetime: false,
				updatedBy: adminUserId
			})
			.where(eq(subscriptions.userId, userId));
		await tx.insert(subscriptionEvents).values({
			userId,
			type: 'set_expiry',
			source: 'manual',
			beforeExpiresAt: current.manualExpiresAt,
			afterExpiresAt: expiresAt,
			beforeLifetime: current.isLifetime,
			afterLifetime: false,
			adminUserId,
			note: note?.trim().slice(0, 500) || null
		});
	});
}

export async function setBlocked(
	userId: string,
	blocked: boolean,
	adminUserId: string,
	reason?: string | null,
	now = new Date()
) {
	return db.transaction(async (tx) => {
		await tx.insert(subscriptions).values({ userId }).onConflictDoNothing();
		const [current] = await tx
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.userId, userId))
			.for('update');
		if (!current) return;

		let manualExpiresAt = current.manualExpiresAt;
		let blockedRemainingMs = current.blockedRemainingMs;

		if (blocked) {
			if (!current.blockedAt) {
				blockedRemainingMs = current.isLifetime
					? null
					: current.manualExpiresAt && current.manualExpiresAt.getTime() > now.getTime()
						? current.manualExpiresAt.getTime() - now.getTime()
						: 0;
			}
			if (!current.revokedAt) manualExpiresAt = null;
		} else if (current.blockedAt) {
			manualExpiresAt =
				!current.isLifetime && (current.blockedRemainingMs ?? 0) > 0
					? new Date(now.getTime() + (current.blockedRemainingMs ?? 0))
					: null;
			blockedRemainingMs = null;
		}

		const blockedAt = blocked ? (current.blockedAt ?? now) : null;
		const blockedReason = blocked ? reason?.trim().slice(0, 500) || null : null;
		await tx
			.update(subscriptions)
			.set({
				manualExpiresAt,
				blockedAt,
				blockedReason,
				blockedRemainingMs,
				updatedBy: adminUserId
			})
			.where(eq(subscriptions.userId, userId));
		await tx.insert(subscriptionEvents).values({
			userId,
			type: blocked ? 'block' : 'unblock',
			source: 'manual',
			beforeExpiresAt: current.manualExpiresAt,
			afterExpiresAt: manualExpiresAt,
			beforeLifetime: current.isLifetime,
			afterLifetime: current.isLifetime,
			adminUserId,
			note: blockedReason
		});

		if (blocked) {
			await tx.delete(session).where(eq(session.userId, userId));
		}
	});
}

export interface SourceStateInput {
	userId: string;
	provider: 'telegram' | 'discord';
	externalId: string;
	active: boolean;
	checkedAt?: Date;
	lastError?: string | null;
	metadata?: string | null;
	note?: string | null;
}

/** Update cached source state; an audit event is written only on transition. */
export async function recordSourceState(input: SourceStateInput): Promise<{ changed: boolean }> {
	const checkedAt = input.checkedAt ?? new Date();
	return db.transaction(async (tx) => {
		const inserted = await tx
			.insert(subscriptionSources)
			.values({
				userId: input.userId,
				provider: input.provider,
				externalId: input.externalId,
				active: input.active,
				checkedAt,
				lastError: input.lastError ?? null,
				metadata: input.metadata ?? null
			})
			.onConflictDoNothing()
			.returning({ userId: subscriptionSources.userId });
		const [current] = await tx
			.select()
			.from(subscriptionSources)
			.where(
				and(
					eq(subscriptionSources.userId, input.userId),
					eq(subscriptionSources.provider, input.provider)
				)
			)
			.for('update');
		if (!current) return { changed: false };
		const wasInserted = inserted.length > 0;
		const changed = wasInserted
			? input.active
			: current.active !== input.active || current.externalId !== input.externalId;
		await tx
			.update(subscriptionSources)
			.set({
				externalId: input.externalId,
				active: input.active,
				checkedAt,
				lastError: input.lastError ?? null,
				metadata: input.metadata ?? null
			})
			.where(
				and(
					eq(subscriptionSources.userId, input.userId),
					eq(subscriptionSources.provider, input.provider)
				)
			);
		if (changed) {
			await tx.insert(subscriptionEvents).values({
				userId: input.userId,
				type: input.active ? 'source_activate' : 'source_deactivate',
				source: input.provider,
				provider: input.provider,
				externalId: input.externalId,
				afterExpiresAt: null,
				afterLifetime: false,
				note: input.note?.trim().slice(0, 500) || null
			});
		}
		return { changed };
	});
}

export async function listSubscriptionEvents(userId: string, limit = 20) {
	return db
		.select({
			id: subscriptionEvents.id,
			type: subscriptionEvents.type,
			source: subscriptionEvents.source,
			days: subscriptionEvents.days,
			amountRub: subscriptionEvents.amountRub,
			pricePerDay: subscriptionEvents.pricePerDay,
			beforeExpiresAt: subscriptionEvents.beforeExpiresAt,
			afterExpiresAt: subscriptionEvents.afterExpiresAt,
			beforeLifetime: subscriptionEvents.beforeLifetime,
			afterLifetime: subscriptionEvents.afterLifetime,
			provider: subscriptionEvents.provider,
			externalId: subscriptionEvents.externalId,
			note: subscriptionEvents.note,
			createdAt: subscriptionEvents.createdAt
		})
		.from(subscriptionEvents)
		.where(eq(subscriptionEvents.userId, userId))
		.orderBy(desc(subscriptionEvents.createdAt))
		.limit(Math.min(Math.max(limit, 1), 100));
}

export async function countSubscriptionStates(userIds: string[], now = new Date()) {
	const summaries = await getSubscriptionSummaries(userIds, now);
	let active = 0;
	let boosty = 0;
	let expiring = 0;
	let lifetime = 0;
	let blocked = 0;
	for (const summary of summaries.values()) {
		if (summary.active) active += 1;
		if (summary.boostyActive) boosty += 1;
		if (summary.daysLeft != null && summary.daysLeft > 0 && summary.daysLeft <= 7) expiring += 1;
		if (summary.isLifetime) lifetime += 1;
		if (summary.blocked) blocked += 1;
	}
	return { active, boosty, expiring, lifetime, blocked };
}

export async function touchSourceCheck(params: {
	userId: string;
	provider: 'telegram' | 'discord';
	externalId: string;
	lastError: string | null;
	checkedAt?: Date;
}): Promise<void> {
	await db
		.update(subscriptionSources)
		.set({
			checkedAt: params.checkedAt ?? new Date(),
			lastError: params.lastError
		})
		.where(
			and(
				eq(subscriptionSources.userId, params.userId),
				eq(subscriptionSources.provider, params.provider),
				eq(subscriptionSources.externalId, params.externalId)
			)
		);
}

export const subscriptionSql = { sql };
