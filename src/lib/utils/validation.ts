/** Trimmed, non-empty bounded string or null. */
export function boundedText(value: unknown, max = 128): string | null {
	if (typeof value !== 'string') return null;
	const result = value.trim();
	return result.length > 0 && result.length <= max ? result : null;
}

/** Finite non-negative seconds (max 24h), floored, or null. */
export function timestampSeconds(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 86_400)
		return null;
	return Math.floor(value);
}
