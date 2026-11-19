import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	PRIMARY_CDN_HOST,
	RU_CDN_HOST,
	getActiveMirrorHost,
	getFallbackMediaUrl,
	resolveMediaUrl
} from './mirror';

test('resolveMediaUrl leaves relative and third-party URLs unchanged', () => {
	assert.equal(resolveMediaUrl('/audio/sample.mp3', 'ru'), '/audio/sample.mp3');
	assert.equal(resolveMediaUrl('https://example.com/a.mp3', 'ru'), 'https://example.com/a.mp3');
	assert.equal(resolveMediaUrl('', 'ru'), '');
	assert.equal(resolveMediaUrl(null, 'ru'), '');
});

test('resolveMediaUrl switches CDN hosts by preference', () => {
	const primary = `https://${PRIMARY_CDN_HOST}/a.mp3`;
	const ru = `https://${RU_CDN_HOST}/a.mp3`;
	assert.equal(resolveMediaUrl(primary, 'ru'), ru);
	assert.equal(resolveMediaUrl(ru, 'primary'), primary);
	assert.equal(resolveMediaUrl(primary, 'primary'), primary);
});

test('getFallbackMediaUrl toggles only Hedgehog CDN URLs', () => {
	const primary = `https://${PRIMARY_CDN_HOST}/a.mp3`;
	const ru = `https://${RU_CDN_HOST}/a.mp3`;
	assert.equal(getFallbackMediaUrl(primary), ru);
	assert.equal(getFallbackMediaUrl(ru), primary);
	assert.equal(getFallbackMediaUrl('/audio/sample.mp3'), null);
	assert.equal(getFallbackMediaUrl('https://example.com/a.mp3'), null);
	assert.equal(getFallbackMediaUrl(null), null);
});

test('getActiveMirrorHost respects explicit preference', () => {
	assert.equal(getActiveMirrorHost('ru'), RU_CDN_HOST);
	assert.equal(getActiveMirrorHost('primary'), PRIMARY_CDN_HOST);
});
