/**
 * Page Object «каркас приложения» (Shell) — то, что рендерится на КАЖДОЙ странице
 * в src/routes/+layout.svelte:
 *  - AppNavigation (десктопный сайдбар <aside> + мобильный хедер с Sheet);
 *  - ProfileDropdown (гость → «Войти», залогинен → DropdownMenu с «Выйти»);
 *  - ThemeSwitchButton («Переключить тему» → класс .dark на <html>);
 *  - AppBreadcrumbs (nav[aria-label=breadcrumb]) — на вложенных страницах.
 *
 * Селекторы — по ролям / текстам / data-slot, БЕЗ CSS-классов (сверено с реальными
 * компонентами: header/AppNavigation.svelte, ProfileDropdown.svelte,
 * ThemeSwitchButton.svelte, layout/AppBreadcrumbs.svelte). Содержит только
 * селекторы и действия (как ProfilePage), ассерты остаются в тестах.
 */

import type { Locator, Page } from '@playwright/test';
import { openPage } from '../fixtures/utils';
import { ROUTE_TITLES } from '../../src/lib/route-titles';

/** Пункты меню навигации (обе группы: Библиотека + Информация). */
export const NAV_ITEMS = [
	'Каталог',
	'Закладки',
	'История',
	'Загрузки',
	'Сообщество',
	'Поддержать',
	'О сайте'
] as const;

export class Shell {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// ─── Навигация ──────────────────────────────────────────────────────────────

	/** Перейти на страницу и погасить CSS-анимации (см. openPage). */
	async goto(path = '/'): Promise<void> {
		await openPage(this.page, path);
	}

	/** Заголовок документа — формат "{segment} — HEDGEHOG.INC". */
	title(segment: string): Locator {
		return this.page.locator('title', { hasText: `${segment} — HEDGEHOG.INC` });
	}

	// ─── Десктопный сайдбар (AppNavigation <aside>) ─────────────────────────────

	/** Десктопный сайдбар (виден при >=1024px). */
	get sidebar(): Locator {
		return this.page.locator('aside');
	}

	/** Логотип HEDGEHOG.INC в сайдбаре. */
	get logo(): Locator {
		return this.sidebar.getByText('HEDGEHOG.INC');
	}

	/** Пункт меню в сайдбаре по подписи. */
	navItem(name: string): Locator {
		return this.sidebar.getByRole('link', { name });
	}

	/** Гость: ссылка «Войти» в сайдбаре (ProfileDropdown → /auth?from=…). */
	get signInLink(): Locator {
		return this.sidebar.getByRole('link', { name: 'Войти' });
	}

	/** Залогинен: триггер дропдауна профиля в сайдбаре (кнопка с именем юзера). */
	profileTrigger(userName: string): Locator {
		return this.sidebar.getByRole('button', { name: new RegExp(escapeRegExp(userName)) });
	}

	/** Открыть дропдаун профиля; возвращает его Locator (role=menu). */
	async openProfileMenu(userName: string): Promise<Locator> {
		await this.profileTrigger(userName).click();
		return this.page.getByRole('menu');
	}

	/** Пункт меню профиля (DropdownMenu) по подписи. */
	profileMenuItem(name: string): Locator {
		return this.page.getByRole('menuitem', { name });
	}

	/**
	 * Выйти из аккаунта: открывает дропдаун (если закрыт) и жмёт «Выйти»,
	 * что редиректит на главную (signOutAndRedirect в ProfileDropdown).
	 */
	async signOut(userName: string): Promise<void> {
		const menu = this.page.getByRole('menu');
		if (!(await menu.count())) {
			await this.openProfileMenu(userName);
		}
		await this.profileMenuItem('Выйти').click();
	}

	// ─── Мобильный хедер / Sheet ────────────────────────────────────────────────

	/** Кнопка-бургер (aria-label «Toggle Menu») — только на мобильном (<1024px). */
	get mobileBurger(): Locator {
		return this.page.getByRole('button', { name: 'Toggle Menu' });
	}

	/** Активный Sheet-диалог с навигацией (bits-ui Sheet → role=dialog). */
	get mobileSheet(): Locator {
		return this.page.getByRole('dialog');
	}

	/** Открыть мобильное меню (бургер → Sheet) и вернуть диалог. */
	async openMobileMenu(): Promise<Locator> {
		await this.mobileBurger.click();
		return this.mobileSheet;
	}

	// ─── Тема (ThemeSwitchButton) ───────────────────────────────────────────────

	/** Кнопка «Переключить тему». */
	get themeToggle(): Locator {
		return this.page.getByRole('button', { name: 'Переключить тему' });
	}

	/** Переключить тему (клик по кнопке). */
	async toggleTheme(): Promise<void> {
		await this.themeToggle.click();
	}

	/** Корневой элемент <html> (для проверки класса .dark). */
	get html(): Locator {
		return this.page.locator('html');
	}

	/** Включена ли тёмная тема (класс .dark на <html>). */
	async isDark(): Promise<boolean> {
		return await this.page.evaluate(() => document.documentElement.classList.contains('dark'));
	}

	// ─── Хлебные крошки (AppBreadcrumbs) ────────────────────────────────────────

	/** Контейнер хлебных крошек (nav[aria-label=breadcrumb]). */
	get breadcrumb(): Locator {
		return this.page.getByRole('navigation', { name: 'breadcrumb' });
	}

	/** Корневая крошка «Главная» (Breadcrumb.Link href="/"). */
	get breadcrumbRoot(): Locator {
		return this.breadcrumb.getByRole('link', { name: ROUTE_TITLES[''] });
	}

	/**
	 * Крошка по тексту (последняя крошка-страница — Breadcrumb.Page с role=link
	 * и aria-current=page; статичные ссылки — Breadcrumb.Link).
	 */
	breadcrumbCrumb(name: string): Locator {
		return this.breadcrumb.getByRole('link', { name });
	}

	/**
	 * Последняя крошка (текущая страница): ровно один элемент role=link с
	 * aria-current=page внутри контейнера крошек.
	 */
	get breadcrumbLast(): Locator {
		return this.breadcrumb.locator('[aria-current="page"]');
	}
}

/** Экранирует спецсимволы RegExp в строке (для getByRole по имени). */
function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
