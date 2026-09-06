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

const BOOSTY_API = 'https://api.boosty.to';

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

function headers(deviceId: string, extra: Record<string, string> = {}): Record<string, string> {
	return {
		accept: 'application/json, text/plain, */*',
		'content-type': 'application/x-www-form-urlencoded',
		'user-agent':
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
		'x-app': 'web',
		'x-from-id': deviceId,
		'x-locale': 'en_US',
		origin: 'https://boosty.to',
		referer: 'https://boosty.to/',
		cookie: '_clientId=' + deviceId,
		...extra
	};
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
		throw new Error(msg);
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
	const res = await fetch(BOOSTY_API + '/auth/phone/verification_code/send', {
		method: 'POST',
		headers: headers(deviceId),
		body
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
	const res = await fetch(BOOSTY_API + '/auth/phone/verification_code/confirm', {
		method: 'PUT',
		headers: headers(deviceId),
		body
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
	const res = await fetch(BOOSTY_API + '/oauth/token/', {
		method: 'POST',
		headers: headers(deviceId),
		body
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
	const res = await fetch(BOOSTY_API + '/v1/blog/self', {
		headers: {
			accept: 'application/json, text/plain, */*',
			authorization: 'Bearer ' + params.accessToken,
			'user-agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
			'x-app': 'web',
			'x-from-id': params.deviceId,
			'x-locale': 'ru_RU'
		}
	});
	if (!res.ok) return { id: null, avatarUrl: null };
	const data = (await res.json().catch(() => null)) as { signedQuery?: string } | null;
	const m = /user_id=(\d+)/.exec(data?.signedQuery ?? '');
	const id = m ? Number(m[1]) : null;
	return {
		id,
		avatarUrl: id ? 'https://images.boosty.to/user/' + id + '/avatar' : null
	};
}
