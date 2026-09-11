import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { telegram } from 'better-auth-telegram';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { createLogger } from '$lib/logger';

const log = createLogger('Auth');

// Динамический baseURL: better-auth сам определяет origin из запроса
// и добавляет все allowedHosts в trustedOrigins (иначе POST /api/auth/*
// с заголовком Origin не пройдёт origin-check и вернёт 403 Invalid origin).
// Протокол берётся из запроса (default 'auto'): для localhost — http, для
// HTTPS-хоста (mkcert hedgehog-inc.localhost) — https.
//
// Конфиг baseURL строится ТОЛЬКО из env — никаких значений по умолчанию:
//   BETTER_AUTH_ALLOWED_HOSTS — список доверенных хостов через запятую
//     (строка, без пробелов; порт включается в элемент, как 'localhost:5173').
//   BETTER_AUTH_FALLBACK_URL — URL, используемый, когда origin не определяется
//     из запроса (опционально).
// Если BETTER_AUTH_ALLOWED_HOSTS не задан — baseURL не передаётся, и
// better-auth сам выводит origin из запроса.
const allowedHosts = env.BETTER_AUTH_ALLOWED_HOSTS
	? env.BETTER_AUTH_ALLOWED_HOSTS.split(',')
			.map((h) => h.trim())
			.filter((h) => h.length > 0)
	: undefined;

const baseURL = allowedHosts?.length
	? { allowedHosts, fallback: env.BETTER_AUTH_FALLBACK_URL }
	: undefined;

/**
 * Настоящий Telegram id пользователя из OIDC-claims.
 *
 * Плагин better-auth-telegram ставит в accountId сырое значение `claims.sub`
 * (20 цифр — внутренний идентификатор Telegram OIDC), а не id пользователя.
 * При этом в claims есть поле `id?: number` — это и есть настоящий telegram id
 * (например 1249750628). Если `id` отсутствует — пробуем расшифровать sub:
 * формат `{bot_id}{user_id}` (бот-токен, часть до «:» — префикс).
 */
function telegramUserIdFromClaims(claims: { sub: string; id?: number | null }): string | null {
	return String(claims.id);
}

export const auth = betterAuth({
	baseURL,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: false },
	// Дополнительные поля пользователя — хранят аватар и username каждого
	// провайдера отдельно (Telegram и Discord), чтобы показывать их именно
	// в карточке соответствующего способа входа.
	user: {
		additionalFields: {
			// НЕ ставим input: false — better-auth выбрасывает такие поля при
			// импорте профиля провайдера (parseAdditionalUserInputFromProviderProfile),
			// и аватары/username не попадают в user. Храним их внутри процесса
			// (приходят только из mapProfileToUser / mapOIDCProfileToUser),
			// на изменение через API-эндпоинты не выставляем.
			telegramAvatar: { type: 'string' },
			telegramOidcUsername: { type: 'string' },
			discordAvatar: { type: 'string' },
			discordUsername: { type: 'string' }
		}
	},
	socialProviders: {
		discord: {
			clientId: env.DISCORD_CLIENT_ID,
			clientSecret: env.DISCORD_CLIENT_SECRET,
			// Сохраняем аватар/username Discord в отдельные поля user.
			mapProfileToUser: (profile) => ({
				discordAvatar: profile.image_url,
				discordUsername: profile.username ?? null
			}),
			// При каждом входе через Discord обновлять user.image/name —
			// «аватар профиля = платформа последнего входа».
			overrideUserInfoOnSignIn: true
		}
	},
	account: {
		accountLinking: {
			enabled: true,
			// Нельзя отвязать последний способ входа — защита от потери доступа.
			// (better-auth сам блокирует отвязку, когда остаётся один аккаунт.)
			allowUnlinkingAll: false,
			// Telegram-юзерам ставится email-плейсхолдер (<sub>@telegram.oidc),
			// а Discord возвращает реальный email — без этого линковка Discord
			// к Telegram-аккаунту падала с «email_doesn't_match».
			allowDifferentEmails: true,
			// Наши OAuth-провайдеры подтверждают профиль (Telegram OIDC, Discord)
			// — разрешаем линковку без дополнительной проверки emailVerified.
			trustedProviders: ['discord', 'telegram-oidc'],
			// Обновлять user.name/image/доп.поля при каждой линковке —
			// тогда поля avatar'ов провайдеров всегда актуальны.
			updateUserInfoOnLink: true
		}
	},
	databaseHooks: {
		// После каждого входа/линковки через OAuth-провайдера обновляем
		// user.image (аватар профиля) аватаром последней использованной
		// платформы. Провайдер определяется по URL запроса:
		// /api/auth/callback/{provider}.
		session: {
			create: {
				after: async (session, context) => {
					try {
						// context: GenericEndpointContext | null — request доступен
						// на самом context (EndpointContext better-call), а
						// internalAdapter — в context.context. Типы better-auth не
						// описывают request на AuthContext и доп.поля user, поэтому
						// сужаем через минимальный локальный интерфейс.
						const ctx = context as unknown as {
							request?: { url?: string };
							context?: {
								internalAdapter: {
									findUserById(u: string): Promise<Record<string, unknown> | null>;
									updateUser(
										u: string,
										d: Record<string, unknown>
									): Promise<Record<string, unknown>>;
								};
							};
						} | null;
						const url = ctx?.request?.url ?? '';
						if (!url.includes('/callback/')) return;
						const providerId = url.split('/callback/')[1]?.split('?')[0];
						if (!providerId || !ctx?.context) return;
						const { internalAdapter } = ctx.context;
						const user = await internalAdapter?.findUserById(session.userId);
						if (!user) return;
						const avatarField =
							providerId === 'discord'
								? 'discordAvatar'
								: providerId === 'telegram-oidc'
									? 'telegramAvatar'
									: null;
						const image = avatarField ? user[avatarField] : null;
						if (typeof image === 'string' && image.length > 0 && image !== user.image) {
							await internalAdapter.updateUser(session.userId, { image });
						}
					} catch (e) {
						log.warn('Не удалось синхронизировать аватар профиля:', e);
					}
				}
			}
		}
	},
	plugins: [
		telegram({
			// OIDC (Login Widget помечен Telegram как legacy — используем OAuth 2.0 + PKCE)
			loginWidget: false,
			botToken: env.TELEGRAM_BOT_TOKEN ?? '',
			oidc: {
				enabled: true,
				clientId: env.TELEGRAM_OIDC_CLIENT_ID,
				clientSecret: env.TELEGRAM_OIDC_CLIENT_SECRET,
				scopes: ['openid', 'profile'],
				// Сохраняем аватар/username Telegram в отдельные поля user.
				// Возвращаем также `id` — он спредится поверх `user.id = claims.sub`
				// в getUserInfo плагина и попадёт в account.accountId, а `email`
				// с настоящим telegram id — в user.email. Так в БД хранится
				// «1249750628», а не сырой sub «13227702110297273832».
				mapOIDCProfileToUser: (claims) => {
					const userId = telegramUserIdFromClaims(claims);
					return {
						telegramAvatar: claims.picture ?? null,
						telegramOidcUsername: claims.preferred_username ?? null,
						...(userId ? { id: userId, email: `${userId}@telegram.oidc` } : {})
					};
				}
			}
		}),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
