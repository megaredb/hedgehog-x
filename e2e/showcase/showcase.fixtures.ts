/**
 * Фикстуры для тестов главной-витрины (/).
 *
 * Расширяет глобальный `test` из ../fixtures/test (guest/loggedIn/catalog/audio)
 * фикстурой `showcasePage: ShowcasePage` — page-object витрины.
 *
 * Включается «перечислением в параметрах»:
 *
 *   test('...', async ({ showcasePage }) => { await showcasePage.goto(); ... })
 *
 * Состояние (гость/залогинен) задаётся фикстурами глобального test, а
 * data-driven кейсы приходят параметром из showcase.cases.ts.
 */

import { test as base, expect } from '../fixtures/test';
import { ShowcasePage } from './showcase.page';

type ShowcaseFixtures = {
	/** Page-object главной-витрины. */
	showcasePage: ShowcasePage;
};

export const test = base.extend<ShowcaseFixtures>({
	showcasePage: async ({ page }, use) => {
		await use(new ShowcasePage(page));
	}
});

export { expect };
export type { ShowcasePage };
