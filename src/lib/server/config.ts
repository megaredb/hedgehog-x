import { env } from '$env/dynamic/private';

/**
 * Server-only конфигурация: env-overridable значения и константы внешних
 * сервисов (Boosty). Не импортировать на клиенте и в service worker.
 */

// ─── Блог HEDGEHOG.INC (env-overridable) ─────────────────────────────────────
// Идентификация блога — строго по числовому owner.id (имя/слаг могут меняться),
// поэтому URL-слаг блога не храним и не используем.
const ownerId = Number.parseInt(env.HEDGEHOG_OWNER_ID ?? '', 10);
export const HEDGEHOG_OWNER_ID = Number.isFinite(ownerId) ? ownerId : 1876162;

// ─── Boosty API ──────────────────────────────────────────────────────────────
const BOOSTY_DOMAIN = 'boosty.to';

export const BOOSTY_ORIGIN = `https://${BOOSTY_DOMAIN}`;
export const BOOSTY_REFERER = `${BOOSTY_ORIGIN}/`;
export const BOOSTY_API_BASE = `https://api.${BOOSTY_DOMAIN}`;
export const BOOSTY_AVATAR_URL_PREFIX = `https://images.${BOOSTY_DOMAIN}/user/`;
export const BOOSTY_USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

export const BOOSTY_ENDPOINTS = {
	sendCode: `${BOOSTY_API_BASE}/auth/phone/verification_code/send`,
	confirmCode: `${BOOSTY_API_BASE}/auth/phone/verification_code/confirm`,
	refreshToken: `${BOOSTY_API_BASE}/oauth/token/`,
	blogSelf: `${BOOSTY_API_BASE}/v1/blog/self`,
	subscriptions: `${BOOSTY_API_BASE}/v1/user/subscriptions?limit=30&with_follow=true`,
	phoneCodes: `${BOOSTY_ORIGIN}/app/extra-config/phone-codes/`
} as const;

/** Таймаут внешних HTTP-запросов к Boosty (мс) — защита от зависшего апстрима. */
export const BOOSTY_FETCH_TIMEOUT_MS = 12_000;

// ─── Сессия better-auth (Boosty-вход) ────────────────────────────────────────
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 дней (для cookie maxAge)
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

// ─── Префиксы идентификаторов ────────────────────────────────────────────────
export const USER_ID_PREFIX = 'u_';
export const ACCOUNT_ID_PREFIX = 'a_';
export const SESSION_ID_PREFIX = 's_';

// ─── Секрет better-auth ────────────────────────────────────────────────────────
/**
 * Валидированный секрет better-auth. Обязателен для подписи session-cookie
 * (HMAC-SHA256): без него Boosty-вход не сможет выставить валидную cookie.
 */
export function getBetterAuthSecret(): string {
	const secret = env.BETTER_AUTH_SECRET?.trim();
	if (!secret) {
		throw new Error('BETTER_AUTH_SECRET is required');
	}
	return secret;
}
