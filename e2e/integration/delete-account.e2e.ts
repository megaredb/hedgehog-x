import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { randomBytes, randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { unquote } from '../fixtures/utils';
import {
	buildSessionCookieValueEncoded,
	sessionCookieName
} from '../../src/lib/server/boosty/token-utils';

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

const DATABASE_URL =
	unquote(process.env.DATABASE_URL) ?? 'postgres://root:mysecretpassword@localhost:5432/local';
const secret = unquote(process.env.BETTER_AUTH_SECRET);

// Проверяем фактическую доступность Postgres (SELECT 1): если БД не поднята,
// тест честно пропускается, а не падает на первом запросе в beforeAll.
let postgresAvailable = false;
if (secret) {
	try {
		const probe = postgres(DATABASE_URL, { connect_timeout: 3, max: 1 });
		await probe`select 1`;
		await probe.end();
		postgresAvailable = true;
	} catch {
		postgresAvailable = false;
	}
}

test.skip(
	!postgresAvailable,
	'BETTER_AUTH_SECRET не задан или Postgres недоступна — пропускаем интеграционный тест'
);

test.describe('POST /api/user/delete (реальная БД)', () => {
	const email = 'e2e-delete-' + randomUUID() + '@test.local';
	const userId = 'u_' + randomBytes(8).toString('hex');
	const sessionToken = randomBytes(24).toString('base64url');
	let sql: postgres.Sql;

	test.beforeAll(async () => {
		sql = postgres(DATABASE_URL);
		// Сырой SQL дублирует Drizzle-схему better-auth (src/lib/server/db/auth.schema.ts),
		// чтобы не тянуть ORM в тест. Колонки соответствуют таблицам:
		//   user    (id, name, email, email_verified, created_at, updated_at);
		//   account (id, account_id, provider_id, user_id, created_at, updated_at);
		//   session (id, token, expires_at, created_at, updated_at, user_id).
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
		// Значение и имя cookie считаются так же, как лучше-auth в production
		// (см. src/lib/server/boosty/token-utils.ts): префикс __Secure-.
		const cookie = buildSessionCookieValueEncoded(sessionToken, secret!);
		const cookieName = sessionCookieName(true);
		const res = await request.post('/api/user/delete', {
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
		const res = await request.get('/api/user/delete');
		expect(res.status()).toBe(405);
	});
});

test.describe('POST /api/user/delete без сессии', () => {
	test('возвращает 401 Unauthorized без cookie', async ({ request }) => {
		const res = await request.post('/api/user/delete');
		expect(res.status()).toBe(401);
		const body = await res.json();
		expect(body.error).toBe('Unauthorized');
	});
});
