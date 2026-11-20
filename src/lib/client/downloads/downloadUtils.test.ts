import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContentLength, hasEnoughDownloadSpace, buildCorsUrl } from './downloadUtils';

test('parseContentLength accepts only positive integers', () => {
	assert.equal(parseContentLength('1024'), 1024);
	assert.equal(parseContentLength(null), 0);
	assert.equal(parseContentLength(''), 0);
	assert.equal(parseContentLength('-5'), 0);
	assert.equal(parseContentLength('garbage'), 0);
});

test('hasEnoughDownloadSpace keeps the reserve', () => {
	assert.equal(hasEnoughDownloadSpace(1000, 100, 50), true);
	assert.equal(hasEnoughDownloadSpace(100, 100, 50), false);
	assert.equal(hasEnoughDownloadSpace(Number.NaN, 100), true);
});

test('buildCorsUrl preserves the URL and adds the marker', () => {
	const result = buildCorsUrl('/audio/a.mp3?x=1', 'https://hedgehog-inc.localhost');
	assert.equal(result, 'https://hedgehog-inc.localhost/audio/a.mp3?x=1&_cors=1');
});
