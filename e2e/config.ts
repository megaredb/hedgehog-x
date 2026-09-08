/**
 * Базовый адрес e2e-сервера. По умолчанию — http://localhost:4173: именно его
 * поднимает webServer из playwright.config.ts (npm run build && npm run preview).
 * Прогон на другом хосте/порту — через переменную окружения E2E_BASE_URL.
 */
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
