import assert from 'node:assert/strict';
import test from 'node:test';
import {
	illustrationChapterIds,
	isIllustrationChapterLocked,
	type ChapterIllustrationTiming
} from './illustration-lock';

const timings: ChapterIllustrationTiming[] = [
	{ chapterId: 'ch-1', illustrationId: 'ill-1', showAtSeconds: 0 },
	{ chapterId: 'ch-1', illustrationId: 'ill-2', showAtSeconds: 30 },
	{ chapterId: 'ch-2', illustrationId: 'ill-3', showAtSeconds: 10 }
];

test('returns all chapters that own an illustration', () => {
	assert.deepEqual(illustrationChapterIds('ill-1', timings), ['ch-1']);
	assert.deepEqual(illustrationChapterIds('missing', timings), []);
});

test('locks chapter illustrations until a related chapter is played', () => {
	assert.equal(isIllustrationChapterLocked('ill-1', timings, new Set()), true);
	assert.equal(isIllustrationChapterLocked('ill-1', timings, new Set(['ch-1'])), false);
	assert.equal(isIllustrationChapterLocked('ill-3', timings, new Set(['ch-1'])), true);
});

test('does not lock volume-level illustrations without chapter timing', () => {
	assert.equal(isIllustrationChapterLocked('volume-art', timings, new Set()), false);
});
