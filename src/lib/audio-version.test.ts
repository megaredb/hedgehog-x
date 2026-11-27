import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	DEFAULT_AUDIO_VERSION,
	MAX_AUDIO_VERSION_LENGTH,
	normalizeVersionId,
	opfsAudioFileName
} from './audio-version';

describe('audio-version', () => {
	describe('normalizeVersionId', () => {
		it('defaults for non-strings, empty strings, and whitespace', () => {
			assert.equal(normalizeVersionId(undefined), DEFAULT_AUDIO_VERSION);
			assert.equal(normalizeVersionId(null), DEFAULT_AUDIO_VERSION);
			assert.equal(normalizeVersionId(123), DEFAULT_AUDIO_VERSION);
			assert.equal(normalizeVersionId(''), DEFAULT_AUDIO_VERSION);
			assert.equal(normalizeVersionId('   '), DEFAULT_AUDIO_VERSION);
		});

		it('trims valid version IDs up to 64 characters', () => {
			assert.equal(normalizeVersionId('  old  '), 'old');
			const maxValid = 'a'.repeat(MAX_AUDIO_VERSION_LENGTH);
			assert.equal(normalizeVersionId(maxValid), maxValid);
		});

		it('falls back to default when versionId exceeds 64 characters', () => {
			const tooLong = 'a'.repeat(MAX_AUDIO_VERSION_LENGTH + 1);
			assert.equal(normalizeVersionId(tooLong), DEFAULT_AUDIO_VERSION);
		});
	});

	describe('opfsAudioFileName', () => {
		it('preserves simple default-version chapter IDs for backwards compatibility', () => {
			assert.equal(opfsAudioFileName('ch-1'), 'ch-1');
			assert.equal(opfsAudioFileName('ch_1.2', 'default'), 'ch_1.2');
			assert.equal(
				opfsAudioFileName('550e8400-e29b-41d4-a716-446655440000', null),
				'550e8400-e29b-41d4-a716-446655440000'
			);
		});

		it('encodes non-default versions safely without path separators or collisions', () => {
			const vOld = opfsAudioFileName('ch-1', 'old');
			assert.notEqual(vOld, 'ch-1');
			assert.ok(!vOld.includes('/'));
			assert.ok(!vOld.includes('\\'));
			assert.ok(!vOld.includes(':'));

			// Different (chapterId, versionId) pairs must not collide
			assert.notEqual(opfsAudioFileName('a~b', 'c'), opfsAudioFileName('a', 'b~c'));
			assert.notEqual(opfsAudioFileName('a::b', 'default'), opfsAudioFileName('a', 'b'));
			assert.notEqual(opfsAudioFileName('ch-1', 'old'), opfsAudioFileName('ch-1~old', 'default'));
		});

		it('safely encodes traversal and special characters in chapterId and versionId', () => {
			for (const unsafe of ['.', '..', '../secret', 'dir/file', 'a\\b', 'ch:1?x=1']) {
				const name = opfsAudioFileName(unsafe, 'default');
				assert.notEqual(name, '.');
				assert.notEqual(name, '..');
				assert.ok(!name.includes('/'));
				assert.ok(!name.includes('\\'));
				assert.ok(!name.includes(':'));

				const versioned = opfsAudioFileName(unsafe, 'v/1:old');
				assert.ok(!versioned.includes('/'));
				assert.ok(!versioned.includes('\\'));
				assert.ok(!versioned.includes(':'));
			}
		});

		it('normalizes overly long versionId to default', () => {
			const tooLong = 'v'.repeat(MAX_AUDIO_VERSION_LENGTH + 1);
			assert.equal(opfsAudioFileName('ch-1', tooLong), 'ch-1');
		});
	});
});
