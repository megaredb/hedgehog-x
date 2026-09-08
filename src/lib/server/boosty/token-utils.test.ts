import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
	boostyEmail,
	buildSessionCookieValue,
	buildSessionCookieValueEncoded,
	sessionCookieName
} from './token-utils.ts';

test('boostyEmail: уникален и содержит @boosty.local', () => {
	const e1 = boostyEmail('12345');
	assert.ok(e1.endsWith('@boosty.local'));
	assert.equal(e1, boostyEmail('12345'));
	assert.notEqual(e1, boostyEmail('54321'));
});

test('buildSessionCookieValue: сырое token.sig (кодирует SvelteKit serialize)', () => {
	const secret = '05fe46a6-75fd-4861-9cd2-ad5f61f67f7c';
	const token = 'session-token-123';
	const value = buildSessionCookieValue(token, secret);
	// raw == token + '.' + base64(hmac)
	const sig = createHmac('sha256', secret).update(token).digest('base64');
	assert.equal(value, token + '.' + sig);
	assert.ok(value.startsWith('session-token-123.'));
});

test('buildSessionCookieValueEncoded: закодированная версия для прямых заголовков', () => {
	const secret = '05fe46a6-75fd-4861-9cd2-ad5f61f67f7c';
	const token = 'session-token-123';
	const sig = createHmac('sha256', secret).update(token).digest('base64');
	assert.equal(
		buildSessionCookieValueEncoded(token, secret),
		encodeURIComponent(token + '.' + sig)
	);
});

test('buildSessionCookieValue: зависит от secret', () => {
	const token = 'session-token-123';
	const v1 = buildSessionCookieValue(token, 'secret-1');
	const v2 = buildSessionCookieValue(token, 'secret-2');
	assert.notEqual(v1, v2);
});

test('sessionCookieName: в dev без префикса, в production с __Secure-', () => {
	// dev: лучше-auth использует обычное имя
	assert.equal(sessionCookieName(false), 'better-auth.session_token');
	// production: лучше-auth добавляет __Secure- (иначе getSession не найдёт)
	assert.equal(sessionCookieName(true), '__Secure-better-auth.session_token');
});
