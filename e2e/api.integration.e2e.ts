import { test, expect } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { randomUUID } from 'node:crypto';

loadEnv();

/**
 * Интеграционные тесты реальных API-эндпоинтов против preview-сервера
 * (адрес — BASE_URL из e2e/config.ts: по умолчанию порт 4173, который
 * поднимает webServer в playwright.config.ts). Без моков: проверяются
 * фактические статусы и формы ответов.
 *
 * Внешние сервисы не вызываются:
 *  - send-code/confirm-code тестируются только валидацией некорректного тела
 *    (ошибки приходят ДО обращения к Boosty / реальной отправки SMS);
 *  - GET /api/boosty/phone-codes ходит в boosty.to напрямую — вне e2e.
 * Удаление аккаунта (POST /api/user/delete) уже покрыто
 * в delete-account.integration.e2e.ts — здесь не дублируется.
 *
 * Требует .env (DATABASE_URL/BETTER_AUTH_SECRET) и доступной Postgres — иначе skip.
 */

// .env хранит значения в кавычках ("..."), а dotenv v16 их не срезает —
// в отличие от Vite ($env/dynamic/private). Нормализуем для проверки.
function unquote(v: string | undefined): string | undefined {
	if (!v) return v;
	if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
		return v.slice(1, -1);
	}
	return v;
}

const hasEnv =
	Boolean(unquote(process.env.DATABASE_URL)) && Boolean(unquote(process.env.BETTER_AUTH_SECRET));

test.skip(!hasEnv, 'Нет DATABASE_URL/BETTER_AUTH_SECRET — пропускаем интеграционные тесты');

test.describe('GET /api/books (реальный сервер)', () => {
	test('возвращает 200 и JSON-массив книг (может быть пустым)', async ({ request }) => {
		const res = await request.get(`/api/books`);
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type'] ?? '').toContain('application/json');

		const body = await res.json();
		expect(Array.isArray(body)).toBe(true);
	});
});

test.describe('GET /api/books/:bookId (несуществующий id)', () => {
	test('возвращает 404 Not found: сервер не знает такой книги', async ({ request }) => {
		const missingId = 'book-missing-' + randomUUID();
		const res = await request.get(`/api/books/${missingId}`);

		// Фактическое поведение: findFirst не нашёл книгу → 404 с текстом 'Not found'
		// (вложенные тома/главы для неизвестного id не отдаются).
		expect(res.status()).toBe(404);
		expect(await res.text()).toBe('Not found');
	});
});

test.describe('/api/user/sync без сессии', () => {
	test('GET публичен для гостя: 200 с пустыми массивами', async ({ request }) => {
		const res = await request.get(`/api/user/sync`);
		expect(res.status()).toBe(200);

		const body = await res.json();
		// Фактическое поведение: без сессии эндпоинт не падает с 401/403,
		// а отдаёт пустые массивы (см. +server.ts: if (!user) return json({...[]})).
		expect(body).toEqual({
			chapterLikes: [],
			volumeLikes: [],
			listeningProgress: [],
			bookmarks: []
		});
	});

	test('POST возвращает 405: эндпоинт экспортирует только GET', async ({ request }) => {
		const res = await request.post(`/api/user/sync`, { data: {} });
		// Фактическое поведение: у +server.ts нет POST-обработчика,
		// SvelteKit отвечает 405 Method Not Allowed.
		expect(res.status()).toBe(405);
	});
});

test.describe('/api/boosty без сессии', () => {
	test('GET /api/boosty/subscription → 401 Unauthorized', async ({ request }) => {
		const res = await request.get(`/api/boosty/subscription`);
		expect(res.status()).toBe(401);
		expect(await res.json()).toEqual({ error: 'Unauthorized' });
	});

	test('POST /api/boosty/send-code с невалидным JSON → 400', async ({ request }) => {
		// Тело передаём «сырой» строкой БЕЗ Content-Type: application/json —
		// иначе Playwright сам JSON-сериализует строку в валидный JSON-литерал.
		const res = await request.post(`/api/boosty/send-code`, {
			data: '{broken'
		});
		expect(res.status()).toBe(400);
		expect((await res.json()).error).toBe('Invalid JSON body');
	});

	test('POST /api/boosty/send-code без телефона → 400 (SMS не отправляется)', async ({
		request
	}) => {
		const res = await request.post(`/api/boosty/send-code`, { data: {} });
		expect(res.status()).toBe(400);
		// Валидация номера происходит до checkRateLimitGroup и sendPhoneCode
		expect((await res.json()).error).toBe('Введите корректный номер телефона');
	});

	test('POST /api/boosty/send-code с некорректным телефоном → 400', async ({ request }) => {
		const res = await request.post(`/api/boosty/send-code`, {
			data: { phone: 'not-a-phone' }
		});
		expect(res.status()).toBe(400);
		expect((await res.json()).error).toBe('Введите корректный номер телефона');
	});

	test('POST /api/boosty/confirm-code с невалидным JSON → 400', async ({ request }) => {
		// См. send-code: сырое тело без Content-Type: application/json.
		const res = await request.post(`/api/boosty/confirm-code`, {
			data: '{broken'
		});
		expect(res.status()).toBe(400);
		expect((await res.json()).error).toBe('Invalid JSON body');
	});

	test('POST /api/boosty/confirm-code без обязательных полей → 400', async ({ request }) => {
		const res = await request.post(`/api/boosty/confirm-code`, { data: {} });
		expect(res.status()).toBe(400);
		expect((await res.json()).error).toBe('deviceId, verifyToken, smsCode и phone обязательны');
	});
});
