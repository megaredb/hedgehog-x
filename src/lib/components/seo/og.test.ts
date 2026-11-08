import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	DEFAULT_OG_DESCRIPTION,
	DEFAULT_OG_IMAGE,
	DEFAULT_OG_SITE_NAME,
	DEFAULT_OG_TYPE,
	formatBookOgTitle,
	formatVolumeOgTitle,
	resolveOgMetadata,
	toAbsoluteUrl
} from './og.js';

describe('OpenGraph & SEO Helpers (og.ts)', () => {
	describe('toAbsoluteUrl', () => {
		it('returns empty string for null, undefined, or empty values', () => {
			assert.equal(toAbsoluteUrl(null, 'https://hedgehog-x.org'), '');
			assert.equal(toAbsoluteUrl(undefined, 'https://hedgehog-x.org'), '');
			assert.equal(toAbsoluteUrl('', 'https://hedgehog-x.org'), '');
			assert.equal(toAbsoluteUrl('   ', 'https://hedgehog-x.org'), '');
		});

		it('returns already absolute http and https URLs unchanged', () => {
			const httpsUrl = 'https://files.hedgehog-inc.one/covers/cover-1.webp';
			const httpUrl = 'http://localhost:5173/audio/track.mp3';

			assert.equal(toAbsoluteUrl(httpsUrl, 'https://hedgehog-x.org'), httpsUrl);
			assert.equal(toAbsoluteUrl(httpUrl, 'https://hedgehog-x.org'), httpUrl);
		});

		it('preserves data and blob URLs unchanged', () => {
			const dataUrl =
				'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';
			const blobUrl = 'blob:http://localhost:5173/uuid-1234';

			assert.equal(toAbsoluteUrl(dataUrl, 'https://hedgehog-x.org'), dataUrl);
			assert.equal(toAbsoluteUrl(blobUrl, 'https://hedgehog-x.org'), blobUrl);
		});

		it('resolves protocol-relative URLs with https or origin protocol', () => {
			assert.equal(
				toAbsoluteUrl('//cdn.example.com/asset.jpg', 'https://hedgehog-x.org'),
				'https://cdn.example.com/asset.jpg'
			);
			assert.equal(
				toAbsoluteUrl('//cdn.example.com/asset.jpg', 'http://localhost:5173'),
				'http://cdn.example.com/asset.jpg'
			);
			assert.equal(
				toAbsoluteUrl('//cdn.example.com/asset.jpg', null),
				'https://cdn.example.com/asset.jpg'
			);
		});

		it('combines origin and relative path without double slashes', () => {
			assert.equal(
				toAbsoluteUrl('/logo.webp', 'https://hedgehog-x.org'),
				'https://hedgehog-x.org/logo.webp'
			);
			assert.equal(
				toAbsoluteUrl('/logo.webp', 'https://hedgehog-x.org/'),
				'https://hedgehog-x.org/logo.webp'
			);
			assert.equal(
				toAbsoluteUrl('logo.webp', 'https://hedgehog-x.org'),
				'https://hedgehog-x.org/logo.webp'
			);
			assert.equal(
				toAbsoluteUrl('logo.webp', 'https://hedgehog-x.org/'),
				'https://hedgehog-x.org/logo.webp'
			);
			assert.equal(
				toAbsoluteUrl('/covers/vol-1.jpg', 'http://localhost:3000///'),
				'http://localhost:3000/covers/vol-1.jpg'
			);
		});

		it('returns trimmed relative path when origin is not provided', () => {
			assert.equal(toAbsoluteUrl('/images/pic.png', null), '/images/pic.png');
			assert.equal(toAbsoluteUrl('  /images/pic.png  ', ''), '/images/pic.png');
		});
	});

	describe('resolveOgMetadata', () => {
		const origin = 'https://hedgehog-x.org';
		const currentUrl = 'https://hedgehog-x.org/books/book-123';

		it('populates default values when optional fields are omitted', () => {
			const meta = resolveOgMetadata(
				{
					title: 'Моя книга'
				},
				currentUrl,
				origin
			);

			assert.equal(meta.title, 'Моя книга');
			assert.equal(meta.description, DEFAULT_OG_DESCRIPTION);
			assert.equal(meta.type, DEFAULT_OG_TYPE);
			assert.equal(meta.siteName, DEFAULT_OG_SITE_NAME);
			assert.equal(meta.image, `${origin}${DEFAULT_OG_IMAGE}`);
			assert.equal(meta.audio, null);
			assert.equal(meta.url, currentUrl);
		});

		it('uses siteName as title fallback when title is empty or missing', () => {
			const meta = resolveOgMetadata(
				{
					title: '   ',
					siteName: 'Custom Brand'
				},
				currentUrl,
				origin
			);

			assert.equal(meta.title, 'Custom Brand');
			assert.equal(meta.siteName, 'Custom Brand');
		});

		it('resolves explicit custom metadata with relative and absolute URLs', () => {
			const meta = resolveOgMetadata(
				{
					title: 'Том 1: Восхождение',
					description: 'Глава 1 книги о приключениях',
					image: '/covers/volume-1.jpg',
					type: 'music.album',
					audio: '/audio/chapters/ch-1.mp3',
					url: '/books/book-1/vol-1',
					siteName: 'Hedgehog Audio'
				},
				currentUrl,
				origin
			);

			assert.equal(meta.title, 'Том 1: Восхождение');
			assert.equal(meta.description, 'Глава 1 книги о приключениях');
			assert.equal(meta.type, 'music.album');
			assert.equal(meta.siteName, 'Hedgehog Audio');
			assert.equal(meta.image, 'https://hedgehog-x.org/covers/volume-1.jpg');
			assert.equal(meta.audio, 'https://hedgehog-x.org/audio/chapters/ch-1.mp3');
			assert.equal(meta.url, 'https://hedgehog-x.org/books/book-1/vol-1');
		});

		it('preserves already absolute image and audio URLs', () => {
			const absoluteCover = 'https://cdn.files.com/covers/c1.webp';
			const absoluteAudio = 'https://cdn.files.com/audio/a1.mp3';

			const meta = resolveOgMetadata(
				{
					title: 'Book Title',
					image: absoluteCover,
					audio: absoluteAudio
				},
				currentUrl,
				origin
			);

			assert.equal(meta.image, absoluteCover);
			assert.equal(meta.audio, absoluteAudio);
		});

		it('handles whitespace-only audio as null', () => {
			const meta = resolveOgMetadata(
				{
					title: 'Book Title',
					audio: '   '
				},
				currentUrl,
				origin
			);

			assert.equal(meta.audio, null);
		});

		it('supports book, music.song, and website types', () => {
			const bookMeta = resolveOgMetadata({ title: 'T', type: 'book' });
			assert.equal(bookMeta.type, 'book');

			const songMeta = resolveOgMetadata({ title: 'T', type: 'music.song' });
			assert.equal(songMeta.type, 'music.song');

			const siteMeta = resolveOgMetadata({ title: 'T', type: 'website' });
			assert.equal(siteMeta.type, 'website');
		});
	});

	describe('Title Formatting Helpers', () => {
		describe('formatBookOgTitle', () => {
			it('formats book title with " | Тома"', () => {
				assert.equal(formatBookOgTitle('Гарри Поттер'), 'Гарри Поттер | Тома');
			});

			it('uses fallback when book title is empty or null', () => {
				assert.equal(formatBookOgTitle(null), 'Книга | Тома');
				assert.equal(formatBookOgTitle('   '), 'Книга | Тома');
				assert.equal(formatBookOgTitle(undefined, 'Аудиокнига'), 'Аудиокнига | Тома');
			});
		});

		describe('formatVolumeOgTitle', () => {
			it('formats both volume and book title with siteName', () => {
				assert.equal(
					formatVolumeOgTitle('Том 1: Начало', 'Магия и Меч', 'Hedgehog X'),
					'Том 1: Начало | Магия и Меч | Hedgehog X'
				);
			});

			it('formats volume only with siteName', () => {
				assert.equal(formatVolumeOgTitle('Том 2', null, 'Hedgehog X'), 'Том 2 | Hedgehog X');
			});

			it('formats book only with siteName', () => {
				assert.equal(
					formatVolumeOgTitle(null, 'Магия и Меч', 'Hedgehog X'),
					'Магия и Меч | Hedgehog X'
				);
			});

			it('returns generic fallback when both are null or empty', () => {
				assert.equal(formatVolumeOgTitle(null, null, 'Hedgehog X'), 'Аудиокнига | Hedgehog X');
				assert.equal(formatVolumeOgTitle('   ', '', 'Hedgehog X'), 'Аудиокнига | Hedgehog X');
			});
		});
	});
});
