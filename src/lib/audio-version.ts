export const DEFAULT_AUDIO_VERSION = 'default';
export const OLD_AUDIO_VERSION = 'old';

/** Stable local key for per-version progress and likes. */
export function audioVersionKey(chapterId: string, versionId = DEFAULT_AUDIO_VERSION): string {
	return versionId === DEFAULT_AUDIO_VERSION ? chapterId : `${chapterId}::${versionId}`;
}

export function splitAudioVersionKey(key: string): { chapterId: string; versionId: string } {
	const index = key.lastIndexOf('::');
	if (index === -1) return { chapterId: key, versionId: DEFAULT_AUDIO_VERSION };
	return {
		chapterId: key.slice(0, index),
		versionId: key.slice(index + 2) || DEFAULT_AUDIO_VERSION
	};
}

export function normalizeVersionId(value: unknown): string {
	return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_AUDIO_VERSION;
}

export const BROADCAST_PROGRESS_PREFIX = 'broadcast-progress:';

/** Local progress key for a broadcast replay, isolated from chapter progress. */
export function broadcastProgressKey(broadcastId: string): string {
	return BROADCAST_PROGRESS_PREFIX + broadcastId;
}

export function isBroadcastProgressKey(key: string): boolean {
	return key.startsWith(BROADCAST_PROGRESS_PREFIX);
}
