import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
	{ path: '/', name: 'главная' },
	{ path: '/books', name: 'каталог' },
	{ path: '/about', name: 'о сайте' },
	{ path: '/auth', name: 'авторизация' }
];

for (const item of pages) {
	test(`a11y: ${item.name} без serious/critical нарушений`, async ({ page }) => {
		await page.goto(item.path, { waitUntil: 'networkidle' });
		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();
		const blocking = results.violations.filter(
			(violation) => violation.impact === 'serious' || violation.impact === 'critical'
		);
		expect(
			blocking,
			blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`).join('\n')
		).toEqual([]);
	});
}
