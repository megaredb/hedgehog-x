import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration } from './time';

test('formatDuration uses hours when needed', () => {
	assert.equal(formatDuration(38), '0:38');
	assert.equal(formatDuration(128), '2:08');
	assert.equal(formatDuration(7680), '2:08:00');
	assert.equal(formatDuration(7718), '2:08:38');
	assert.equal(formatDuration(0), '0:00');
	assert.equal(formatDuration(-1), '0:00');
});
