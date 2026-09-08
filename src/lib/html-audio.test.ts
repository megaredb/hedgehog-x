import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration } from './html-audio.ts';

test('formatDuration: нулевое значение', () => {
	assert.equal(formatDuration(0), '0:00');
});

test('formatDuration: секунды с ведущим нулём', () => {
	assert.equal(formatDuration(65), '1:05');
});

test('formatDuration: целые минуты', () => {
	assert.equal(formatDuration(3600), '60:00');
});

test('formatDuration: дробные секунды округляются вниз', () => {
	assert.equal(formatDuration(90.7), '1:30');
});

test('formatDuration: NaN даёт 0:00', () => {
	assert.equal(formatDuration(NaN), '0:00');
});

test('formatDuration: отрицательные значения дают 0:00', () => {
	assert.equal(formatDuration(-5), '0:00');
});

test('formatDuration: бесконечность даёт 0:00', () => {
	assert.equal(formatDuration(Number.POSITIVE_INFINITY), '0:00');
	assert.equal(formatDuration(Number.NEGATIVE_INFINITY), '0:00');
});
