import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeFeedbackTarget } from './feedback';
import { DEFAULT_FEEDBACK_URL } from '$lib/types/site';

describe('feedback redirect target', () => {
	it('accepts http, https and telegram links', () => {
		assert.equal(safeFeedbackTarget('https://t.me/hedgehoginc'), 'https://t.me/hedgehoginc');
		assert.equal(safeFeedbackTarget('http://example.com/help'), 'http://example.com/help');
		assert.equal(
			safeFeedbackTarget('tg://resolve?domain=hedgehoginc'),
			'tg://resolve?domain=hedgehoginc'
		);
	});

	it('falls back for empty, invalid or unsupported protocols', () => {
		assert.equal(safeFeedbackTarget(null), DEFAULT_FEEDBACK_URL);
		assert.equal(safeFeedbackTarget(''), DEFAULT_FEEDBACK_URL);
		assert.equal(safeFeedbackTarget('javascript:alert(1)'), DEFAULT_FEEDBACK_URL);
		assert.equal(safeFeedbackTarget('not a url'), DEFAULT_FEEDBACK_URL);
	});

	it('supports an explicit fallback', () => {
		assert.equal(safeFeedbackTarget('', 'https://t.me/fallback'), 'https://t.me/fallback');
	});
});
