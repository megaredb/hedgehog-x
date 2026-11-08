import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Volume completion audio and jingle assets', () => {
	it('volume-complete.mp3 exists in static/audio and is a valid non-empty audio file', () => {
		const filePath = path.resolve('static/audio/volume-complete.mp3');
		assert.ok(fs.existsSync(filePath), 'volume-complete.mp3 must exist in static/audio');

		const stats = fs.statSync(filePath);
		assert.ok(
			stats.size > 1000,
			`volume-complete.mp3 should have substantial size, got ${stats.size} bytes`
		);

		// Read first few bytes to verify ID3 or MPEG sync header
		const buffer = Buffer.alloc(10);
		const fd = fs.openSync(filePath, 'r');
		fs.readSync(fd, buffer, 0, 10, 0);
		fs.closeSync(fd);

		const isId3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33; // 'ID3'
		const isMpegSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;

		assert.ok(
			isId3 || isMpegSync,
			`File must start with ID3 tag or MPEG sync header, got: ${buffer.subarray(0, 4).toString('hex')}`
		);
	});
});
