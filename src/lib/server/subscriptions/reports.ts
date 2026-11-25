import { and, count, desc, eq, gt, gte, inArray, isNull, max, or, sql, sum } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { donationLedger, subscriptionSources, subscriptions } from '$lib/server/db/schema';
import { user } from '$lib/server/db/auth.schema';

export interface DonationSummary {
	totalRub: number;
	donationsCount: number;
	lastDonationAt: Date | null;
}

export interface RevenueSummary {
	totalRub: number;
	donationsCount: number;
	donors: number;
	lastDonationAt: Date | null;
	last30Rub: number;
	last30Count: number;
	recent: Array<{
		id: string;
		userId: string | null;
		userName: string | null;
		donorKey: string;
		source: string;
		amountRub: number;
		pricePerDay: number | null;
		days: number | null;
		note: string | null;
		createdAt: Date;
	}>;
}

function toDate(value: Date | string | null | undefined): Date | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export async function getDonationSummaries(
	userIds: string[]
): Promise<Map<string, DonationSummary>> {
	const ids = Array.from(new Set(userIds.filter(Boolean)));
	const result = new Map<string, DonationSummary>();
	if (ids.length === 0) return result;

	const rows = await db
		.select({
			userId: donationLedger.userId,
			total: sum(donationLedger.amountRub),
			donationsCount: count(),
			lastDonationAt: max(donationLedger.createdAt)
		})
		.from(donationLedger)
		.where(inArray(donationLedger.userId, ids))
		.groupBy(donationLedger.userId);

	for (const row of rows) {
		if (!row.userId) continue;
		result.set(row.userId, {
			totalRub: Number(row.total) || 0,
			donationsCount: Number(row.donationsCount) || 0,
			lastDonationAt: toDate(row.lastDonationAt)
		});
	}
	return result;
}

export async function getUserDonationSummary(userId: string): Promise<DonationSummary> {
	return (
		(await getDonationSummaries([userId])).get(userId) ?? {
			totalRub: 0,
			donationsCount: 0,
			lastDonationAt: null
		}
	);
}

export async function getRevenueSummary(now = new Date()): Promise<RevenueSummary> {
	const since = new Date(now.getTime() - 30 * 86400000);
	const [totals] = await db
		.select({
			total: sum(donationLedger.amountRub),
			donationsCount: count(),
			donors: count(sql`DISTINCT ${donationLedger.donorKey}`),
			lastDonationAt: max(donationLedger.createdAt)
		})
		.from(donationLedger);

	const [last30] = await db
		.select({
			total: sum(donationLedger.amountRub),
			donationsCount: count()
		})
		.from(donationLedger)
		.where(gte(donationLedger.createdAt, since));

	const recentRows = await db
		.select({
			id: donationLedger.id,
			userId: donationLedger.userId,
			userName: user.name,
			donorKey: donationLedger.donorKey,
			source: donationLedger.source,
			amountRub: donationLedger.amountRub,
			pricePerDay: donationLedger.pricePerDay,
			note: donationLedger.note,
			createdAt: donationLedger.createdAt
		})
		.from(donationLedger)
		.leftJoin(user, eq(donationLedger.userId, user.id))
		.orderBy(desc(donationLedger.createdAt))
		.limit(100);

	return {
		totalRub: Number(totals?.total) || 0,
		donationsCount: Number(totals?.donationsCount) || 0,
		donors: Number(totals?.donors) || 0,
		lastDonationAt: toDate(totals?.lastDonationAt),
		last30Rub: Number(last30?.total) || 0,
		last30Count: Number(last30?.donationsCount) || 0,
		recent: recentRows.map((row) => ({
			...row,
			amountRub: Number(row.amountRub) || 0,
			pricePerDay: row.pricePerDay == null ? null : Number(row.pricePerDay),
			days: null,
			createdAt: toDate(row.createdAt) ?? now
		}))
	};
}

/** Active effective subscribers: lifetime/manual or any active Telegram/Discord source. */
export async function getActiveSubscriberIds(now = new Date()): Promise<string[]> {
	const [subscriptionRows, sourceRows] = await Promise.all([
		db
			.select({ userId: subscriptions.userId })
			.from(subscriptions)
			.where(
				and(
					isNull(subscriptions.blockedAt),
					isNull(subscriptions.revokedAt),
					or(eq(subscriptions.isLifetime, true), gt(subscriptions.manualExpiresAt, now))
				)
			),
		db
			.select({ userId: subscriptionSources.userId })
			.from(subscriptionSources)
			.leftJoin(subscriptions, eq(subscriptionSources.userId, subscriptions.userId))
			.where(
				and(
					eq(subscriptionSources.active, true),
					isNull(subscriptions.blockedAt),
					isNull(subscriptions.revokedAt)
				)
			)
	]);
	return Array.from(
		new Set([...subscriptionRows.map((row) => row.userId), ...sourceRows.map((row) => row.userId)])
	);
}

export async function countActiveSubscribers(now = new Date()): Promise<number> {
	return (await getActiveSubscriberIds(now)).length;
}
