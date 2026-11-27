import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toggleSocialLink } from './social-links';
import type { SiteSocialLink } from '$lib/types/site';

const vk = (url: string, enabled = true): SiteSocialLink => ({ type: 'vk', url, enabled });

describe('admin social link toggle', () => {
	it('adds an empty enabled link when it is not selected', () => {
		assert.deepEqual(toggleSocialLink([], 'vk'), [{ type: 'vk', url: '', enabled: true }]);
	});

	it('removes a selected link when its URL is empty', () => {
		assert.deepEqual(toggleSocialLink([vk('')], 'vk'), []);
	});

	it('disables and re-enables a selected link with a URL', () => {
		const disabled = toggleSocialLink([vk('https://vk.com/test')], 'vk');
		assert.equal(disabled[0]?.enabled, false);
		assert.equal(disabled[0]?.url, 'https://vk.com/test');

		const enabled = toggleSocialLink(disabled, 'vk');
		assert.equal(enabled[0]?.enabled, true);
	});

	it('does not modify other social links', () => {
		const links: SiteSocialLink[] = [
			vk('https://vk.com/test'),
			{ type: 'github', url: 'https://github.com/test', enabled: false }
		];
		const next = toggleSocialLink(links, 'vk');
		assert.equal(next[1]?.enabled, false);
		assert.equal(next[1]?.url, 'https://github.com/test');
	});
});
