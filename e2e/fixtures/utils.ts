/**
 * Общие e2e-хелперы: глушение CSS-анимаций, переход на страницу,
 * нормализация значений из .env и список статических маршрутов.
 *
 * Модуль изотропный: импортирует только типы Playwright, поэтому безопасен
 * для импорта из любого теста (как с фикстурами, так и из интеграционных
 * тестов, работающих напрямую с `@playwright/test`).
 */

import type { Page } from '@playwright/test';

/**
 * CSS-инъекция, отключающая бесконечные анимации/переходы и плавный скролл.
 * Применяется ПОСЛЕ `goto` через `page.addStyleTag` (с `addInitScript` DOM ещё
 * нет, а до навигации инъекция потеряется). Бесконечная анимация (например
 * `animate-bounce` индикаторов витрины) иначе держит счётчик кадров, из-за чего
 * Playwright может не дождаться стабильного состояния.
 */
export const KILL_ANIMATIONS =
	'*,*::before,*::after{animation:none !important;transition:none !important;scroll-behavior:auto !important}';

/** Переход на страницу + отключение CSS-анимаций/переходов ПОСЛЕ загрузки. */
export async function openPage(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await page.addStyleTag({ content: KILL_ANIMATIONS });
}

/**
 * Срезает кавычки ("..." / '...') у значения из .env: dotenv v16 их не срезает,
 * а Vite (`$env/dynamic/private`) — срезает. Нормализация нужна, чтобы проверка
 * наличия DATABASE_URL/BETTER_AUTH_SECRET не давала ложноположительный «пустой»
 * результат для значения `""`.
 */
export function unquote(v: string | undefined): string | undefined {
	if (!v) return v;
	if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
		return v.slice(1, -1);
	}
	return v;
}

/** Страницы-заглушки (h1 через PageHeader), доступные гостю. */
export const STUB_PAGES = [
	'/bookmarks',
	'/community',
	'/history',
	'/settings',
	'/support'
] as const;

/**
 * Все статические маршруты, доступные гостю, для проверки согласованности
 * h1 и хлебных крошек с `ROUTE_TITLES` (см. e2e/titles/titles.e2e.ts).
 */
export const GUEST_STATIC_PAGES = [...STUB_PAGES, '/downloads', '/about', '/auth'] as const;
