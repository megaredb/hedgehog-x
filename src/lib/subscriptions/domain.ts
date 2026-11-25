export const DEFAULT_PRICE_PER_DAY_RUB = 7;
export const MAX_MANUAL_DAYS = 36500;
export const MAX_MANUAL_AMOUNT_RUB = 1000000;

export type SubscriptionSourceProvider = 'telegram' | 'discord';
export type SubscriptionSourceKind =
	'none' | 'manual' | 'telegram' | 'discord' | 'both' | 'lifetime';

export interface SubscriptionRecord {
	manualExpiresAt: Date | null;
	isLifetime: boolean;
	revokedAt: Date | null;
	revokedRemainingMs: number | null;
	blockedAt: Date | null;
	blockedReason: string | null;
	blockedRemainingMs: number | null;
}

export interface SubscriptionSourceRecord {
	provider: string;
	externalId: string;
	active: boolean;
	checkedAt: Date | null;
	lastError: string | null;
}

export interface SubscriptionSummary {
	active: boolean;
	isLifetime: boolean;
	blocked: boolean;
	blockedReason: string | null;
	revoked: boolean;
	revokedDaysLeft: number | null;
	expiresAt: Date | null;
	daysLeft: number | null;
	source: SubscriptionSourceKind;
	boostyActive: boolean;
	telegramActive: boolean;
	discordActive: boolean;
	telegramCheckedAt: Date | null;
	discordCheckedAt: Date | null;
}

export const EMPTY_SUBSCRIPTION: SubscriptionRecord = {
	manualExpiresAt: null,
	isLifetime: false,
	revokedAt: null,
	revokedRemainingMs: null,
	blockedAt: null,
	blockedReason: null,
	blockedRemainingMs: null
};

/** Convert a manual donation amount to whole subscription days. */
export function daysFromAmount(amountRub: number, pricePerDay = DEFAULT_PRICE_PER_DAY_RUB): number {
	if (!Number.isFinite(amountRub) || !Number.isFinite(pricePerDay) || pricePerDay <= 0) return 0;
	const amount = Math.floor(amountRub);
	if (amount <= 0) return 0;
	return Math.floor(amount / pricePerDay);
}

export function repriceRemainingMs(
	remainingMs: number,
	oldPrice: number,
	newPrice: number
): number {
	if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0;
	if (!Number.isFinite(oldPrice) || oldPrice <= 0) return 0;
	if (!Number.isFinite(newPrice) || newPrice <= 0) return 0;
	return Math.max(0, Math.floor((remainingMs * oldPrice) / newPrice));
}

export function addDays(date: Date, days: number): Date {
	const result = new Date(date.getTime());
	result.setDate(result.getDate() + days);
	return result;
}

/** Manual grants always extend from the later of now and the current expiry. */
export function computeManualExpiry(
	currentExpiresAt: Date | null,
	days: number,
	now = new Date()
): Date {
	const start =
		currentExpiresAt && currentExpiresAt.getTime() > now.getTime() ? currentExpiresAt : now;
	return addDays(start, Math.max(0, Math.floor(days)));
}

export function daysLeftUntil(expiresAt: Date | null, now = new Date()): number | null {
	if (!expiresAt) return null;
	return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000));
}

export function summarizeSubscription(params: {
	subscription?: SubscriptionRecord | null;
	sources?: SubscriptionSourceRecord[];
	now?: Date;
}): SubscriptionSummary {
	const now = params.now ?? new Date();
	const subscription = params.subscription ?? EMPTY_SUBSCRIPTION;
	const sources = params.sources ?? [];
	const telegram = sources.find((source) => source.provider === 'telegram');
	const discord = sources.find((source) => source.provider === 'discord');
	const telegramActive = Boolean(telegram?.active);
	const discordActive = Boolean(discord?.active);
	const boostyActive = telegramActive || discordActive;
	const manualActive = Boolean(
		!subscription.isLifetime &&
		subscription.manualExpiresAt &&
		subscription.manualExpiresAt.getTime() > now.getTime()
	);
	const blocked = Boolean(subscription.blockedAt);
	const revoked = Boolean(subscription.revokedAt);
	const isLifetime = Boolean(subscription.isLifetime);
	const active = !blocked && !revoked && (isLifetime || manualActive || boostyActive);

	let source: SubscriptionSourceKind = 'none';
	if (revoked) source = 'none';
	else if (isLifetime) source = 'lifetime';
	else if (manualActive && boostyActive) source = 'both';
	else if (manualActive) source = 'manual';
	else if (telegramActive && discordActive) source = 'both';
	else if (telegramActive) source = 'telegram';
	else if (discordActive) source = 'discord';

	const expiresAt =
		revoked || isLifetime ? null : manualActive ? subscription.manualExpiresAt : null;
	const daysLeft =
		revoked || isLifetime
			? null
			: manualActive
				? daysLeftUntil(subscription.manualExpiresAt, now)
				: null;
	const revokedDaysLeft =
		revoked && subscription.revokedRemainingMs != null
			? Math.max(0, Math.ceil(subscription.revokedRemainingMs / 86400000))
			: null;

	return {
		active,
		isLifetime,
		blocked,
		blockedReason: subscription.blockedReason ?? null,
		revoked,
		revokedDaysLeft,
		expiresAt,
		daysLeft,
		source,
		boostyActive,
		telegramActive,
		discordActive,
		telegramCheckedAt: telegram?.checkedAt ?? null,
		discordCheckedAt: discord?.checkedAt ?? null
	};
}

export function pluralDays(value: number): string {
	const abs = Math.abs(value) % 100;
	const last = abs % 10;
	if (abs > 10 && abs < 20) return 'дней';
	if (last > 1 && last < 5) return 'дня';
	if (last === 1) return 'день';
	return 'дней';
}

export function sourceLabel(summary: SubscriptionSummary): string {
	if (summary.blocked) return 'Заблокирована';
	if (summary.revoked) return 'Отозвана';
	if (summary.isLifetime) return 'Вечная';
	if (summary.active) return 'Активна';
	return 'Нет подписки';
}
