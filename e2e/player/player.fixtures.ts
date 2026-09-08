/**
 * Фикстуры для тестов аудиоплеера.
 *
 * Расширяет глобальный `test` из ../fixtures/test (guest/loggedIn/catalog/audio)
 * фикстурами page-объектов: `volumePage` (страница тома /books/[bookId]/[volumeId]
 * из e2e/catalog/volume.page.ts — общий шаг «открыть том и получить очередь»
 * через клик по главе) и `playerBar` (закреплённый GlobalPlayer из
 * e2e/shared/player.page.ts — здесь сосредоточен повторный контроль плеера).
 *
 * Включаются «перечислением в параметрах»:
 *
 *   test('...', async ({ volumePage, playerBar }) => { ... })
 */
import { test as base, expect } from '../fixtures/test';
import { VolumePage } from '../catalog/volume.page';
import { PlayerBar } from '../shared/player.page';

type PlayerFixtures = {
	/** Page-object страницы тома (источник очереди глава → GlobalPlayer). */
	volumePage: VolumePage;
	/** Page-object закреплённого плеера GlobalPlayer. */
	playerBar: PlayerBar;
};

export const test = base.extend<PlayerFixtures>({
	volumePage: async ({ page }, use) => {
		await use(new VolumePage(page));
	},
	playerBar: async ({ page }, use) => {
		await use(new PlayerBar(page));
	}
});

export { expect };
