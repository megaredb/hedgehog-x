import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTimecode, formatTimeRange, parseTimecode } from './timecode';

test('formatTimecode: formats minutes and seconds', () => {
	assert.equal(formatTimecode(0), '0:00');
	assert.equal(formatTimecode(7), '0:07');
	assert.equal(formatTimecode(988), '16:28');
	assert.equal(formatTimecode(1057), '17:37');
	assert.equal(formatTimecode(3599), '59:59');
});

test('formatTimecode: formats hours', () => {
	assert.equal(formatTimecode(3600), '1:00:00');
	assert.equal(formatTimecode(3723), '1:02:03');
	assert.equal(formatTimecode(36000), '10:00:00');
});

test('formatTimecode: floors fractional and clamps invalid values', () => {
	assert.equal(formatTimecode(988.9), '16:28');
	assert.equal(formatTimecode(-5), '0:00');
	assert.equal(formatTimecode(Number.NaN), '0:00');
});

test('formatTimeRange: combines start and optional end', () => {
	assert.equal(formatTimeRange(988, 1057), '16:28–17:37');
	assert.equal(formatTimeRange(988), '16:28');
	assert.equal(formatTimeRange(988, null), '16:28');
	assert.equal(formatTimeRange(988, 988), '16:28');
	assert.equal(formatTimeRange(988, 900), '16:28');
});

test('parseTimecode: parses minutes and seconds', () => {
	assert.equal(parseTimecode('16:28'), 988);
	assert.equal(parseTimecode('17:37'), 1057);
	assert.equal(parseTimecode('0:07'), 7);
	assert.equal(parseTimecode(' 16:28 '), 988);
});

test('parseTimecode: parses hours', () => {
	assert.equal(parseTimecode('1:02:03'), 3723);
	assert.equal(parseTimecode('10:00:00'), 36000);
});

test('parseTimecode: rejects empty and malformed values', () => {
	assert.equal(parseTimecode(''), null);
	assert.equal(parseTimecode('   '), null);
	assert.equal(parseTimecode('16'), null);
	assert.equal(parseTimecode('16:28:00:00'), null);
	assert.equal(parseTimecode('abc'), null);
	assert.equal(parseTimecode('1:2a'), null);
	assert.equal(parseTimecode('-1:00'), null);
	assert.equal(parseTimecode('1:60'), null);
	assert.equal(parseTimecode('1:00:60'), null);
});

test('parseTimecode: round-trips with formatTimecode for ranges used by bookmarks', () => {
	for (const seconds of [0, 7, 988, 1057, 3599, 3600, 3723]) {
		const parsed = parseTimecode(formatTimecode(seconds));
		// 0:00 parses back to zero, which callers treat as a valid start.
		assert.equal(parsed, seconds);
	}
});
