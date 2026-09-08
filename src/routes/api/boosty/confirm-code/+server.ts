import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import {
	BoostyApiError,
	confirmPhoneCode,
	fetchBoostyProfile,
	isE164Phone,
	normalizePhone,
	type BoostyProfile,
	type BoostyTokens
} from '$lib/server/boosty/phone-client';
import { completeBoostyLogin } from '$lib/server/boosty/complete-flow';
import { buildSessionCookieValue, sessionCookieName } from '$lib/server/boosty/token-utils';
import { checkRateLimitGroup } from '$lib/server/rate-limit';
import { SESSION_TTL_SECONDS, getBetterAuthSecret } from '$lib/server/config';

/**
 * POST /api/boosty/confirm-code
 * Подтверждает SMS-код и создаёт локальную сессию better-auth
 * (provider 'boosty') — «вход через Boosty» без headless.
 *
 * Тело: { deviceId, verifyToken, smsCode, phone }
 * Ответ: 200 { ok, user } + Set-Cookie (для входа)
 *        или { error, status }.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = async ({ request, cookies, locals, getClientAddress }) => {
	let body: { deviceId?: string; verifyToken?: string; smsCode?: string; phone?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}
	const deviceId = body?.deviceId;
	const verifyToken = body?.verifyToken;
	const smsCode = body?.smsCode;
	if (!deviceId || !verifyToken || !smsCode || !body?.phone) {
		return json({ error: 'deviceId, verifyToken, smsCode и phone обязательны' }, { status: 400 });
	}
	// Валидируем входные данные до обращения к Boosty/БД.
	if (!UUID_RE.test(deviceId)) {
		return json({ error: 'deviceId должен быть корректным UUID' }, { status: 400 });
	}
	if (!/^\d{6}$/.test(smsCode)) {
		return json({ error: 'Код подтверждения должен состоять из 6 цифр' }, { status: 400 });
	}
	const phone = normalizePhone(body.phone);
	if (!isE164Phone(phone)) {
		return json({ error: 'Введите корректный номер телефона' }, { status: 400 });
	}

	const limit = checkRateLimitGroup('confirm-code', phone, getClientAddress());
	if (!limit.ok) {
		return json(
			{ error: 'Слишком много попыток. Попробуйте позже.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
		);
	}

	// 1. Подтверждение SMS-кода. 4xx от Boosty (неверный код) — ошибка клиента;
	// 5xx/сетевые ошибки — сбой апстрима (502).
	let tokens: BoostyTokens;
	try {
		tokens = await confirmPhoneCode({ phone, verifyToken, smsCode, deviceId });
	} catch (e) {
		if (e instanceof BoostyApiError && e.status >= 400 && e.status < 500) {
			return json({ error: 'Неверный код подтверждения' }, { status: 400 });
		}
		console.error('[boosty/confirm-code] confirm failed', e);
		return json({ error: 'Не удалось подтвердить код. Попробуйте позже.' }, { status: 502 });
	}

	// 2. Профиль Boosty (стабильный user_id для ключа аккаунта + аватар).
	let profile: BoostyProfile;
	try {
		profile = await fetchBoostyProfile({ accessToken: tokens.accessToken, deviceId });
	} catch (e) {
		console.error('[boosty/confirm-code] profile fetch failed', e);
		return json({ error: 'Не удалось загрузить профиль. Попробуйте позже.' }, { status: 502 });
	}
	if (!profile.id) {
		return json({ error: 'Не удалось загрузить профиль. Попробуйте позже.' }, { status: 502 });
	}

	// 3. Создание/обновление локальной записи user + account + session.
	const currentUser = locals.user;
	let result: Awaited<ReturnType<typeof completeBoostyLogin>>;
	try {
		result = await completeBoostyLogin({
			refreshToken: tokens.refreshToken,
			deviceId,
			boostyUserId: profile.id,
			linkToUserId: currentUser?.id ?? null,
			skipSession: !!currentUser,
			boostyAvatarHint: profile.avatarUrl
		});
	} catch (e) {
		console.error('[boosty/confirm-code] complete login failed', e);
		return json({ error: 'Не удалось завершить вход. Попробуйте позже.' }, { status: 500 });
	}

	// Новый вход — выставляем session-cookie better-auth.
	// ВАЖНО: в production better-auth ожидает cookie с префиксом "__Secure-",
	// иначе getSession не найдёт сессию. Имя выбираем по режиму запуска.
	if (!currentUser && result.sessionToken) {
		const secret = getBetterAuthSecret();
		const cookieValue = buildSessionCookieValue(result.sessionToken, secret);
		const isProduction = !dev;
		const isHttps = new URL(request.url).protocol === 'https:';
		cookies.set(sessionCookieName(isProduction), cookieValue, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: isProduction || isHttps,
			maxAge: SESSION_TTL_SECONDS
		});
	}
	return json({ ok: true, user: { id: result.userId, name: result.name, image: result.image } });
};
