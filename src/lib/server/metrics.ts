type CounterKey = 'httpRequests' | 'httpErrors' | 'syncRequests' | 'syncErrors' | 'serverErrors';

const counters: Record<CounterKey, number> = {
	httpRequests: 0,
	httpErrors: 0,
	syncRequests: 0,
	syncErrors: 0,
	serverErrors: 0
};

let requestDurationMs = 0;

export function recordHttpRequest(status: number, durationMs: number): void {
	counters.httpRequests++;
	requestDurationMs += Math.max(0, durationMs);
	if (status >= 500) counters.httpErrors++;
}

export function recordSyncRequest(status: number): void {
	counters.syncRequests++;
	if (status >= 400) counters.syncErrors++;
}

export function recordServerError(): void {
	counters.serverErrors++;
}

export function renderPrometheus(extra: string[] = []): string {
	const lines = [
		'# HELP hedgehog_up Whether the process is up.',
		'# TYPE hedgehog_up gauge',
		'hedgehog_up 1',
		'# HELP hedgehog_http_requests_total HTTP requests handled.',
		'# TYPE hedgehog_http_requests_total counter',
		`hedgehog_http_requests_total ${counters.httpRequests}`,
		'# HELP hedgehog_http_errors_total HTTP 5xx responses.',
		'# TYPE hedgehog_http_errors_total counter',
		`hedgehog_http_errors_total ${counters.httpErrors}`,
		'# HELP hedgehog_http_request_duration_seconds_sum Total request duration.',
		'# TYPE hedgehog_http_request_duration_seconds_sum counter',
		`hedgehog_http_request_duration_seconds_sum ${(requestDurationMs / 1000).toFixed(3)}`,
		'# HELP hedgehog_http_request_duration_seconds_count Request duration samples.',
		'# TYPE hedgehog_http_request_duration_seconds_count counter',
		`hedgehog_http_request_duration_seconds_count ${counters.httpRequests}`,
		'# HELP hedgehog_sync_requests_total User sync requests.',
		'# TYPE hedgehog_sync_requests_total counter',
		`hedgehog_sync_requests_total ${counters.syncRequests}`,
		'# HELP hedgehog_sync_errors_total User sync 4xx/5xx responses.',
		'# TYPE hedgehog_sync_errors_total counter',
		`hedgehog_sync_errors_total ${counters.syncErrors}`,
		'# HELP hedgehog_server_errors_total Unhandled server errors.',
		'# TYPE hedgehog_server_errors_total counter',
		`hedgehog_server_errors_total ${counters.serverErrors}`,
		...extra
	];
	return lines.join('\n') + '\n';
}
