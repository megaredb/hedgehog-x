import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';

// Playwright-процесс не читает .env автоматически (это делает Vite через
// $env/dynamic/private). Загружаем вручную, чтобы тест увидел DATABASE_URL
// и BETTER_AUTH_SECRET для генерации подписанной сессионной cookie.
loadEnv();

/**
 * Интеграционный тест реального эндпоинта POST /api/user/delete
 * (без моков): создаёт пользователя + аккаунт + сессию в БД напрямую,
 * генерирует валидную cookie better-auth и проверяет каскадное удаление.
 *
 * Требует доступной Postgres (DATABASE_URL из .env). Без неё — skip.
 */

// .env хранит значения в кавычках ("..."), а dotenv v16 их не срезает —
// в отличие от Vite ($env/dynamic/private), который срезает. Нормализуем.
function unquote(v: string | undefined): string | undefined {
	if (!v) return v;
	if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
		return v.slice(1, -1);
	}
	return v;
}

const rawDbUrl = process.env.DATABASE_URL;
const DATABASE_URL = unquote(rawDbUrl) ?? 'postgres://root:mysecretpassword@localhost:5432/local';
const secret = unquote(process.env.BETTER_AUTH_SECRET);

test.skip(!secret, 'BETTER_AUTH_SECRET не задан — пропускаем интеграционный тест');

/** Подпись cookie better-auth: encodeURIComponent(token + '.' + base64(HMAC-SHA256(secret, token))) */
function signedCookieValue(token: string, secret: string): string {
	const sig = createHmac('sha256', secret).update(token).digest('base64');
	return encodeURIComponent(token + '.' + sig);
}

test.describe('POST /api/user/delete (реальная БД)', () => {
	const email = 'e2e-delete-' + randomUUID() + '@test.local';
	const userId = 'u_' + randomBytes(8).toString('hex');
	const sessionToken = randomBytes(24).toString('base64url');
	let sql: postgres.Sql;

	test.beforeAll(async () => {
		sql = postgres(DATABASE_URL);
		const now = new Date();
		await sql`delete from "user" where email = ${email}`.catch(() => {});
		await sql`insert into "user" (id, name, email, email_verified, created_at, updated_at) values (${userId}, 'E2E Delete', ${email}, true, ${now}, ${now})`;
		await sql`insert into "account" (id, account_id, provider_id, user_id, created_at, updated_at) values (${'a_' + randomBytes(6).toString('hex')}, 'acc-e2e', 'telegram-oidc', ${userId}, ${now}, ${now})`;
		await sql`insert into "session" (id, token, expires_at, created_at, updated_at, user_id) values (${'s_' + randomBytes(6).toString('hex')}, ${sessionToken}, ${new Date(Date.now() + 3600_000)}, ${now}, ${now}, ${userId})`;
	});

	test.afterAll(async () => {
		await sql`delete from "user" where id = ${userId}`.catch(() => {});
		await sql.end();
	});

	test('удаляет пользователя и каскадно account/session', async ({ request }) => {
		const cookie = signedCookieValue(sessionToken, secret!);
		// В production-режиме (vite preview / наш e2e-runner) better-auth
		// использует префикс __Secure- для session cookie.
		const cookieName = '__Secure-better-auth.session_token';
		const res = await request.post('http://localhost:4173/api/user/delete', {
			headers: { cookie: cookieName + '=' + cookie }
		});
		expect(res.status()).toBe(200);
		expect(await res.json()).toEqual({ ok: true });

		const user = await sql`select id from "user" where id = ${userId}`;
		const acc = await sql`select id from account where user_id = ${userId}`;
		const ses = await sql`select id from session where user_id = ${userId}`;
		expect(user.length).toBe(0);
		expect(acc.length).toBe(0);
		expect(ses.length).toBe(0);
	});

	test('GET возвращает 405', async ({ request }) => {
		const res = await request.get('http://localhost:4173/api/user/delete');
		expect(res.status()).toBe(405);
	});
});

test.describe('POST /api/user/delete без сессии', () => {
	test('возвращает 401 Unauthorized без cookie', async ({ request }) => {
		const res = await request.post('http://localhost:4173/api/user/delete');
		expect(res.status()).toBe(401);
		const body = await res.json();
		expect(body.error).toBe('Unauthorized');
	});
});
