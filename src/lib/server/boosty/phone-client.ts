/**
 * Прямой клиент входа Boosty по телефону + SMS-код (без headless).
 *
 * У Boosty нет публичного OAuth, но фронт boosty.to логинится через
 * приватные эндпоинты, которые мы воспроизводим сервером (проверено
 * живыми запросами, см. эксперименты):
 *
 *   1) POST /auth/phone/verification_code/send
 *        form: device_id=<uuid>&device_os=web&phone=<+7...>
 *        headers: X-App: web, X-From-Id: <device_id>, X-Locale
 *        cookie:  _clientId=<device_id>
 *        → { data: { phoneCode: { code: <verifyToken>, expiresIn } } }
 *
 *   2) PUT /auth/phone/verification_code/confirm
 *        form: phone&code=<verifyToken>&sms_code=<6 цифр>&device_os=web&device_id
 *        → { refresh_token, access_token, expires_in }
 *
 *   3) POST /oauth/token/
 *        form: grant_type=refresh_token&refresh_token&device_id&device_os
 *        → { access_token, refresh_token, expires_in }   (обновление)
 *
 * device_id — наш UUID (тот же, что фронт кладёт в cookie _clientId).
 */

import {
	BOOSTY_AVATAR_URL_PREFIX,
	BOOSTY_ENDPOINTS,
	BOOSTY_FETCH_TIMEOUT_MS,
	BOOSTY_ORIGIN,
	BOOSTY_REFERER,
	BOOSTY_USER_AGENT
} from '$lib/server/config';

export interface BoostySendResult {
	/** Verification token из ответа send (нужен для confirm). */
	verifyToken: string;
	expiresIn: number;
	/** transport: 'app' | 'gate' | 'sms' и т.п. */
	sentTransport: string | null;
}

export interface BoostyTokens {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}

/** Ошибка ответа Boosty с HTTP-статусом (для различения 4xx/5xx на сервере). */
export class BoostyApiError extends Error {
	readonly status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = 'BoostyApiError';
		this.status = status;
	}
}

/** Канонический E.164 номер: '+' + только цифры (пробелы/скобки/дефисы убираем). */
export function normalizePhone(input: unknown): string {
	const digits = String(input ?? '').replace(/\D/g, '');
	return digits ? '+' + digits : '';
}

/** Валидный E.164: '+' + 10–15 цифр (country code + национальный номер). */
export function isE164Phone(phone: string): boolean {
	return /^\+[0-9]{10,15}$/.test(phone);
}

/**
 * Базовые заголовки запроса к приватному API Boosty.
 * Переиспользуется в subscriptions.ts и phone-codes.
 */
export function boostyHeaders(
	deviceId: string,
	options: { locale?: 'en_US' | 'ru_RU'; extra?: Record<string, string> } = {}
): Record<string, string> {
	return {
		accept: 'application/json, text/plain, */*',
		'user-agent': BOOSTY_USER_AGENT,
		'x-app': 'web',
		'x-from-id': deviceId,
		'x-locale': options.locale ?? 'en_US',
		origin: BOOSTY_ORIGIN,
		referer: BOOSTY_REFERER,
		...options.extra
	};
}

function formHeaders(deviceId: string, extra: Record<string, string> = {}): Record<string, string> {
	return boostyHeaders(deviceId, {
		extra: {
			'content-type': 'application/x-www-form-urlencoded',
			cookie: '_clientId=' + deviceId,
			...extra
		}
	});
}

async function parseResponse<T>(res: Response): Promise<T> {
	const text = await res.text();
	let json: unknown = null;
	try {
		json = JSON.parse(text);
	} catch {
		// ignore
	}
	if (!res.ok) {
		const obj = (json ?? {}) as { error?: string; error_description?: string };
		const msg = obj.error_description || obj.error || 'HTTP ' + res.status;
		throw new BoostyApiError(msg, res.status);
	}
	return json as T;
}

