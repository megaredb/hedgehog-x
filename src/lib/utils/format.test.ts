import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes } from './format';

test('formatBytes handles zero, bytes, KB, MB and GB', () => {
	assert.equal(formatBytes(0), '0 Б');
	assert.equal(formatBytes(512), '512 Б');
	assert.equal(formatBytes(1024), '1.0 КБ');
	assert.equal(formatBytes(1024 * 1024), '1.0 МБ');
	assert.equal(formatBytes(2.5 * 1024 * 1024 * 1024), '2.5 ГБ');
});
