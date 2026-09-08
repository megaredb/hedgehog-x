/**
 * Общие мок-данные для e2e-тестов.
 *
 * Формы сверены с реальными ответами API:
 *  - сессия/аккаунты — better-auth (src/lib/server/auth.ts, schema auth.schema.ts);
 *  - каталог — GET /api/books и GET /api/books/:bookId (src/routes/api/books/*),
 *    поля — это camelCase-колонки drizzle-таблиц (src/lib/server/db/schema.ts),
 *    которые JSON.stringify превращает в строки (даты → ISO).
 *
 * Значения дат фиксируются один раз при импорте модуля — внутри одного прогона
 * они согласованы (updatedAt >= createdAt, expiresAt в будущем).
 */

const now = Date.now();

/** ISO-строка «now - N секунд» (для согласованных createdAt/updatedAt). */
function isoSecondsAgo(secondsAgo: number): string {
	return new Date(now - secondsAgo * 1000).toISOString();
}

/** ISO-строка «now + N секунд» (expiresAt сессии). */
function isoSecondsAhead(secondsAhead: number): string {
	return new Date(now + secondsAhead * 1000).toISOString();
}

// ─── Сессия better-auth ────────────────────────────────────────────────────────

/** Пользователь в ответе get-session (доп. поля провайдеров — по желанию). */
export interface MockUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
	createdAt: string;
	updatedAt: string;
	/** telegramAvatar / telegramOidcUsername / discordAvatar / discordUsername / boostyAvatar / boostyName… */
	[key: string]: unknown;
}

/** Сессия в ответе get-session. */
export interface MockSession {
	id: string;
	userId: string;
	token: string;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
}

/** Тело GET /api/auth/get-session. */
export type SessionPayload = { user: MockUser | null; session: MockSession | null } | null;

export const MOCK_USER: MockUser = {
	id: 'user-123',
	name: 'Еж Тестовый',
	email: '123456@telegram.oidc',
	image: null,
	emailVerified: false,
	createdAt: isoSecondsAgo(3600 * 24 * 30),
	updatedAt: isoSecondsAgo(3600 * 24)
};

export const MOCK_SESSION: MockSession = {
	id: 'session-1',
	userId: MOCK_USER.id,
	token: 'mock-token',
	expiresAt: isoSecondsAhead(3600),
	createdAt: isoSecondsAgo(3600 * 24),
	updatedAt: isoSecondsAgo(3600)
};

// ─── Привязанные аккаунты (GET /api/auth/list-accounts) ──────────────────────

/** Запись списка способов входа (account лучше-auth). accountId — внешний id провайдера. */
export interface MockLinkedAccount {
	id: string;
	providerId: string;
	accountId: string;
	userId: string;
	createdAt: string;
	updatedAt: string;
	scopes?: string[] | null;
}

const accountTimes = {
	createdAt: isoSecondsAgo(3600 * 24 * 20),
	updatedAt: isoSecondsAgo(3600 * 24)
};

/** Telegram-аккаунт (providerId 'telegram-oidc'), внешний id — числовой telegram id. */
export const TELEGRAM_ACCOUNT: MockLinkedAccount = {
	id: 'acc-tg-1',
	providerId: 'telegram-oidc',
	accountId: '123456789',
	userId: MOCK_USER.id,
	scopes: ['openid', 'profile'],
	...accountTimes
};

/** Discord-аккаунт (OAuth2). */
export const DISCORD_ACCOUNT: MockLinkedAccount = {
	id: 'acc-dc-1',
	providerId: 'discord',
	accountId: '987654321',
	userId: MOCK_USER.id,
	scopes: ['identify', 'email'],
	...accountTimes
};

/** Boosty-аккаунт (вход по телефону + SMS). */
export const BOOSTY_ACCOUNT: MockLinkedAccount = {
	id: 'acc-boosty-1',
	providerId: 'boosty',
	accountId: 'boosty:user-123',
	userId: MOCK_USER.id,
	...accountTimes
};

// ─── Коды стран Boosty (GET /api/boosty/phone-codes) ──────────────────────────

/** Страна/код телефона, как отдаёт /api/boosty/phone-codes. */
export interface MockPhoneCode {
	name: string;
	dialCode: string;
	code: string;
	mask?: string;
}

export const PHONE_CODES: MockPhoneCode[] = [
	{ name: 'Russia', dialCode: '+7', code: 'RU', mask: '(XXX) XXX-XX-XX' },
	{ name: 'Kazakhstan', dialCode: '+7', code: 'KZ' },
	{ name: 'Ukraine', dialCode: '+380', code: 'UA' }
];

