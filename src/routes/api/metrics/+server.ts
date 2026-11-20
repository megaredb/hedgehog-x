import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from './$types';
import { renderPrometheus } from '$lib/server/metrics';

const startedAt = Date.now();

function matchesBearerToken(headerValue: string | null, expectedToken: string): boolean {
	if (!headerValue) return false;
	const expected = Buffer.from(`Bearer ${expectedToken}`, 'utf8');
	const actual = Buffer.from(headerValue, 'utf8');
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Minimal internal metrics endpoint. Admin session or METRICS_TOKEN is required;
 * no user content or identifiers are exposed.
 */
export const GET: RequestHandler = async ({ locals, request }) => {
	const token = process.env.METRICS_TOKEN;
	const authorized =
		locals.user?.role === 'admin' ||
		(!!token && matchesBearerToken(request.headers.get('authorization'), token));
	if (!authorized) return new Response('Forbidden', { status: 403 });

	const uptime = (Date.now() - startedAt) / 1000;
	const body = renderPrometheus([
		'# HELP hedgehog_uptime_seconds Process uptime in seconds.',
		'# TYPE hedgehog_uptime_seconds gauge',
		`hedgehog_uptime_seconds ${uptime.toFixed(3)}`,
		'# HELP hedgehog_nodejs_info Node.js version.',
		'# TYPE hedgehog_nodejs_info gauge',
		`hedgehog_nodejs_info{version="${process.version}"} 1`
	]);

	return new Response(body, {
		headers: {
			'content-type': 'text/plain; version=0.0.4; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};
