import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_BOOKS, ensureDefaultBooks } from './seed';

describe('Database Seed Service', () => {
	test('содержит обязательные книги mushoku_tensei и overlord', () => {
		const bookIds = DEFAULT_BOOKS.map((b) => b.id);
		assert.ok(bookIds.includes('mushoku_tensei'), 'mushoku_tensei must be present');
		assert.ok(bookIds.includes('overlord'), 'overlord must be present');
		assert.equal(DEFAULT_BOOKS.length, 2);
	});

	test('все книги содержат валидные поля, обложки и hex цвета', () => {
		for (const book of DEFAULT_BOOKS) {
			assert.ok(book.id.length > 0);
			assert.ok(book.title.length > 0);
			assert.ok(book.description.length > 0);
			assert.ok(book.coverUrl.startsWith('/img/'));
			assert.ok(book.blurhash.length >= 20);
			assert.match(book.themeColor, /^[0-9a-fA-F]{6}$/);

			// Ensure cover file exists on disk
			const diskPath = path.resolve('static', book.coverUrl.replace(/^\//, ''));
			assert.ok(fs.existsSync(diskPath), `Файл обложки должен существовать на диске: ${diskPath}`);
		}
	});

	test('все тома содержат валидные главы, номера и аудиофайлы', () => {
		for (const book of DEFAULT_BOOKS) {
			assert.ok(book.volumes.length >= 2, `У книги ${book.id} должно быть минимум 2 тома`);

			for (const volume of book.volumes) {
				assert.equal(volume.bookId, book.id);
				assert.ok(volume.volumeNumber > 0);
				assert.ok(volume.title.length > 0);
				assert.ok(volume.chapters.length > 0, `У тома ${volume.id} должны быть главы`);

				for (const chapter of volume.chapters) {
					assert.equal(chapter.volumeId, volume.id);
					assert.ok(chapter.chapterNumber > 0);
					assert.ok(chapter.title.length > 0);
					assert.ok(chapter.durationSeconds > 0);
					assert.ok(chapter.audioUrl.length > 0);
				}
			}
		}
	});

	test('идемпотентная инициализация ensureDefaultBooks с мок-БД', async () => {
		const allInserted: unknown[] = [];

		const mockDb = {
			insert: () => ({
				values: (vals: unknown) => {
					allInserted.push(vals);
					return {
						onConflictDoNothing: async () => ({})
					};
				}
			})
		};

		await ensureDefaultBooks(mockDb as never);

		// 2 books + 4 volumes + 10 chapters + 4 illustrations = 20 records
		assert.equal(allInserted.length, 20);
	});
});
