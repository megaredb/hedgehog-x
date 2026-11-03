import { describe, it } from 'node:test';
import assert from 'node:assert';
import sharp from 'sharp';
import { decode } from 'blurhash';
import { uploadImage, uploadAudio, deleteFromStorage } from './r2';

describe('R2 & Image Processing Storage Service', () => {
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
});
