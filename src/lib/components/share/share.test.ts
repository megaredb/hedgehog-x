import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareUrl, parseShareParams, formatShareTime, buildShareText } from './share.js';

describe('Share URL generation (buildShareUrl)', () => {
	it('generates a clean URL for volume only without chapter or timestamp', () => {
		const url = buildShareUrl({
			origin: 'https://hedgehog-x.app',
			bookId: 'mushoku_tensei',
			volumeId: 'vol-1'
		});
		assert.strictEqual(url, 'https://hedgehog-x.app/books/mushoku_tensei/vol-1');
	});

	it('returns relative path when origin is not provided', () => {
		const url = buildShareUrl({
			bookId: 'overlord',
			volumeId: 'vol-2'
		});
		assert.strictEqual(url, '/books/overlord/vol-2');
	});

	it('handles trailing slash on origin properly', () => {
		const url = buildShareUrl({
			origin: 'https://hedgehog-x.app/',
			bookId: 'overlord',
			volumeId: 'vol-2'
		});
		assert.strictEqual(url, 'https://hedgehog-x.app/books/overlord/vol-2');
	});

	it('generates URL for specific chapter without timestamp', () => {
		const url = buildShareUrl({
			origin: 'https://hedgehog-x.app',
			bookId: 'mushoku_tensei',
			volumeId: 'vol-1',
			chapterId: 'chap-5'
		});
		assert.strictEqual(url, 'https://hedgehog-x.app/books/mushoku_tensei/vol-1?ch=chap-5');
	});

	it('generates URL for chapter with integer timestamp', () => {
		const url = buildShareUrl({
			origin: 'https://hedgehog-x.app',
			bookId: 'mushoku_tensei',
			volumeId: 'vol-1',
			chapterId: 'chap-5',
			timestamp: 125
		});
		assert.strictEqual(url, 'https://hedgehog-x.app/books/mushoku_tensei/vol-1?ch=chap-5&t=125');
	});

	it('floors float timestamps to whole seconds', () => {
		const url = buildShareUrl({
			origin: 'https://hedgehog-x.app',
			bookId: 'mushoku_tensei',
			volumeId: 'vol-1',
			chapterId: 'chap-5',
			timestamp: 125.87
		});
		assert.strictEqual(url, 'https://hedgehog-x.app/books/mushoku_tensei/vol-1?ch=chap-5&t=125');
	});

	it('omits timestamp when timestamp is zero or negative', () => {
		const urlZero = buildShareUrl({
			origin: 'https://hedgehog-x.app',
			bookId: 'mushoku_tensei',
			volumeId: 'vol-1',
			chapterId: 'chap-5',
			timestamp: 0
		});
		assert.strictEqual(urlZero, 'https://hedgehog-x.app/books/mushoku_tensei/vol-1?ch=chap-5');

		const urlNeg = buildShareUrl({
			origin: 'https://hedgehog-x.app',
			bookId: 'mushoku_tensei',
			volumeId: 'vol-1',
			chapterId: 'chap-5',
			timestamp: -10
		});
		assert.strictEqual(urlNeg, 'https://hedgehog-x.app/books/mushoku_tensei/vol-1?ch=chap-5');
	});

	it('ignores timestamp if chapterId is not provided', () => {
		const url = buildShareUrl({
			origin: 'https://hedgehog-x.app',
			bookId: 'mushoku_tensei',
			volumeId: 'vol-1',
			timestamp: 300
		});
		assert.strictEqual(url, 'https://hedgehog-x.app/books/mushoku_tensei/vol-1');
	});

	it('safely escapes special characters in identifiers', () => {
		const url = buildShareUrl({
			origin: 'https://hedgehog-x.app',
			bookId: 'book 1',
			volumeId: 'vol #1',
			chapterId: 'ch/1?a=b'
		});
		assert.strictEqual(url, 'https://hedgehog-x.app/books/book%201/vol%20%231?ch=ch%2F1%3Fa%3Db');
	});
});

