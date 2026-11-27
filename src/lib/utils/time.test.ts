import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	formatDuration,
	formatMoscowDateTime,
	formatMoscowLocalDateTimeInput,
	parseMoscowLocalDateTime
} from './time';

test('parses datetime-local values as Moscow time', () => {
	assert.equal(
		parseMoscowLocalDateTime('2026-11-27T22:10')?.toISOString(),
		'2026-11-27T19:10:00.000Z'
	);
	assert.equal(
		parseMoscowLocalDateTime('2026-01-01T00:30')?.toISOString(),
		'2025-12-31T21:30:00.000Z'
	);
	assert.equal(parseMoscowLocalDateTime('2026-02-30T12:00'), null);
	assert.equal(parseMoscowLocalDateTime('not-a-date'), null);
});

test('formats Moscow datetime-local input and admin display', () => {
	assert.equal(formatMoscowLocalDateTimeInput('2026-11-27T19:10:00.000Z'), '2026-11-27T22:10');
	assert.match(formatMoscowDateTime('2026-11-27T19:10:00.000Z'), /22:10/);
});

test('formatDuration uses hours when needed', () => {
	assert.equal(formatDuration(38), '0:38');
	assert.equal(formatDuration(128), '2:08');
	assert.equal(formatDuration(7680), '2:08:00');
	assert.equal(formatDuration(7718), '2:08:38');
	assert.equal(formatDuration(0), '0:00');
	assert.equal(formatDuration(-1), '0:00');
});
