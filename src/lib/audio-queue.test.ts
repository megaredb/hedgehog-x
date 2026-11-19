import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateNextIndex, calculatePreviousIndex } from './audio-queue';

const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as never[];
const base = { queue, currentQueueIndex: 1, shuffleEnabled: false, repeatMode: 'none' as const };

test('next/previous move linearly and stop at edges without repeat', () => {
	assert.equal(calculateNextIndex(base), 2);
	assert.equal(calculatePreviousIndex(base), 0);
	assert.equal(calculateNextIndex({ ...base, currentQueueIndex: 2 }), -1);
	assert.equal(calculatePreviousIndex({ ...base, currentQueueIndex: 0 }), -1);
});

test('repeat all wraps around', () => {
	assert.equal(calculateNextIndex({ ...base, currentQueueIndex: 2, repeatMode: 'all' }), 0);
	assert.equal(calculatePreviousIndex({ ...base, currentQueueIndex: 0, repeatMode: 'all' }), 2);
});

test('empty queue and shuffle single item are safe', () => {
	assert.equal(calculateNextIndex({ ...base, queue: [] }), -1);
	assert.equal(
		calculateNextIndex({
			...base,
			queue: [{ id: 'a' }] as never[],
			currentQueueIndex: 0,
			shuffleEnabled: true
		}),
		-1
	);
	assert.equal(
		calculateNextIndex({
			...base,
			queue: [{ id: 'a' }] as never[],
			currentQueueIndex: 0,
			shuffleEnabled: true,
			repeatMode: 'all'
		}),
		0
	);
});
