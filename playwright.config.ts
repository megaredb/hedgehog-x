import { defineConfig } from '@playwright/test';
import { BASE_URL } from './e2e/config';

export default defineConfig({
	use: {
		// Относительные goto/request/toHaveURL резолвятся относительно BASE_URL.
		baseURL: BASE_URL
	},
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		port: 4173,
		// Запас на полный build + старт preview (build ~20-40с).
		timeout: 120_000,
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}',
	reporter: process.env.CI ? 'github' : 'list',
	retries: process.env.CI ? 2 : 0,
	expect: {
		timeout: 10_000
	}
});
