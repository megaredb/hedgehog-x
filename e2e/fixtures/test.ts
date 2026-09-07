/**
 * Базовый test с фикстурами состояния приложения для e2e.
 *
 * Фикстуры включаются «перечислением в параметрах» теста/хука (Playwright
 * выполняет их лениво — только если тест их запросил), обычно через
 * beforeEach на уровне describe:
 *
 *   test.beforeEach(async ({ loggedIn }) => {
 *     // фикстура включена: get-session → MOCK_USER + MOCK_SESSION
 *   })
 *
 * Замечание про порядок: фикстура регистрирует page.route до тела теста, а
 * внутри теста можно зарегистрировать новый route «поверх» (побеждает
 * последний) — так переопределяется, например, get-session под кастомного юзера.
 */

import { test as base, expect } from '@playwright/test';
import { MOCK_SESSION, MOCK_USER } from './data';
import { mockAudio, mockCatalog, mockGetSession } from './mocks';

type Fixtures = {
	/** Гость: GET /api/auth/get-session → null. */
	guest: void;
	/** Залогинен: GET /api/auth/get-session → MOCK_USER + MOCK_SESSION. */
	loggedIn: void;
	/** Каталог: мок /api/books/** на MOCK_CATALOG + гость (get-session → null). */
	catalog: void;
	/** Аудио: мок HTMLMediaElement play/pause/seek (нет реального звука). */
	audio: void;
};

export const test = base.extend<Fixtures>({
	guest: async ({ page }, use) => {
		await mockGetSession(page, null);
		await use();
	},
	loggedIn: async ({ page }, use) => {
		await mockGetSession(page, { user: MOCK_USER, session: MOCK_SESSION });
		await use();
	},
	catalog: async ({ page }, use) => {
		await mockGetSession(page, null);
		await mockCatalog(page);
		await use();
	},
	audio: async ({ page }, use) => {
		await mockAudio(page);
		await use();
	}
});

export { expect };
