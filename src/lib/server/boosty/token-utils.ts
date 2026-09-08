import { createHash, createHmac } from 'node:crypto';

/**
 * Чистые утилиты токенов Boosty ↔ лучше-auth (без зависимостей от БД),
 * чтобы их можно было покрыть unit-тестами.
 */

/** Email-плейсхолдер для нового пользователя (по числовому id Boosty). */
export function boostyEmail(boostyUserId: string): string {
	return (
		'boosty-' +
		createHash('sha256').update(boostyUserId).digest('hex').slice(0, 16) +
		'@boosty.local'
	);
}

/**
 * Значение session-cookie лучше-auth: token + '.' +
 * base64(HMAC-SHA256(secret, token)).
 *
 * ВАЖНО: возвращаем СЫРОЕ значение (без encodeURIComponent). Кодирование
 * выполняет SvelteKit (cookie.serialize по умолчанию применяет
 * encodeURIComponent), а лучше-auth декодирует ОДИН раз при чтении.
 * Если закодировать здесь ещё раз — получится двойное кодирование
 * (%2B → %252B) и подпись не сойдётся → сессия не найдена.
 */
export function buildSessionCookieValue(sessionToken: string, secret: string): string {
	const sig = createHmac('sha256', secret).update(sessionToken).digest('base64');
	return sessionToken + '.' + sig;
}

/**
 * Закодированное значение cookie (для прямого использования в заголовках,
 * например в интеграционных тестах без SvelteKit). Сервер декодирует один
 * раз — поэтому здесь encodeURIComponent обязателен.
 */
export function buildSessionCookieValueEncoded(sessionToken: string, secret: string): string {
	return encodeURIComponent(buildSessionCookieValue(sessionToken, secret));
}

/**
 * Имя session-cookie better-auth. В production (preview/прод) better-auth
 * добавляет префикс "__Secure-" (см. cookies/index.mjs: secureCookiePrefix =
 * isProduction ? "__Secure-" : ""); в dev — без префикса. Если поставить
 * cookie с неверным именем, getSession её не найдёт и юзер не авторизуется.
 *
 * @param isProduction true в preview/production-сборке (NODE_ENV=production)
 */
export function sessionCookieName(isProduction: boolean): string {
	return (isProduction ? '__Secure-' : '') + 'better-auth.session_token';
}
