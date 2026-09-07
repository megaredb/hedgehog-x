import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	mapServerBookToOfflineBook,
	mapServerChapterToOfflineChapter,
	mapServerIllustrationToOfflineIllustration,
	mapServerVolumeToOfflineVolume
} from './mappers.ts';

type ServerBook = Parameters<typeof mapServerBookToOfflineBook>[0];
type ServerVolume = Parameters<typeof mapServerVolumeToOfflineVolume>[0];
type ServerChapter = Parameters<typeof mapServerChapterToOfflineChapter>[0];
type ServerIllustration = Parameters<typeof mapServerIllustrationToOfflineIllustration>[0];

function serverBook(overrides: Partial<ServerBook> = {}): ServerBook {
	return {
		id: 'book-1',
		title: 'Книга',
		description: 'Описание книги',
		coverUrl: null,
		blurhash: null,
		themeColor: null,
		status: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	} as ServerBook;
}

function serverVolume(overrides: Partial<ServerVolume> = {}): ServerVolume {
	return {
		id: 'vol-1',
		bookId: 'book-1',
		volumeNumber: 1,
		title: 'Том',
		description: 'Описание тома',
		coverUrl: null,
		blurhash: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	} as ServerVolume;
}

function serverChapter(overrides: Partial<ServerChapter> = {}): ServerChapter {
	return {
		id: 'ch-1',
		volumeId: 'vol-1',
		chapterNumber: 1,
		title: 'Глава',
		audioUrl: 'https://cdn.example/audio/1.mp3',
		durationSeconds: 3600,
		telegramPostUrl: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	} as ServerChapter;
}

function serverIllustration(overrides: Partial<ServerIllustration> = {}): ServerIllustration {
	return {
		id: 'ill-1',
		volumeId: 'vol-1',
		imageUrl: 'https://cdn.example/ill/1.webp',
		blurhash: null,
		caption: null,
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	} as ServerIllustration;
}

test('mapServerBookToOfflineBook: переносит все поля', () => {
	const result = mapServerBookToOfflineBook(
		serverBook({
			title: 'Зов Ктулху',
			description: 'Повесть',
			coverUrl: 'https://cdn.example/covers/1.webp',
			blurhash: 'LEHV6nWB',
			themeColor: '1f2937',
			status: 'ongoing'
		})
	);
	assert.deepEqual(result, {
		id: 'book-1',
		title: 'Зов Ктулху',
		description: 'Повесть',
		coverUrl: 'https://cdn.example/covers/1.webp',
		blurhash: 'LEHV6nWB',
		themeColor: '1f2937',
		status: 'ongoing'
	});
});

test('mapServerBookToOfflineBook: coverUrl/status подставляются по умолчанию', () => {
	const result = mapServerBookToOfflineBook(serverBook());
	assert.equal(result.coverUrl, '');
	assert.equal(result.status, 'ongoing');
	assert.equal(result.blurhash, null);
	assert.equal(result.themeColor, null);
});

test('mapServerVolumeToOfflineVolume: переносит поля и считает лайки', () => {
	const result = mapServerVolumeToOfflineVolume(
		serverVolume({ likesCount: 12, coverUrl: 'https://cdn.example/covers/v.webp' })
	);
	assert.equal(result.id, 'vol-1');
	assert.equal(result.bookId, 'book-1');
	assert.equal(result.volumeNumber, 1);
	assert.equal(result.title, 'Том');
	assert.equal(result.coverUrl, 'https://cdn.example/covers/v.webp');
	assert.equal(result.likesCount, 12);
});

test('mapServerVolumeToOfflineVolume: дефолты для coverUrl и likesCount', () => {
	const result = mapServerVolumeToOfflineVolume(serverVolume());
	assert.equal(result.coverUrl, '');
	assert.equal(result.likesCount, 0);
});

test('mapServerChapterToOfflineChapter: переносит поля', () => {
	const result = mapServerChapterToOfflineChapter(
		serverChapter({
			chapterNumber: 3,
			title: 'Глава третья',
			telegramPostUrl: 'https://t.me/post',
			likesCount: 7
		})
	);
	assert.deepEqual(result, {
		id: 'ch-1',
		volumeId: 'vol-1',
		chapterNumber: 3,
		title: 'Глава третья',
		audioUrl: 'https://cdn.example/audio/1.mp3',
		durationSeconds: 3600,
		telegramPostUrl: 'https://t.me/post',
		likesCount: 7
	});
});

test('mapServerChapterToOfflineChapter: likesCount по умолчанию 0', () => {
	const result = mapServerChapterToOfflineChapter(serverChapter());
	assert.equal(result.likesCount, 0);
	assert.equal(result.telegramPostUrl, null);
});

test('mapServerIllustrationToOfflineIllustration: переносит все поля', () => {
	const result = mapServerIllustrationToOfflineIllustration(
		serverIllustration({
			imageUrl: 'https://cdn.example/ill/x.webp',
			blurhash: 'L4TjcG',
			caption: 'Иллюстрация',
			sortOrder: 2
		})
	);
	assert.deepEqual(result, {
		id: 'ill-1',
		volumeId: 'vol-1',
		imageUrl: 'https://cdn.example/ill/x.webp',
		blurhash: 'L4TjcG',
		caption: 'Иллюстрация',
		sortOrder: 2
	});
});