describe('Share params parsing (parseShareParams)', () => {
	it('returns nulls when query string is empty', () => {
		const params = new URLSearchParams('');
		const parsed = parseShareParams(params);
		assert.deepStrictEqual(parsed, { chapterId: null, timestamp: null });
	});

	it('parses chapterId only', () => {
		const params = new URLSearchParams('ch=chapter-42');
		const parsed = parseShareParams(params);
		assert.deepStrictEqual(parsed, { chapterId: 'chapter-42', timestamp: null });
	});

	it('parses both chapterId and integer timestamp', () => {
		const params = new URLSearchParams('ch=chapter-42&t=215');
		const parsed = parseShareParams(params);
		assert.deepStrictEqual(parsed, { chapterId: 'chapter-42', timestamp: 215 });
	});

	it('parses float timestamp', () => {
		const params = new URLSearchParams('ch=chapter-42&t=75.5');
		const parsed = parseShareParams(params);
		assert.deepStrictEqual(parsed, { chapterId: 'chapter-42', timestamp: 75.5 });
	});

	it('safely discards invalid or negative timestamps', () => {
		const invalidAlpha = parseShareParams(new URLSearchParams('ch=ch-1&t=invalid'));
		assert.deepStrictEqual(invalidAlpha, { chapterId: 'ch-1', timestamp: null });

		const negative = parseShareParams(new URLSearchParams('ch=ch-1&t=-50'));
		assert.deepStrictEqual(negative, { chapterId: 'ch-1', timestamp: null });
	});

	it('trims whitespace and treats whitespace-only chapterId as null', () => {
		const spaces = parseShareParams(new URLSearchParams('ch=   &t=10'));
		assert.deepStrictEqual(spaces, { chapterId: null, timestamp: 10 });

		const trimmed = parseShareParams(new URLSearchParams('ch= chap-2 &t= 45 '));
		assert.deepStrictEqual(trimmed, { chapterId: 'chap-2', timestamp: 45 });
	});

	it('works with custom object with get() method', () => {
		const mock = {
			get(name: string) {
				if (name === 'ch') return 'custom-ch';
				if (name === 't') return '99';
				return null;
			}
		};
		const parsed = parseShareParams(mock);
		assert.deepStrictEqual(parsed, { chapterId: 'custom-ch', timestamp: 99 });
	});
});

describe('Share timecode formatting (formatShareTime)', () => {
	it('formats seconds under one hour as m:ss', () => {
		assert.strictEqual(formatShareTime(0), '0:00');
		assert.strictEqual(formatShareTime(9), '0:09');
		assert.strictEqual(formatShareTime(45), '0:45');
		assert.strictEqual(formatShareTime(60), '1:00');
		assert.strictEqual(formatShareTime(75), '1:15');
		assert.strictEqual(formatShareTime(599), '9:59');
		assert.strictEqual(formatShareTime(3599), '59:59');
	});

	it('formats seconds over one hour as h:mm:ss', () => {
		assert.strictEqual(formatShareTime(3600), '1:00:00');
		assert.strictEqual(formatShareTime(3665), '1:01:05');
		assert.strictEqual(formatShareTime(7322), '2:02:02');
	});

	it('gracefully handles NaN, negative, or infinite values', () => {
		assert.strictEqual(formatShareTime(NaN), '0:00');
		assert.strictEqual(formatShareTime(-50), '0:00');
		assert.strictEqual(formatShareTime(Infinity), '0:00');
	});
});

describe('Share text formatting for social / messengers (buildShareText)', () => {
	it('formats volume only share text', () => {
		const text = buildShareText({
			bookTitle: 'Реинкарнация безработного',
			volumeTitle: 'Том 1. Детство',
			url: 'https://hedgehog-x.app/books/mushoku/vol-1'
		});
		assert.strictEqual(
			text,
			'🎧 Реинкарнация безработного — Том 1. Детство\nhttps://hedgehog-x.app/books/mushoku/vol-1'
		);
	});

	it('formats chapter share text without timestamp', () => {
		const text = buildShareText({
			bookTitle: 'Overlord',
			volumeTitle: 'Том 1',
			chapterTitle: 'Глава 3. Битва за деревню Карн',
			url: 'https://hedgehog-x.app/books/overlord/vol-1?ch=ch-3'
		});
		assert.strictEqual(
			text,
			'🎧 Overlord — Том 1\n📖 Глава 3. Битва за деревню Карн\nhttps://hedgehog-x.app/books/overlord/vol-1?ch=ch-3'
		);
	});

	it('formats chapter share text with timestamp', () => {
		const text = buildShareText({
			bookTitle: 'Overlord',
			volumeTitle: 'Том 1',
			chapterTitle: 'Глава 3',
			timestamp: 125,
			includeTimestamp: true,
			url: 'https://hedgehog-x.app/books/overlord/vol-1?ch=ch-3&t=125'
		});
		assert.strictEqual(
			text,
			'🎧 Overlord — Том 1\n📖 Глава 3\n⏱ Таймкод: 2:05\nhttps://hedgehog-x.app/books/overlord/vol-1?ch=ch-3&t=125'
		);
	});

	it('omits timestamp line if includeTimestamp is false', () => {
		const text = buildShareText({
			bookTitle: 'Overlord',
			volumeTitle: 'Том 1',
			chapterTitle: 'Глава 3',
			timestamp: 125,
			includeTimestamp: false,
			url: 'https://hedgehog-x.app/books/overlord/vol-1?ch=ch-3'
		});
		assert.strictEqual(
			text,
			'🎧 Overlord — Том 1\n📖 Глава 3\nhttps://hedgehog-x.app/books/overlord/vol-1?ch=ch-3'
		);
	});
});
