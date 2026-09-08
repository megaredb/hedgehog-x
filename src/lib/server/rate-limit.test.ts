import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, checkRateLimitGroup, resetRateLimits } from './rate-limit.ts';

/**
 * Rate limiter читает Date.now() на каждом вызове, поэтому тесты мокают время:
 * это делает их быстрыми и детерминированными (без реальных setTimeout/ожиданий).
 */
const T0 = 1_700_000_000_000;
let now = T0;

test.beforeEach(() => {
	now = T0;
	resetRateLimits();
	mock.method(Date, 'now', () => now);
});

test.afterEach(() => {
	mock.restoreAll();
});

test('checkRateLimit: пропускает запросы в пределах лимита', () => {
	const key = 'test:within';
	assert.equal(checkRateLimit(key, 3, 60_000).ok, true);
	assert.equal(checkRateLimit(key, 3, 60_000).ok, true);
	assert.equal(checkRateLimit(key, 3, 60_000).ok, true);
});

test('checkRateLimit: блокирует после превышения лимита', () => {
	const key = 'test:blocked';
	for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
	const res = checkRateLimit(key, 3, 60_000);
	assert.equal(res.ok, false);
	assert.ok(res.retryAfterSec >= 1);
});

test('checkRateLimit: разные ключи считаются независимо', () => {
	const a = 'test:a';
	const b = 'test:b';
	checkRateLimit(a, 1, 60_000);
	assert.equal(checkRateLimit(b, 1, 60_000).ok, true);
	assert.equal(checkRateLimit(a, 1, 60_000).ok, false);
});

test('checkRateLimit: окно сбрасывается после истечения', () => {
	const key = 'test:window';
	assert.equal(checkRateLimit(key, 1, 1000).ok, true);
	assert.equal(checkRateLimit(key, 1, 1000).ok, false);
	now = T0 + 1000; // окно истекло
	assert.equal(checkRateLimit(key, 1, 1000).ok, true);
});

// ─── checkRateLimitGroup ────────────────────────────────────────────────────────

test('checkRateLimitGroup: phone-лимит срабатывает раньше IP, и IP при этом не начисляется', () => {
	// confirm-code: phoneLimit=5, ipLimit=20 (см. rate-limit.ts).
	const ip = '203.0.113.1';
	for (let i = 0; i < 5; i++) {
		assert.equal(checkRateLimitGroup('confirm-code', 'phone-A', ip).ok, true);
	}
	// phone-A исчерпан: 6-я попытка падает на phone-лимите, ip НЕ начисляется.
	assert.equal(checkRateLimitGroup('confirm-code', 'phone-A', ip).ok, false);

	// ip получил только 5 начислений (не 6), поэтому с других номеров можно
	// сделать ещё ровно 15 успешных попыток до исчерпания ipLimit=20.
	for (let i = 0; i < 15; i++) {
		assert.equal(checkRateLimitGroup('confirm-code', `phone-B-${i}`, ip).ok, true);
	}
	// 21-е начисление ip (5 от A + 15 от B = 20) → исчерпание ip-лимита.
	assert.equal(checkRateLimitGroup('confirm-code', 'phone-C', ip).ok, false);
});

test('checkRateLimitGroup: разные номера считаются независимо', () => {
	// send-code: phoneLimit=3. phone-A исчерпывает свой лимит, phone-B — нет.
	for (let i = 0; i < 3; i++) {
		assert.equal(checkRateLimitGroup('send-code', 'phone-A', '1.1.1.1').ok, true);
	}
	assert.equal(checkRateLimitGroup('send-code', 'phone-A', '1.1.1.1').ok, false);
	assert.equal(checkRateLimitGroup('send-code', 'phone-B', '1.1.1.1').ok, true);
});

// ─── pruneIfNeeded / MAX_BUCKETS (вытеснение) ──────────────────────────────────

test('pruneIfNeeded: вытесняет истёкшие бакеты при превышении MAX_BUCKETS, активные переживают', () => {
	// Один «долгоживущий» ключ, который не должен быть вытеснен.
	const activeKey = 'active';
	assert.equal(checkRateLimit(activeKey, 2, 100_000).ok, true); // count=1, resetAt=T0+100000

	// Заполняем до MAX_BUCKETS+1 короткоживущими ключами (окно 1 мс).
	for (let i = 0; i < 10_000; i++) {
		checkRateLimit(`bulk:${i}`, 1, 1); // resetAt = T0+1
	}

	// Сдвигаем время: bulk-ключи истекли, active ещё жив.
	now = T0 + 2;

	// Следующий вызов запускает pruneIfNeeded (size > MAX_BUCKETS) и удаляет
	// истёкшие bulk-бакеты; active переживает вытеснение.
	assert.equal(checkRateLimit('new-key', 1, 1).ok, true);

	// active сохранил счётчик (1) и не был сброшен вытеснением.
	assert.equal(checkRateLimit(activeKey, 2, 100_000).ok, true); // 1 < 2 → count=2
	assert.equal(checkRateLimit(activeKey, 2, 100_000).ok, false); // count=2 >= 2 → fail
});
