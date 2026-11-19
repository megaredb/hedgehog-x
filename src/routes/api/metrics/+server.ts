import type { RequestHandler } from './$types';

const startedAt = Date.now();

/**
 * Minimal internal metrics endpoint. Admin session or METRICS_TOKEN is required;
 * no user content or identifiers are exposed.
 */
export const GET: RequestHandler = async ({ locals, request }) => {
	const token = process.env.METRICS_TOKEN;
	const authorized =
		locals.user?.role === 'admin' ||
		(!!token && request.headers.get('authorization') === `Bearer ${token}`);
	if (!authorized) return new Response('Forbidden', { status: 403 });

	const uptime = (Date.now() - startedAt) / 1000;
	const body = [
		'# HELP hedgehog_up Whether the process is up.',
		'# TYPE hedgehog_up gauge',
		'hedgehog_up 1',
		'# HELP hedgehog_uptime_seconds Process uptime in seconds.',
		'# TYPE hedgehog_uptime_seconds gauge',
		`hedgehog_uptime_seconds ${uptime.toFixed(3)}`,
		'# HELP hedgehog_nodejs_info Node.js version.',
		'# TYPE hedgehog_nodejs_info gauge',
		`hedgehog_nodejs_info{version="${process.version}"} 1`,
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'content-type': 'text/plain; version=0.0.4; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};
