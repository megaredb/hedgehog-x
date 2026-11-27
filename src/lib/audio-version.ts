export const DEFAULT_AUDIO_VERSION = 'default';
export const OLD_AUDIO_VERSION = 'old';
export const MAX_AUDIO_VERSION_LENGTH = 64;

const SIMPLE_OPFS_ID_RE = /^[a-zA-Z0-9._-]+$/;

function isSimpleOpfsId(value: string): boolean {
	return value.length > 0 && value !== '.' && value !== '..' && SIMPLE_OPFS_ID_RE.test(value);
}

function encodeOpfsSegment(value: string): string {
	return encodeURIComponent(value).replace(/\./g, '%2E').replace(/~/g, '%7E');
}

/** Stable local key for per-version progress and likes. */
export function audioVersionKey(chapterId: string, versionId = DEFAULT_AUDIO_VERSION): string {
	const normalized = normalizeVersionId(versionId);
	return normalized === DEFAULT_AUDIO_VERSION ? chapterId : `${chapterId}::${normalized}`;
}

export function splitAudioVersionKey(key: string): { chapterId: string; versionId: string } {
	const index = key.lastIndexOf('::');
	if (index === -1) return { chapterId: key, versionId: DEFAULT_AUDIO_VERSION };
	return {
		chapterId: key.slice(0, index),
		versionId: normalizeVersionId(key.slice(index + 2))
	};
}

export function normalizeVersionId(value: unknown): string {
	if (typeof value !== 'string') return DEFAULT_AUDIO_VERSION;
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > MAX_AUDIO_VERSION_LENGTH) return DEFAULT_AUDIO_VERSION;
	return trimmed;
}

/**
 * Safe OPFS filename for a chapter/version pair.
 * Preserves backwards compatibility for simple default-version chapter IDs,
 * and uses collision-free percent-encoding for versions or unsafe characters.
 */
export function opfsAudioFileName(chapterId: string, versionId?: string | null): string {
	const normalizedVersion = normalizeVersionId(versionId);
	if (normalizedVersion === DEFAULT_AUDIO_VERSION && isSimpleOpfsId(chapterId)) {
		return chapterId;
	}
	if (normalizedVersion === DEFAULT_AUDIO_VERSION) {
		return `~${encodeOpfsSegment(chapterId)}`;
	}
	return `${encodeOpfsSegment(chapterId)}~${encodeOpfsSegment(normalizedVersion)}`;
}

export const BROADCAST_PROGRESS_PREFIX = 'broadcast-progress:';

/** Local progress key for a broadcast replay, isolated from chapter progress. */
export function broadcastProgressKey(broadcastId: string): string {
	return BROADCAST_PROGRESS_PREFIX + broadcastId;
}

export function isBroadcastProgressKey(key: string): boolean {
	return key.startsWith(BROADCAST_PROGRESS_PREFIX);
}
