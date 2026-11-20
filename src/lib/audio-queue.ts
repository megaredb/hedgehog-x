import type { Track } from '$lib/html-audio.js';

export type RepeatMode = 'none' | 'one' | 'all';

export type QueueNavigationParams = {
	queue: Track[];
	currentQueueIndex: number;
	shuffleEnabled: boolean;
	repeatMode: RepeatMode;
};

function getRandomShuffleIndex(queueLength: number, currentIndex: number): number {
	if (queueLength === 1) return 0;
	let idx: number;
	do {
		idx = Math.floor(Math.random() * queueLength);
	} while (idx === currentIndex);
	return idx;
}

function calculateQueueIndex(params: QueueNavigationParams & { direction: 1 | -1 }): number {
	const { queue, currentQueueIndex, shuffleEnabled, repeatMode, direction } = params;
	if (queue.length === 0) return -1;
	if (shuffleEnabled) {
		if (queue.length === 1) return repeatMode === 'none' ? -1 : 0;
		return getRandomShuffleIndex(queue.length, currentQueueIndex);
	}
	const next = currentQueueIndex + direction;
	if (next >= queue.length) return repeatMode === 'all' ? 0 : -1;
	if (next < 0) return repeatMode === 'all' ? queue.length - 1 : -1;
	return next;
}

export function calculateNextIndex(params: QueueNavigationParams): number {
	return calculateQueueIndex({ ...params, direction: 1 });
}

export function calculatePreviousIndex(params: QueueNavigationParams): number {
	return calculateQueueIndex({ ...params, direction: -1 });
}
