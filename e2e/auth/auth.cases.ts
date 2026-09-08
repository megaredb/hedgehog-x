/**
 * Data-driven кейсы для тестов страницы входа (/auth).
 *
 * Массивы — это ДАННЫЕ (значения + ожидания), а не логика. Тесты в auth.e2e.ts
 * прокручивают их циклом `for (const c of cases) test(...)` и подставляют данные
 * в тело (pytest-стиль параметризации).
 *
 * Базовый юзер для веток берётся из e2e/fixtures/data.ts (MOCK_USER «Еж Тестовый»).
 */

// ─── Аватар в карточке залогиненного на /auth (img vs инициал) ────────────────

export interface AuthAvatarCase {
	id: string;
	/** image у user (null → UserAvatar рисует инициал вместо <img>). */
	image: string | null;
	/** Ожидается ли <img> (data-slot avatar-image) в карточке. */
	expectImg: boolean;
	/** Ожидаемая первая буква имени-инициала, когда image нет. */
	initial?: string;
}

/** Относительный URL-заглушка аватара — локальный, без внешнего хоста. */
const AUTH_AVATAR = '/img/overlord.webp';

export const authAvatarCases: AuthAvatarCase[] = [
	{ id: 'img', image: AUTH_AVATAR, expectImg: true },
	// name = MOCK_USER.name «Еж Тестовый» → getInitial = «Е».
	{ id: 'icon-initial', image: null, expectImg: false, initial: 'Е' }
];

// ─── Санитизация параметра ?from (callbackURL в sign-in/social) ───────────────

export interface AuthFromCase {
	/** slug кейса (для имени теста). */
	id: string;
	/** Значение query-параметра ?from= на /auth. */
	from: string;
	/** Ожидаемый callbackURL в теле POST /api/auth/sign-in/social. */
	expectCallback: string;
}

/**
 * Ветки ?from (см. +page.svelte: разрешены только внутренние относительные пути,
 * начинающиеся с «/», но не с «//»; внешние и возврат на /auth → resolve('/')):
 *  - внутренний путь `/downloads` пробрасывается в callbackURL как есть;
 *  - внешний URL https://evil.example санитизируется в resolve('/') = '/',
 *    т.е. callbackURL не может указывать наружу.
 */
export const authFromCases: AuthFromCase[] = [
	{ id: 'internal-path', from: '/downloads', expectCallback: '/downloads' },
	{ id: 'external-url', from: 'https://evil.example', expectCallback: '/' }
];
