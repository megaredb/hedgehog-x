import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	DEFAULT_MEDIA_SETTINGS,
	directMediaUrl,
	deriveMediaDirectBase,
	normalizeMediaSettings,
	normalizeMirrors
} from './site-settings';
import { DEFAULT_SITE_MIRRORS } from '$lib/types/site';

describe('site settings normalization', () => {
	it('normalizes media proxy settings and direct base URL', () => {
		assert.deepEqual(normalizeMediaSettings(undefined), DEFAULT_MEDIA_SETTINGS);
		assert.deepEqual(
			normalizeMediaSettings({
				mediaProxyEnabled: false,
				mediaDirectBaseUrl: 'https://cdn.example.com/'
			}),
			{ mediaProxyEnabled: false, mediaDirectBaseUrl: 'https://cdn.example.com' }
		);
		assert.equal(
			normalizeMediaSettings({ mediaDirectBaseUrl: 'javascript:alert(1)' }).mediaDirectBaseUrl,
			''
		);
	});

	it('derives the media base from the default enabled mirror', () => {
		assert.equal(
			deriveMediaDirectBase([
				{
					id: 'disabled',
					label: 'Disabled',
					description: '',
					host: 'off.example.com',
					enabled: false,
					autoRole: 'default'
				},
				{
					id: 'ru',
					label: 'RU',
					description: '',
					host: 'ru.example.com',
					enabled: true,
					autoRole: 'ru'
				},
				{
					id: 'main',
					label: 'Main',
					description: '',
					host: 'main.example.com',
					enabled: true,
					autoRole: 'default'
				}
			]),
			'https://main.example.com'
		);
		assert.equal(deriveMediaDirectBase([]), '');
	});

	it('builds a direct media URL only when proxying is disabled', () => {
		const proxied = normalizeMediaSettings({
			mediaProxyEnabled: true,
			mediaDirectBaseUrl: 'https://cdn.example.com'
		});
		assert.equal(directMediaUrl(proxied, 'folder/file name.mp3'), null);

		const direct = normalizeMediaSettings({
			mediaProxyEnabled: false,
			mediaDirectBaseUrl: 'https://cdn.example.com'
		});
		assert.equal(
			directMediaUrl(direct, 'folder/file name.mp3'),
			'https://cdn.example.com/folder/file%20name.mp3'
		);
	});

	it('falls back to the default mirrors when input is missing', () => {
		assert.deepEqual(normalizeMirrors(undefined), DEFAULT_SITE_MIRRORS);
		assert.deepEqual(normalizeMirrors([]), DEFAULT_SITE_MIRRORS);
	});

	it('normalizes mirror hosts, labels and flags', () => {
		const mirrors = normalizeMirrors([
			{
				id: 'custom',
				host: 'https://Files.Example.com/path',
				label: '',
				enabled: false,
				autoRole: 'unknown'
			},
			{
				id: 'no-host',
				host: '',
				label: 'Dropped'
			}
		]);

		assert.deepEqual(mirrors, [
			{
				id: 'custom',
				host: 'files.example.com',
				label: 'files.example.com',
				description: '',
				enabled: false,
				autoRole: 'none'
			}
		]);
	});

	it('keeps auto roles and generates unique ids for duplicates', () => {
		const mirrors = normalizeMirrors([
			{ id: 'same', host: 'one.example.com', autoRole: 'default' },
			{ id: 'same', host: 'two.example.com', autoRole: 'ru' }
		]);

		assert.equal(mirrors[0]?.autoRole, 'default');
		assert.equal(mirrors[1]?.autoRole, 'ru');
		assert.notEqual(mirrors[0]?.id, mirrors[1]?.id);
	});
});
