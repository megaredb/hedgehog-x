/** Safe Content-Length parser; missing/invalid headers mean unknown size. */
export function parseContentLength(value: string | null): number {
	if (!value) return 0;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Keep a safety reserve so downloads don't fill the whole quota. */
export function hasEnoughDownloadSpace(
	availableBytes: number,
	requiredBytes: number,
	reserveBytes = 50 * 1024 * 1024
): boolean {
	if (!Number.isFinite(availableBytes) || !Number.isFinite(requiredBytes)) return true;
	return availableBytes >= requiredBytes + reserveBytes;
}

/** Adds the cache-bypass marker used by the download pipeline. */
export function buildCorsUrl(url: string, baseUrl: string): string {
	const parsed = new URL(url, baseUrl);
	parsed.searchParams.set('_cors', '1');
	return parsed.toString();
}
