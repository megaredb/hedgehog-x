import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundedText, timestampSeconds } from './validation';

test('boundedText trims and rejects empty/oversized/non-string values', () => {
	assert.equal(boundedText('  abc  '), 'abc');
	assert.equal(boundedText(''), null);
	assert.equal(boundedText('   '), null);
	assert.equal(boundedText('x'.repeat(129)), null);
	assert.equal(boundedText('x'.repeat(128)), 'x'.repeat(128));
	assert.equal(boundedText(42), null);
});

test('timestampSeconds accepts only finite 0..86400 values and floors', () => {
	assert.equal(timestampSeconds(12.9), 12);
	assert.equal(timestampSeconds(0), 0);
	assert.equal(timestampSeconds(86_400), 86_400);
	assert.equal(timestampSeconds(-1), null);
	assert.equal(timestampSeconds(86_401), null);
	assert.equal(timestampSeconds(Number.NaN), null);
	assert.equal(timestampSeconds('12'), null);
});
