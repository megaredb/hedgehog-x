export const BROADCAST_CHECK_INTERVAL_MS = 5_000;

/**
 * The player must distinguish "broadcast was deleted" from transient network
 * and auth failures. Only an explicit 404 means the admin removed it; 401/403/
 * 5xx and offline errors must keep the current playback intact.
 */
export async function broadcastWasDeleted(
	broadcastId: string,
	fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch
): Promise<boolean> {
	if (!broadcastId) return false;
	try {
		const response = await fetchImpl(`/api/broadcasts/${encodeURIComponent(broadcastId)}/status`, {
			cache: 'no-store'
		});
		return response.status === 404;
	} catch {
		return false;
	}
}

export interface SavedBroadcastProgress {
	positionSeconds: number;
	kind: string;
	isCompleted: boolean;
}

/** Replay resumes from server progress; live always starts at the live edge. */
export function replayResumeOffset(
	progress: SavedBroadcastProgress | null | undefined,
	durationSeconds: number
): number {
	if (
		!progress ||
		progress.kind !== 'replay' ||
		progress.isCompleted ||
		!Number.isFinite(progress.positionSeconds) ||
		progress.positionSeconds <= 0
	) {
		return 0;
	}
	return Math.min(progress.positionSeconds, Math.max(0, durationSeconds));
}
