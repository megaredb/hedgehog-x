import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getInitial } from './utils.ts';

test('getInitial: null/undefined/пустая строка/пробелы дают пустую строку', () => {
	assert.equal(getInitial(null), '');
	assert.equal(getInitial(undefined), '');
	assert.equal(getInitial(''), '');
	assert.equal(getInitial('   '), '');
});

test('getInitial: первая буква имени в верхнем регистре', () => {
	assert.equal(getInitial('ivan'), 'I');
});

test('getInitial: пробелы вокруг имени игнорируются', () => {
	assert.equal(getInitial(' Ivan Petrov '), 'I');
});
