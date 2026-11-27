import { json, type RequestHandler } from '@sveltejs/kit';

function publicOrigin(url: URL, request: Request): string {
	const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
	const host = forwardedHost || request.headers.get('host') || url.host;
	const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
	const proto =
		forwardedProto ||
		(host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
	return `${proto}://${host}`;
}

export const GET: RequestHandler = ({ url, request }) => {
	const origin = publicOrigin(url, request);
	return json(
		{
			url: origin,
			name: 'HEDGEHOG.INC',
			iconUrl: `${origin}/tonconnect-icon.png`
		},
		{
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Cache-Control': 'no-store'
			}
		}
	);
};