// ─── Каталог (GET /api/books, GET /api/books/:bookId) ─────────────────────────

/**
 * Книга в списке GET /api/books (без связей) — camelCase-колонки таблицы books.
 */
export interface MockBook {
	id: string;
	title: string;
	description: string | null;
	coverUrl: string | null;
	blurhash: string | null;
	themeColor: string | null;
	status: string;
	createdAt: string;
	updatedAt: string;
}

/** Глава (GET /api/books/:bookId → volumes[].chapters). */
export interface MockChapter {
	id: string;
	volumeId: string;
	chapterNumber: number;
	title: string;
	audioUrl: string;
	durationSeconds: number;
	telegramPostUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

/** Иллюстрация тома (GET /api/books/:bookId → volumes[].illustrations). */
export interface MockIllustration {
	id: string;
	volumeId: string;
	imageUrl: string;
	blurhash: string | null;
	caption: string | null;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

/** Том книги (GET /api/books/:bookId → volumes[]). */
export interface MockVolume {
	id: string;
	bookId: string;
	volumeNumber: number;
	title: string;
	description: string | null;
	coverUrl: string | null;
	blurhash: string | null;
	createdAt: string;
	updatedAt: string;
	chapters: MockChapter[];
	illustrations: MockIllustration[];
}

/** Полное дерево книги, как его отдаёт GET /api/books/:bookId. */
export interface MockBookDetail extends MockBook {
	volumes: MockVolume[];
}

function chapter(
	id: string,
	volumeId: string,
	chapterNumber: number,
	title: string,
	audioUrl: string,
	durationSeconds: number
): MockChapter {
	return {
		id,
		volumeId,
		chapterNumber,
		title,
		audioUrl,
		durationSeconds,
		telegramPostUrl: `https://t.me/hedgehog_inc/${chapterNumber}`,
		createdAt: isoSecondsAgo(3600 * 24 * 15 - chapterNumber),
		updatedAt: isoSecondsAgo(3600 * 12 - chapterNumber)
	};
}

/** Каталог из одной книги с двумя томами и главами (для мока /api/books/**). */
export const MOCK_CATALOG: MockBookDetail = {
	id: 'book-1',
	title: 'Лесные истории',
	description: 'Сборник уютных историй о жизни лесных зверей и птиц.',
	coverUrl: '/img/mushoku_tensei.webp',
	blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
	themeColor: '1e3a2f',
	status: 'ongoing',
	createdAt: isoSecondsAgo(3600 * 24 * 30),
	updatedAt: isoSecondsAgo(3600 * 24),
	volumes: [
		{
			id: 'book-1-vol-1',
			bookId: 'book-1',
			volumeNumber: 1,
			title: 'Еж и первые снежинки',
			description: 'Том о том, как ежик готовится к зиме.',
			coverUrl: '/img/overlord.webp',
			blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
			createdAt: isoSecondsAgo(3600 * 24 * 25),
			updatedAt: isoSecondsAgo(3600 * 24),
			chapters: [
				chapter(
					'book-1-ch-1',
					'book-1-vol-1',
					1,
					'Встреча у ручья',
					'/audio/book-1/vol-1/ch-1.mp3',
					354
				),
				chapter('book-1-ch-2', 'book-1-vol-1', 2, 'Листопад', '/audio/book-1/vol-1/ch-2.mp3', 421),
				chapter(
					'book-1-ch-3',
					'book-1-vol-1',
					3,
					'Первый снег',
					'/audio/book-1/vol-1/ch-3.mp3',
					388
				)
			],
			illustrations: [
				{
					id: 'book-1-ill-1',
					volumeId: 'book-1-vol-1',
					imageUrl: '/illustrations/book-1-vol-1-1.webp',
					blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
					caption: 'Еж у ручья',
					sortOrder: 0,
					createdAt: isoSecondsAgo(3600 * 24 * 20),
					updatedAt: isoSecondsAgo(3600 * 24 * 20)
				}
			]
		},
		{
			id: 'book-1-vol-2',
			bookId: 'book-1',
			volumeNumber: 2,
			title: 'Барсук-строитель',
			description: 'Том о том, как барсук строил дом и завёл соседей.',
			coverUrl: '/img/mushoku_tensei.webp',
			blurhash: null,
			createdAt: isoSecondsAgo(3600 * 24 * 10),
			updatedAt: isoSecondsAgo(3600 * 12),
			chapters: [
				chapter(
					'book-1-ch-4',
					'book-1-vol-2',
					1,
					'Кирпичи из глины',
					'/audio/book-1/vol-2/ch-1.mp3',
					512
				)
			],
			illustrations: []
		}
	]
};
