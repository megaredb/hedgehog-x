import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	SITE_PAGE_DEFAULTS,
	normalizeSitePageData,
	normalizeSocialLinks,
	setDeveloperAccount
} from './site-content';
import { DEFAULT_FEEDBACK_URL } from '$lib/types/site';

describe('site content normalization', () => {
	it('keeps feedback URL and developer account links for the about page', () => {
		const data = normalizeSitePageData('about', {
			feedbackUrl: 'https://t.me/hedgehoginc_support',
			developers: [
				{
					name: 'Developer',
					userId: 'user-123',
					links: [{ type: 'github', url: 'https://github.com/dev', enabled: false }]
				}
			]
		});

		assert.equal(data.feedbackUrl, 'https://t.me/hedgehoginc_support');
		assert.equal(data.developers?.[0]?.userId, 'user-123');
		assert.equal(data.developers?.[0]?.links[0]?.enabled, false);
	});

	it('falls back to the default feedback URL and empty developer user id', () => {
		const data = normalizeSitePageData('about', {
			feedbackUrl: '',
			developers: [{ name: 'Developer', links: [] }]
		});

		assert.equal(data.feedbackUrl, DEFAULT_FEEDBACK_URL);
		assert.equal(data.developers?.[0]?.userId, '');
	});

	it('normalizes enabled flags and drops empty social URLs', () => {
		const links = normalizeSocialLinks([
			{ type: 'vk', url: 'https://vk.com/test', enabled: false },
			{ type: 'telegram', url: 'https://t.me/test' },
			{ type: 'discord', url: '' }
		]);

		assert.deepEqual(links, [
			{ type: 'vk', url: 'https://vk.com/test', enabled: false },
			{ type: 'telegram', url: 'https://t.me/test', enabled: true }
		]);
	});

	it('uses legacy URL fallback for old author/translator records', () => {
		const links = normalizeSocialLinks([], 'https://github.com/legacy');
		assert.deepEqual(links, [{ enabled: true, type: 'github', url: 'https://github.com/legacy' }]);
	});

	it('has default about data with feedback and developers', () => {
		const defaults = SITE_PAGE_DEFAULTS.about.data;
		assert.equal(defaults.feedbackUrl, DEFAULT_FEEDBACK_URL);
		assert.ok((defaults.developers ?? []).length > 0);
		assert.ok((defaults.developers ?? []).every((developer) => developer.userId === ''));
	});
	describe('developer account links', () => {
		it('adds a developer profile from a linked user', () => {
			const result = setDeveloperAccount([], 'user-1', 'User One');
			assert.equal(result.length, 1);
			assert.deepEqual(result[0], {
				enabled: true,
				userId: 'user-1',
				name: 'User One',
				role: 'Разработчик',
				description: '',
				links: []
			});
		});

		it('does not duplicate an existing link', () => {
			const first = setDeveloperAccount([], 'user-1', 'User One');
			const second = setDeveloperAccount(first, 'user-1', 'Renamed');
			assert.equal(second.length, 1);
			assert.equal(second[0]?.name, 'User One');
		});

		it('clears the link without deleting the developer profile', () => {
			const linked = setDeveloperAccount([], 'user-1', 'User One');
			const unlinked = setDeveloperAccount(linked, 'user-1', 'User One', true);
			assert.equal(unlinked.length, 1);
			assert.equal(unlinked[0]?.userId, '');
		});
	});
});
