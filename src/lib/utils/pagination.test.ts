import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampPage, pageCount } from './pagination';

test('pagination clamps pages for 51 illustrations', () => {
	assert.equal(pageCount(51, 50), 2);
	assert.equal(clampPage(1, 51, 50), 1);
	assert.equal(clampPage(2, 51, 50), 2);
	assert.equal(clampPage(99, 51, 50), 2);
	assert.equal(clampPage(0, 51, 50), 1);
	assert.equal(clampPage(Number.NaN, 51, 50), 1);
	assert.equal(pageCount(0, 50), 1);
});
