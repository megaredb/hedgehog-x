import { json } from '@sveltejs/kit';
import { confirmPhoneCode, fetchBoostyProfile } from '$lib/server/boosty/phone-client';
import { completeBoostyLogin } from '$lib/server/boosty/complete-flow';
import { buildSessionCookieValue, sessionCookieName } from '$lib/server/boosty/token-utils';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { checkRateLimitGroup } from '$lib/server/rate-limit';
import { SESSION_TTL_SECONDS } from '$lib/server/config';

/**
 * POST /api/boosty/confirm-code
 * Подтверждает SMS-код и создаёт локальную сессию better-auth
 * (provider 'boosty') — «вход через Boosty» без headless.
 *
 * Тело: { deviceId, verifyToken, smsCode, phone }
 * Ответ: 200 { ok, user } + Set-Cookie (для входа)
 *        или { error, status }.
 */

export const POST = async ({ request, cookies, locals, getClientAddress }) => {
	let body: { deviceId?: string; verifyToken?: string; smsCode?: string; phone?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}
	const { deviceId, verifyToken, smsCode, phone } = body;
	if (!deviceId || !verifyToken || !smsCode || !phone) {
		return json({ error: 'deviceId, verifyToken, smsCode и phone обязательны' }, { status: 400 });
	}

	const limit = checkRateLimitGroup('confirm-code', phone, getClientAddress());
	if (!limit.ok) {
		return json({ error: 'Слишком много попыток. Попробуйте позже.' }, { status: 429 });
	}

	try {
		const tokens = await confirmPhoneCode({
			phone,
			verifyToken,
			smsCode,
			deviceId
		});
		// Профиль Boosty: стабильный user_id (ключ аккаунта) + аватар.
		const profile = await fetchBoostyProfile({
			accessToken: tokens.accessToken,
			deviceId
		});
		if (!profile.id) {
			return json({ error: 'Не удалось определить профиль Boosty' }, { status: 400 });
		}
		// Привязка к уже вошедшему пользователю (/profile) или новый вход.
		const currentUser = locals.user;
		const result = await completeBoostyLogin({
			refreshToken: tokens.refreshToken,
			deviceId,
			boostyUserId: profile.id,
			linkToUserId: currentUser?.id ?? null,
			skipSession: !!currentUser,
			boostyAvatarHint: profile.avatarUrl
		});
		// Новый вход — выставляем session-cookie better-auth.
		// ВАЖНО: в production better-auth ожидает cookie с префиксом
		// "__Secure-", иначе getSession не найдёт сессию (юзер «создаётся,
		// но не авторизуется»). Имя выбираем по режиму запуска.
		if (!currentUser && result.sessionToken) {
			const secret = env.BETTER_AUTH_SECRET ?? '';
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
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: msg }, { status: 400 });
	}
};
