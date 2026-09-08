/**
 * Фикстуры для тестов профиля.
 *
 * Расширяет глобальный `test` из ../fixtures/test (guest/loggedIn/catalog/audio)
 * фикстурой `profilePage: ProfilePage` — page-object страницы /profile.
 *
 * Включается «перечислением в параметрах»:
 *
 *   test('...', async ({ profilePage }) => { await profilePage.goto(); ... })
 *
 * Состояние (сессия/аккаунты/подписка) по-прежнему задаётся фикстурами глобального
 * test (`guest`/`loggedIn`) и моками из e2e/fixtures/mocks.ts, а data-driven кейсы
 * приходят параметром из profile.cases.ts (pytest-стиль: данные, не логика).
 */

import { test as base, expect } from '../fixtures/test';
import { ProfilePage } from './profile.page';

type ProfileFixtures = {
	/** Page-object страницы профиля. */
	profilePage: ProfilePage;
};

export const test = base.extend<ProfileFixtures>({
	profilePage: async ({ page }, use) => {
		await use(new ProfilePage(page));
	}
});

export { expect };

// Переэкспорт типов данных профиля для удобства тестов.
export type { ProfilePage };
