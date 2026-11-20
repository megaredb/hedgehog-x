import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUniqueViolation } from './errors';

test('detects a direct PostgreSQL unique violation', () => {
	assert.equal(isUniqueViolation({ code: '23505' }), true);
});

test('detects a unique violation wrapped by Drizzle', () => {
	assert.equal(isUniqueViolation({ cause: { code: '23505' } }), true);
	assert.equal(isUniqueViolation({ cause: { cause: { code: '23505' } } }), true);
});

test('ignores other errors', () => {
	assert.equal(isUniqueViolation(null), false);
	assert.equal(isUniqueViolation({ code: '23503' }), false);
	assert.equal(isUniqueViolation(new Error('boom')), false);
});
