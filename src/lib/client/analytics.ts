/**
 * Client analytics helper for Umami integration and listening heartbeat dispatch.
 */

declare global {
	interface Window {
		umami?: {
			track: (eventName: string, eventData?: Record<string, unknown>) => void;
		};
	}
}

/**
 * Safely track custom events in Umami analytics if available.
 * Does not throw errors on server side or if Umami is blocked/not loaded.
 */
export function trackEvent(eventName: string, eventData?: Record<string, unknown>): void {
	if (typeof window === 'undefined') return;

	try {
		const umami = window.umami;
		if (umami && typeof umami.track === 'function') {
			umami.track(eventName, eventData);
		}
	} catch (err) {
		// Analytics errors should never break user interactions
		console.warn('[analytics] Failed to track event:', eventName, err);
	}
}

export interface ListenHeartbeatPayload {
	chapterId: string;
	bookId?: string;
	volumeId?: string;
	listenedSeconds: number;
	startedAt?: string;
}

export interface ListenHeartbeatBatchPayload {
	sessions: ListenHeartbeatPayload[];
}

/**
 * Dispatches a listening duration heartbeat to /api/analytics/listen.
 * Supports both single session payloads and batch session payloads.
 * Returns true if accepted, false on network or validation errors.
 */
export async function sendListenHeartbeat(
	payload: ListenHeartbeatPayload | ListenHeartbeatBatchPayload
): Promise<boolean> {
	if (typeof window === 'undefined') return false;

	try {
		const response = await fetch('/api/analytics/listen', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		return response.ok;
	} catch {
		return false;
	}
}
