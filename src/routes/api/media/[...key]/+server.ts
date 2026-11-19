import { error, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { getMediaObject } from '$lib/server/storage/r2';

const CACHE_DIR = process.env.MEDIA_CACHE_DIR ?? '/tmp/hedgehog-media';

function contentType(key: string, value?: string): string {
	if (value) return value;
	const ext = key.split('.').pop()?.toLowerCase();
	if (ext === 'mp3') return 'audio/mpeg';
	if (ext === 'webp') return 'image/webp';
	if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
	if (ext === 'png') return 'image/png';
	return 'application/octet-stream';
}

function cachePath(key: string): string | null {
	const target = path.resolve(CACHE_DIR, key);
	const root = path.resolve(CACHE_DIR) + path.sep;
	return target.startsWith(root) ? target : null;
}

async function serveLocal(
	filePath: string,
	key: string,
	range: string | null
): Promise<Response | null> {
	try {
		const stat = await fsp.stat(filePath);
		const headers = new Headers({
			'Content-Type': contentType(key),
			'Accept-Ranges': 'bytes',
			'Cache-Control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		});
		if (!range) {
			headers.set('Content-Length', String(stat.size));
			return new Response(Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream, {
				headers
			});
		}
		const match = /^bytes=(\d*)-(\d*)$/.exec(range);
		if (!match) return null;
		const start = match[1] ? Number(match[1]) : 0;
		const end = match[2] ? Number(match[2]) : stat.size - 1;
		if (start > end || end >= stat.size) return null;
		headers.set('Content-Length', String(end - start + 1));
		headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
		return new Response(
			Readable.toWeb(fs.createReadStream(filePath, { start, end })) as ReadableStream,
			{ status: 206, headers }
		);
	} catch {
		return null;
	}
}

async function cacheImage(key: string, bytes: Uint8Array): Promise<void> {
	if (!/\.(?:webp|png|jpe?g)$/i.test(key)) return;
	const target = cachePath(key);
	if (!target) return;
	try {
		await fsp.mkdir(path.dirname(target), { recursive: true });
		await fsp.writeFile(target, bytes);
	} catch {
		// Cache is best-effort; R2 remains the source of truth.
	}
}

export const GET: RequestHandler = async ({ params, request }) => {
	const key = params.key?.trim();
	if (!key) throw error(404, 'Not found');

	const target = cachePath(key);
	if (target) {
		const local = await serveLocal(target, key, request.headers.get('range'));
		if (local) return local;
	}

	try {
		const object = await getMediaObject(key, request.headers.get('range') ?? undefined);
		if (!object?.Body) throw error(404, 'Not found');
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

		if (target && !object.ContentRange && /\.(?:webp|png|jpe?g)$/i.test(key)) {
			const bytes = await object.Body.transformToByteArray();
			await cacheImage(key, bytes);
			return new Response(bytes as unknown as BodyInit, { status: 200, headers });
		}

		return new Response(object.Body.transformToWebStream(), {
			status: object.ContentRange ? 206 : 200,
			headers
		});
	} catch (e) {
		if (typeof e === 'object' && e && 'status' in e) throw e;
		console.error('[media] Failed to read R2 object', key, e);
		throw error(404, 'Not found');
	}
};
