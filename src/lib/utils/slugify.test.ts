import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from './slugify';

test('slugify transliterates Cyrillic instead of dropping it', () => {
	assert.equal(slugify('Повелитель'), 'povelitel');
	assert.equal(slugify('Тёмная звезда'), 'temnaya-zvezda');
	assert.equal(slugify('  Test__Book  '), 'test-book');
});
