import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	broadcastKind,
	canReplay,
	validateChatBody,
	type BroadcastState
} from '$lib/broadcasts/domain';

const base: BroadcastState = {
	id: 'b1',
	chapterId: 'c1',
	title: 'Test',
	description: null,
	coverUrl: null,
	coverBlurhash: null,
	volumeBlurhash: null,
	scheduledStartAt: new Date('2026-01-01T10:00:00Z'),
	startedAt: null,
	endedAt: null,
	saveRecording: true,
	publishAfterEnd: true,
	chatEnabled: true,
	publishedAt: null,
	chapterTitle: 'Chapter',
	volumeTitle: 'Volume',
	bookTitle: 'Book',
	audioUrl: '/audio.mp3',
	durationSeconds: 3600,
	volumeId: 'v1',
	bookId: 'book1'
};

describe('broadcast state and chat guard', () => {
	it('derives scheduled, live, ended and published states', () => {
		assert.equal(broadcastKind(base, new Date('2026-01-01T09:59:00Z')), 'scheduled');
		assert.equal(
			broadcastKind(
				{ ...base, startedAt: new Date('2026-01-01T10:00:00Z') },
				new Date('2026-01-01T10:01:00Z')
			),
			'live'
		);
		assert.equal(
			broadcastKind({
				...base,
				startedAt: new Date('2026-01-01T10:00:00Z'),
				endedAt: new Date('2026-01-01T10:30:00Z')
			}),
			'ended'
		);
		assert.equal(
			broadcastKind({
				...base,
				startedAt: new Date('2026-01-01T10:00:00Z'),
				endedAt: new Date('2026-01-01T10:30:00Z'),
				publishedAt: new Date('2026-01-01T10:30:00Z')
			}),
			'published'
		);
	});

	it('requires a saved and published recording for replay', () => {
		const ended = { ...base, startedAt: new Date(), endedAt: new Date(), publishedAt: new Date() };
		assert.equal(canReplay(ended), true);
		assert.equal(canReplay({ ...ended, saveRecording: false }), false);
		assert.equal(canReplay({ ...ended, publishedAt: null }), false);
	});

	it('allows only approved chat links', () => {
		assert.equal(
			validateChatBody('Привет! https://t.me/hedgehoginc', 'hedgehog-inc.one'),
			'Привет! https://t.me/hedgehoginc'
		);
		assert.equal(
			validateChatBody('https://boosty.to/hedgehoginc', 'hedgehog-inc.one'),
			'https://boosty.to/hedgehoginc'
		);
		assert.equal(
			validateChatBody('https://hedgehog-inc.one/books', 'hedgehog-inc.one'),
			'https://hedgehog-inc.one/books'
		);
		assert.equal(validateChatBody('https://evil.example/phish', 'hedgehog-inc.one'), null);
		assert.equal(validateChatBody('https://t.me.evil.example/phish', 'hedgehog-inc.one'), null);
	});

	it('rejects empty, oversized and control-character messages', () => {
		assert.equal(validateChatBody('', 'hedgehog-inc.one'), null);
		assert.equal(validateChatBody('x'.repeat(501), 'hedgehog-inc.one'), null);
		assert.equal(validateChatBody('ok\u0000message', 'hedgehog-inc.one'), 'okmessage');
	});
});
