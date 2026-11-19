export const SEEK_STEPS = [5, 10, 15, 30] as const;
export type SeekStep = (typeof SEEK_STEPS)[number];

export const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export function parseSeekStep(raw: string | null): SeekStep | null {
	if (raw === null) return null;
	const value = Number(raw);
	return (SEEK_STEPS as readonly number[]).includes(value) ? (value as SeekStep) : null;
}

export function parsePlaybackRate(raw: string | null): PlaybackRate | null {
	if (raw === null) return null;
	const value = Number(raw);
	return (PLAYBACK_RATES as readonly number[]).includes(value) ? (value as PlaybackRate) : null;
}

export function parseAutoAdvance(raw: string | null): boolean | null {
	if (raw === 'true') return true;
	if (raw === 'false') return false;
	return null;
}

export function isValidSeekStep(val: unknown): val is SeekStep {
	return typeof val === 'number' && (SEEK_STEPS as readonly number[]).includes(val);
}

export function isValidPlaybackRate(val: unknown): val is PlaybackRate {
	return typeof val === 'number' && (PLAYBACK_RATES as readonly number[]).includes(val);
}
