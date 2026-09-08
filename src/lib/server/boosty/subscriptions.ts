import { boostyHeaders, refreshTokens } from '$lib/server/boosty/phone-client';
import { BOOSTY_ENDPOINTS, BOOSTY_FETCH_TIMEOUT_MS, HEDGEHOG_OWNER_ID } from '$lib/server/config';

/**
 * Подписки пользователя Boosty: проверка подписки на блог HEDGEHOG.INC.
 *
 * Данные берём из приватного API Boosty как фронт:
 *   GET /v1/user/subscriptions?limit=30&with_follow=true
 *   Authorization: Bearer <access_token>
 * (access обновляем по refresh_token, если нужно).
 */

export interface HedgehogSubscriptionStatus {
	/** Есть ли у пользователя привязанный Boosty-аккаунт. */
	linked: boolean;
	/** Есть ли активная подписка на блог HEDGEHOG.INC. */
	subscribed: boolean;
	/** Название уровня подписки (например «ПОВЕЛИТЕЛЬ!»). */
	levelName: string | null;
	/** Цена за период в рублях. */
	priceRub: number | null;
	/** Период подписки в месяцах (period), по умолчанию 1. */
	periodMonths: number | null;
	/** Дата следующего платежа (unix, секунды) — до какого числа действует. */
	nextPayTime: number | null;
	/** Дата оформления (unix, секунды). */
	onTime: number | null;
	/** Оплачена ли текущая подписка. */
	isFeePaid: boolean;
	/** Приостановлена ли подписка. */
	isPaused: boolean;
	/** Произошла ли ошибка при проверке подписки (апстрим Boosty/сеть). */
	isError: boolean;
	/** Пользовательское сообщение об ошибке (без сырых деталей апстрима). */
	error: string | null;
}

interface SubscriptionRaw {
	name?: string;
	price?: number;
	period?: number;
	isFeePaid?: boolean;
	isPaused?: boolean;
	onTime?: number;
	nextPayTime?: number | null;
	currencyPrices?: Record<string, number>;
	blog?: {
		blogUrl?: string;
		owner?: { id?: number; name?: string };
	};
}

async function fetchSubscriptions(params: {
	refreshToken: string;
	deviceId: string;
}): Promise<{ subs: SubscriptionRaw[]; newRefreshToken: string | null }> {
	// 1. Получаем свежий access_token по refresh. ВАЖНО: каждый успешный
	// refresh РОТИРУЕТ refresh_token (старый отзывается). Возвращаем новый
	// наружу, чтобы вызывающий сохранил его в БД.
	const tokens = await refreshTokens({
		refreshToken: params.refreshToken,
		deviceId: params.deviceId
	});
	// 2. Список подписок.
	const res = await fetch(BOOSTY_ENDPOINTS.subscriptions, {
		headers: boostyHeaders(params.deviceId, {
			locale: 'ru_RU',
			extra: { authorization: 'Bearer ' + tokens.accessToken }
		}),
		signal: AbortSignal.timeout(BOOSTY_FETCH_TIMEOUT_MS)
	});
	if (!res.ok) {
		throw new Error('Boosty subscriptions: HTTP ' + res.status);
	}
	const data = (await res.json()) as { data?: SubscriptionRaw[] };
	return { subs: data.data ?? [], newRefreshToken: tokens.refreshToken };
}

export interface HedgehogSubscriptionResult {
	status: HedgehogSubscriptionStatus;
	/** Новый refresh_token (после ротации) — сохранить в БД. */
	newRefreshToken: string | null;
}

const EMPTY_STATUS: HedgehogSubscriptionStatus = {
	linked: true,
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
};

/** Проверить подписку на HEDGEHOG.INC. */
export async function getHedgehogSubscription(params: {
	refreshToken: string;
	deviceId: string;
}): Promise<HedgehogSubscriptionResult> {
	try {
		const { subs, newRefreshToken } = await fetchSubscriptions(params);
		// Ищем подписку строго по ownerId блога (HEDGEHOG.INC = 1876162),
		// а не по имени владельца (оно может меняться).
		const target = subs.find((s) => s.blog?.owner?.id === HEDGEHOG_OWNER_ID);
		if (!target) {
			return { status: EMPTY_STATUS, newRefreshToken };
		}
		return {
			status: {
				linked: true,
				subscribed: true,
				levelName: target.name ?? null,
				priceRub: target.currencyPrices?.RUB ?? target.price ?? null,
				periodMonths: target.period ?? 1,
				nextPayTime: target.nextPayTime ?? null,
				onTime: target.onTime ?? null,
				isFeePaid: target.isFeePaid ?? false,
				isPaused: target.isPaused ?? false,
				isError: false,
				error: null
			},
			newRefreshToken
		};
	} catch (e) {
		// Ошибка апстрима: явный признак isError + логирование. Не маскируем
		// сбой под «подписка неактивна» (раньше было linked:true + error).
		console.error('[boosty/subscriptions] failed to check subscription', e);
		return {
			status: {
				...EMPTY_STATUS,
				isError: true,
				error: 'Не удалось проверить подписку Boosty'
			},
			newRefreshToken: null
		};
	}
}
