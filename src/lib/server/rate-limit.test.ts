import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, resetRateLimits } from './rate-limit.ts';

test('checkRateLimit: пропускает запросы в пределах лимита', () => {
	resetRateLimits();
	const key = 'test:' + Math.random();
	assert.equal(checkRateLimit(key, 3, 60_000).ok, true);
	assert.equal(checkRateLimit(key, 3, 60_000).ok, true);
	assert.equal(checkRateLimit(key, 3, 60_000).ok, true);
});

test('checkRateLimit: блокирует после превышения лимита', () => {
	resetRateLimits();
	const key = 'test:' + Math.random();
	for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
	const res = checkRateLimit(key, 3, 60_000);
	assert.equal(res.ok, false);
	assert.ok(res.retryAfterSec >= 1);
});

test('checkRateLimit: разные ключи считаются независимо', () => {
	resetRateLimits();
	const a = 'test:a:' + Math.random();
	const b = 'test:b:' + Math.random();
	checkRateLimit(a, 1, 60_000);
	assert.equal(checkRateLimit(b, 1, 60_000).ok, true);
	assert.equal(checkRateLimit(a, 1, 60_000).ok, false);
});

test('checkRateLimit: окно сбрасывается после истечения', async () => {
	resetRateLimits();
	const key = 'test:' + Math.random();
	assert.equal(checkRateLimit(key, 1, 10).ok, true);
	assert.equal(checkRateLimit(key, 1, 10).ok, false);
	await new Promise((r) => setTimeout(r, 30));
	assert.equal(checkRateLimit(key, 1, 10).ok, true);
});
