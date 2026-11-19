import { error, type RequestHandler } from '@sveltejs/kit';
import { getMediaObject } from '$lib/server/storage/r2';

function contentType(key: string, value?: string): string {
	if (value) return value;
	const ext = key.split('.').pop()?.toLowerCase();
	if (ext === 'mp3') return 'audio/mpeg';
	if (ext === 'webp') return 'image/webp';
	if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
	if (ext === 'png') return 'image/png';
	return 'application/octet-stream';
}

export const GET: RequestHandler = async ({ params, request }) => {
	const key = params.key?.trim();
	if (!key) throw error(404, 'Not found');

	try {
		const object = await getMediaObject(key, request.headers.get('range') ?? undefined);
		if (!object?.Body) throw error(404, 'Not found');
		const stream = object.Body.transformToWebStream();
		const headers = new Headers({
			'Content-Type': contentType(key, object.ContentType),
			'Accept-Ranges': 'bytes',
			'Cache-Control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		});
		if (object.ContentLength !== undefined) {
			headers.set('Content-Length', String(object.ContentLength));
		}
		if (object.ContentRange) headers.set('Content-Range', object.ContentRange);
		return new Response(stream, { status: object.ContentRange ? 206 : 200, headers });
	} catch (e) {
		if (typeof e === 'object' && e && 'status' in e) throw e;
		console.error('[media] Failed to read R2 object', key, e);
		throw error(404, 'Not found');
	}
};
