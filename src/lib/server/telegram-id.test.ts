import assert from 'node:assert/strict';
import test from 'node:test';
import { telegramUserIdFromClaims } from './telegram-id';

test('extracts Telegram id from a numeric string claim', () => {
	assert.equal(telegramUserIdFromClaims({ id: '1249750628' }), '1249750628');
});

test('extracts Telegram id from a number claim', () => {
	assert.equal(telegramUserIdFromClaims({ id: 1249750628 }), '1249750628');
});

test('trims a numeric string claim', () => {
	assert.equal(telegramUserIdFromClaims({ id: ' 1249750628 ' }), '1249750628');
});

test('rejects missing, zero, negative, fractional and non-numeric ids', () => {
	assert.equal(telegramUserIdFromClaims({}), null);
	assert.equal(telegramUserIdFromClaims({ id: null }), null);
	assert.equal(telegramUserIdFromClaims({ id: '' }), null);
	assert.equal(telegramUserIdFromClaims({ id: '0' }), null);
	assert.equal(telegramUserIdFromClaims({ id: -1 }), null);
	assert.equal(telegramUserIdFromClaims({ id: 1.5 }), null);
	assert.equal(telegramUserIdFromClaims({ id: '13227702110297273832abc' }), null);
});

test('does not use the opaque sub claim', () => {
	assert.equal(telegramUserIdFromClaims({ id: undefined }), null);
});
