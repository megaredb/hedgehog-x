/**
 * Единый источник русских названий разделов приложения.
 *
 * Именно отсюда берут текст и хлебные крошки (`AppBreadcrumbs`), и заголовки
 * статических страниц (`PageHeader`) — чтобы названия в двух местах не
 * расходились. Динамические сущности (книга/том) сюда не входят: их названия
 * приходят из данных (Dexie) и остаются на усмотрение страницы.
 *
 * Модуль изотропный: не импортирует svelte/browser и безопасен для импорта
 * на клиенте, при SSR и в service worker.
 */

// ─── Сегмент URL → русский заголовок раздела ─────────────────────────────────
export const ROUTE_TITLES: Record<string, string> = {
	'': 'Главная',
	books: 'Книги',
	bookmarks: 'Закладки',
	community: 'Сообщество',
	downloads: 'Загрузки',
	history: 'История',
	settings: 'Настройки',
	support: 'Поддержать',
	about: 'О сайте',
	auth: 'Вход в аккаунт',
	profile: 'Мой аккаунт'
};

/**
 * Русский заголовок одного сегмента пути либо `undefined`, если для сегмента
 * нет записи в `ROUTE_TITLES` (например, динамический id книги/тома). Никакого
 * фолбэка-капитализации — неизвестный сегмент остаётся без заголовка.
 */
export function segmentTitle(segment: string): string | undefined {
	return ROUTE_TITLES[segment];
}

/**
 * Заголовок маршрута по полному pathname: возвращает заголовок последнего
 * (самого глубокого) известного статического сегмента пути. Для главной (`/`,
 * пустой путь) — «Главная». `undefined`, если ни один сегмент не известен
 * (полностью динамический маршрут без статических частей).
 */
export function routeTitle(pathname: string): string | undefined {
	const segments = pathname.split('/').filter(Boolean);
	for (let i = segments.length - 1; i >= 0; i--) {
		const title = ROUTE_TITLES[segments[i]];
		if (title !== undefined) return title;
	}
	return ROUTE_TITLES[''];
}
