/**
 * Helpers for audio timecodes such as "16:28" or "1:02:03".
 */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/**
 * Formats seconds into a timecode.
 * Under an hour it returns `m:ss`, otherwise `h:mm:ss`.
 */
export function formatTimecode(totalSeconds: number): string {
	if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';

	const total = Math.floor(totalSeconds);
	const hours = Math.floor(total / SECONDS_PER_HOUR);
	const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
	const seconds = total % SECONDS_PER_MINUTE;
	const paddedSeconds = String(seconds).padStart(2, '0');

	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
	}
	return `${minutes}:${paddedSeconds}`;
}

/**
 * Formats a bookmark range: `start–end` when an end is present,
 * otherwise just the start timecode.
 */
export function formatTimeRange(start: number, end?: number | null): string {
	if (end != null && end > start) {
		return `${formatTimecode(start)}–${formatTimecode(end)}`;
	}
	return formatTimecode(start);
}

/**
 * Parses a `m:ss` or `h:mm:ss` timecode into seconds.
 * Returns null for empty, malformed, or out-of-range input
 * (minutes and seconds must be below 60).
 */
export function parseTimecode(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const parts = trimmed.split(':');
	if (parts.length < 2 || parts.length > 3) return null;
	if (parts.some((part) => !/^\d+$/.test(part))) return null;

	const numbers = parts.map(Number);
	const hours = parts.length === 3 ? numbers[0] : 0;
	const minutes = parts.length === 3 ? numbers[1] : numbers[0];
	const seconds = parts.length === 3 ? numbers[2] : numbers[1];

	if (minutes >= SECONDS_PER_MINUTE || seconds >= SECONDS_PER_MINUTE) return null;

	return hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds;
}
