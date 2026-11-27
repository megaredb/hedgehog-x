import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { decode } from 'blurhash';
import {
	uploadImage,
	uploadAudio,
	deleteFromStorage,
	audioContentTypeForExt,
	videoContentTypeForExt,
	resolveLocalUploadPath,
	StorageValidationError
} from './r2';

const r2Configured = Boolean(process.env.R2_ACCESS_KEY_ID && process.env.R2_BUCKET_NAME);
const testUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hedgehog-uploads-'));
process.env.LOCAL_UPLOAD_DIR = testUploadDir;

after(() => fs.rmSync(testUploadDir, { recursive: true, force: true }));

// Unit tests must not upload to a real bucket or leave files in static/uploads.
describe('R2 & Image Processing Storage Service', { skip: r2Configured }, () => {
	it('converts an image buffer to webp and computes a valid blurhash', async () => {
		// Create a 100x100 test PNG image
		const sampleBuffer = await sharp({
			create: {
				width: 100,
				height: 100,
				channels: 4,
				background: { r: 255, g: 100, b: 50, alpha: 1 }
			}
		})
			.png()
			.toBuffer();

		const result = await uploadImage(sampleBuffer, { folder: 'test' });

		assert.ok(result.url.endsWith('.webp'), 'Image URL should end with .webp');
		assert.ok(result.blurhash.length > 5, 'Blurhash should be generated');
		assert.strictEqual(typeof result.themeColor, 'string', 'Theme color should be extracted');

		// Check if blurhash decodes without error
		const decodedPixels = decode(result.blurhash, 32, 32);
		assert.strictEqual(decodedPixels.length, 32 * 32 * 4);

		// Clean up uploaded file
		await deleteFromStorage(result.url);
	});

	it('uploads audio buffer correctly', async () => {
		const sampleAudio = Buffer.from('RIFF mock audio buffer data');
		const result = await uploadAudio(sampleAudio, {
			originalFilename: 'test.mp3',
			folder: 'test-audio'
		});

		assert.ok(result.url.endsWith('.mp3'), 'Audio URL should end with .mp3');

		// Clean up
		await deleteFromStorage(result.url);
	});

	it('does not duplicate filenamePrefix on local image fallback', async () => {
		const sampleBuffer = await sharp({
			create: {
				width: 16,
				height: 16,
				channels: 4,
				background: { r: 10, g: 20, b: 30, alpha: 1 }
			}
		})
			.png()
			.toBuffer();

		const result = await uploadImage(sampleBuffer, {
			folder: 'test-prefix',
			filenamePrefix: 'cover'
		});
		const expectedFile = path.join(testUploadDir, result.key);
		assert.ok(fs.existsSync(expectedFile), `Expected file at ${expectedFile}`);
		assert.strictEqual(await deleteFromStorage(result.url), true);
		assert.ok(!fs.existsSync(expectedFile));
	});

	it('blocks path traversal on local upload and delete', async () => {
		const outsideFile = path.join(os.tmpdir(), `hedgehog-outside-${Date.now()}.txt`);
		fs.writeFileSync(outsideFile, 'do-not-delete');
		try {
			const relTraversal = path.relative(testUploadDir, outsideFile).split(path.sep).join('/');
			assert.strictEqual(resolveLocalUploadPath(testUploadDir, relTraversal), null);
			assert.strictEqual(resolveLocalUploadPath(testUploadDir, '/etc/passwd'), null);
			assert.strictEqual(resolveLocalUploadPath(testUploadDir, 'a/../../b.txt'), null);
			assert.strictEqual(await deleteFromStorage(relTraversal), false);
			assert.strictEqual(await deleteFromStorage(outsideFile), false);
			assert.strictEqual(await deleteFromStorage('https://evil.example/books/a.webp'), false);
			assert.ok(fs.existsSync(outsideFile), 'Outside file must not be deleted');

			const sampleAudio = Buffer.from('RIFF mock audio buffer data');
			await assert.rejects(
				() => uploadAudio(sampleAudio, { folder: '../escape', originalFilename: 'x.mp3' }),
				StorageValidationError
			);
		} finally {
			fs.rmSync(outsideFile, { force: true });
		}
	});

	it('maps audio and video extensions to strict allowlisted content types', () => {
		assert.strictEqual(audioContentTypeForExt('.mp3'), 'audio/mpeg');
		assert.strictEqual(audioContentTypeForExt('.ogg'), 'audio/ogg');
		assert.strictEqual(audioContentTypeForExt('.html'), 'audio/mpeg');
		assert.strictEqual(videoContentTypeForExt('.webm'), 'video/webm');
		assert.strictEqual(videoContentTypeForExt('.svg'), 'video/mp4');
	});
});
