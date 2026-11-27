#!/usr/bin/env node
/**
 * Lightweight broadcast polling load test.
 *
 * Usage:
 *   node scripts/load-test-broadcast.mjs --url https://hedgehog-inc.localhost --concurrency 50 --duration 15
 *
 * For authenticated endpoints pass --cookie 'session=...' and --path '/api/broadcasts/<id>/state'.
 * The script intentionally has no dependencies and does not write to the database.
 */
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
	args.set(process.argv[i]?.replace(/^--/, ''), process.argv[i + 1]);
}

function parseNumericArg(raw, fallback, min, name) {
	if (raw === undefined) return fallback;
	const value = Number(raw);
	if (!Number.isFinite(value)) {
		console.error(`Invalid numeric value for --${name}: ${raw}`);
		process.exit(1);
	}
	return Math.max(min, value);
}

const baseUrl = (args.get('url') ?? 'http://127.0.0.1:5180').replace(/\/$/, '');
const path = args.get('path') ?? '/api/broadcasts/active';
const concurrency = Math.floor(parseNumericArg(args.get('concurrency'), 50, 1, 'concurrency'));
const durationSeconds = parseNumericArg(args.get('duration'), 15, 1, 'duration');
const intervalMs = parseNumericArg(args.get('interval'), 2000, 100, 'interval');
const cookie = args.get('cookie') ?? process.env.COOKIE;
const url = baseUrl + path;
const headers = cookie ? { cookie } : {};
const latencies = [];
let ok = 0;
let failed = 0;
let bytes = 0;
const deadline = Date.now() + durationSeconds * 1000;

async function worker() {
	while (Date.now() < deadline) {
		const started = performance.now();
		try {
			const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
			const body = await response.arrayBuffer();
			if (!response.ok) throw new Error('HTTP ' + response.status);
			ok++;
			bytes += body.byteLength;
		} catch {
			failed++;
		} finally {
			latencies.push(performance.now() - started);
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}

function percentile(values, p) {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

console.log(
	`Load test: ${url} | concurrency=${concurrency} duration=${durationSeconds}s interval=${intervalMs}ms`
);
const startedAt = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const elapsed = (performance.now() - startedAt) / 1000;
const total = ok + failed;
console.log(
	JSON.stringify(
		{
			requests: total,
			ok,
			failed,
			rps: Number((total / elapsed).toFixed(2)),
			avgMs: Number(
				(latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length)).toFixed(1)
			),
			p50Ms: Number(percentile(latencies, 0.5).toFixed(1)),
			p95Ms: Number(percentile(latencies, 0.95).toFixed(1)),
			p99Ms: Number(percentile(latencies, 0.99).toFixed(1)),
			maxMs: Number(latencies.reduce((max, value) => (value > max ? value : max), 0).toFixed(1)),
			responseMiB: Number((bytes / 1024 / 1024).toFixed(2)),
			elapsedSeconds: Number(elapsed.toFixed(1))
		},
		null,
		2
	)
);
