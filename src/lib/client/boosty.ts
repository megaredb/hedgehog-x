/**
 * Клиентский API «вход через Boosty» (телефон + SMS-код, без headless).
 *
 * Флоу:
 *   1. Юзер вводит телефон → POST /api/boosty/send-code → Boosty шлёт SMS,
 *      сервер возвращает deviceId + verifyToken.
 *   2. Юзер вводит 6-значный код → POST /api/boosty/confirm-code → сервер
 *      подтверждает код у Boosty, создаёт сессию better-auth (provider
 *      'boosty') и ставит session-cookie.
 */

export interface BoostySendResult {
	ok: boolean;
	deviceId: string;
	verifyToken: string;
	sentTransport: string | null;
}

export interface BoostyConfirmResult {
	ok: boolean;
	user?: { id: string; name: string; image: string | null };
}

/** Страна/код телефона из API Boosty. */
export interface BoostyPhoneCode {
	name: string;
	dialCode: string;
	code: string;
	mask?: string;
}

/** Эмодзи-флаг по ISO-коду страны (RU → 🇷🇺). */
export function flagEmoji(isoCode: string): string {
	return isoCode
		.toUpperCase()
		.replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}

/** Загрузить список кодов стран (каждый раз из API Boosty через прокси). */
export async function boostyPhoneCodes(): Promise<BoostyPhoneCode[]> {
	const res = await fetch('/api/boosty/phone-codes');
	const body = await res.json().catch(() => null);
	if (!res.ok) throw new Error(body?.error ?? 'Не удалось загрузить коды стран');
	return (body?.phoneCodes ?? []) as BoostyPhoneCode[];
}

/** Шаг 1: отправить SMS-код на телефон. */
export async function boostySendCode(phone: string): Promise<BoostySendResult> {
	const res = await fetch('/api/boosty/send-code', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ phone })
	});
	const body = await res.json().catch(() => null);
	if (!res.ok) throw new Error(body?.error ?? 'Не удалось отправить код');
	return body as BoostySendResult;
}

/** Шаг 2: подтвердить SMS-код (сервер сам создаст сессию). */
export async function boostyConfirmCode(params: {
	deviceId: string;
	verifyToken: string;
	smsCode: string;
	phone: string;
}): Promise<BoostyConfirmResult> {
	const res = await fetch('/api/boosty/confirm-code', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(params)
	});
	const body = await res.json().catch(() => null);
	if (!res.ok) throw new Error(body?.error ?? 'Не удалось подтвердить код');
	return body as BoostyConfirmResult;
}

/** Статус подписки текущего пользователя на HEDGEHOG.INC в Boosty. */
export interface BoostySubscriptionStatus {
	linked: boolean;
	subscribed: boolean;
	levelName: string | null;
	priceRub: number | null;
	periodMonths: number | null;
	nextPayTime: number | null;
	onTime: number | null;
	isFeePaid: boolean;
	isPaused: boolean;
	error: string | null;
}

/** Загрузить статус подписки (для залогиненного пользователя). */
export async function boostySubscriptionStatus(): Promise<BoostySubscriptionStatus> {
	const res = await fetch('/api/boosty/subscription');
	const body = await res.json().catch(() => null);
	if (!res.ok) throw new Error(body?.error ?? 'Не удалось загрузить подписку');
	return body as BoostySubscriptionStatus;
}

/** Человекочитаемая дата окончания подписки (nextPayTime, unix-сек). */
export function formatBoostyDate(unixSec: number | null): string | null {
	if (!unixSec) return null;
	return new Date(unixSec * 1000).toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}