/** Отправить SMS-код на телефон. Возвращает verify-token для confirm. */
export async function sendPhoneCode(phone: string, deviceId: string): Promise<BoostySendResult> {
	const body = new URLSearchParams({
		device_id: deviceId,
		device_os: 'web',
		phone
	});
	const res = await fetch(BOOSTY_ENDPOINTS.sendCode, {
		method: 'POST',
		headers: formHeaders(deviceId),
		body,
		signal: AbortSignal.timeout(BOOSTY_FETCH_TIMEOUT_MS)
	});
	const data = await parseResponse<{
		data?: { phoneCode?: { code?: string; expiresIn?: number; sentTransport?: string | null } };
	}>(res);
	const pc = data.data?.phoneCode;
	if (!pc?.code) throw new Error('Boosty не вернул код подтверждения');
	return {
		verifyToken: pc.code,
		expiresIn: pc.expiresIn ?? 0,
		sentTransport: pc.sentTransport ?? null
	};
}

/** Подтвердить SMS-код → токены. */
export async function confirmPhoneCode(params: {
	phone: string;
	verifyToken: string;
	smsCode: string;
	deviceId: string;
}): Promise<BoostyTokens> {
	const { phone, verifyToken, smsCode, deviceId } = params;
	const body = new URLSearchParams({
		phone,
		code: verifyToken,
		sms_code: smsCode,
		device_os: 'web',
		device_id: deviceId
	});
	const res = await fetch(BOOSTY_ENDPOINTS.confirmCode, {
		method: 'PUT',
		headers: formHeaders(deviceId),
		body,
		signal: AbortSignal.timeout(BOOSTY_FETCH_TIMEOUT_MS)
	});
	const data = await parseResponse<{
		refresh_token?: string;
		access_token?: string;
		expires_in?: number;
	}>(res);
	if (!data.refresh_token || !data.access_token) {
		throw new Error('Boosty не вернул токены');
	}
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresIn: data.expires_in ?? 0
	};
}

/** Обновить access_token по refresh_token (как boosty-js AuthProvider.refreshInternal). */
export async function refreshTokens(params: {
	refreshToken: string;
	deviceId: string;
}): Promise<BoostyTokens> {
	const { refreshToken, deviceId } = params;
	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: refreshToken,
		device_id: deviceId,
		device_os: 'web'
	});
	const res = await fetch(BOOSTY_ENDPOINTS.refreshToken, {
		method: 'POST',
		headers: formHeaders(deviceId),
		body,
		signal: AbortSignal.timeout(BOOSTY_FETCH_TIMEOUT_MS)
	});
	const data = await parseResponse<{
		refresh_token?: string;
		access_token?: string;
		expires_in?: number;
	}>(res);
	if (!data.refresh_token || !data.access_token) {
		throw new Error('Boosty не вернул токены при обновлении');
	}
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresIn: data.expires_in ?? 0
	};
}

/** Профиль пользователя Boosty, получаемый по access-токену. */
export interface BoostyProfile {
	/** Числовой id пользователя Boosty (например 30735072). */
	id: number | null;
	/** URL аватара (images.boosty.to/user/{id}/avatar). */
	avatarUrl: string | null;
}

/**
 * Достать профиль текущего пользователя по access-токену.
 *
 * У приватного API нет эндпоинта «мой профиль», но GET /v1/blog/self с
 * валидным Bearer-токеном возвращает signedQuery c user_id текущего
 * пользователя (например "?user_id=30735072&..."). По id строим URL аватара
 * (тот же формат, что фронт кладёт в cookie last_acc).
 */
export async function fetchBoostyProfile(params: {
	accessToken: string;
	deviceId: string;
}): Promise<BoostyProfile> {
	const res = await fetch(BOOSTY_ENDPOINTS.blogSelf, {
		headers: boostyHeaders(params.deviceId, {
			locale: 'ru_RU',
			extra: { authorization: 'Bearer ' + params.accessToken }
		}),
		signal: AbortSignal.timeout(BOOSTY_FETCH_TIMEOUT_MS)
	});
	if (!res.ok) return { id: null, avatarUrl: null };
	const data = (await res.json().catch(() => null)) as { signedQuery?: string } | null;
	const m = /user_id=(\d+)/.exec(data?.signedQuery ?? '');
	const id = m ? Number(m[1]) : null;
	return {
		id,
		avatarUrl: id ? BOOSTY_AVATAR_URL_PREFIX + id + '/avatar' : null
	};
}
