import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { getMediaObject } from '$lib/server/storage/r2';
import { directMediaUrl, loadMediaSettings } from '$lib/server/site-settings';

const CACHE_DIR = process.env.MEDIA_CACHE_DIR ?? '/tmp/hedgehog-media';
const MAX_CACHE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CACHE_TOTAL_BYTES = Number(process.env.MEDIA_CACHE_MAX_BYTES ?? 100 * 1024 * 1024);

const MAX_MEDIA_KEY_LENGTH = 2048;

const ALLOWED_IMAGE_MIME = new Set([
	'image/webp',
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/avif'
]);

const EXT_TO_MIME: Record<string, string> = {
	webp: 'image/webp',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	avif: 'image/avif',
	mp3: 'audio/mpeg',
	m4a: 'audio/mp4',
	ogg: 'audio/ogg',
	opus: 'audio/opus',
	wav: 'audio/wav',
	aac: 'audio/aac',
	mp4: 'video/mp4',
	webm: 'video/webm',
	mov: 'video/quicktime',
	m4v: 'video/x-m4v'
};

function hasControlChars(value: string): boolean {
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code < 0x20 || code === 0x7f) return true;
	}
	return false;
}

function isAllowedMediaKey(key: string): boolean {
	if (
		!key ||
		key.length > MAX_MEDIA_KEY_LENGTH ||
		key.startsWith('/') ||
		key.includes('\\') ||
		key.includes('://') ||
		hasControlChars(key)
	)
		return false;
	const segments = key.split('/');
	if (segments.some((seg) => seg === '' || seg === '.' || seg === '..')) return false;
	return true;
}

function isAllowedMime(rawMime: string): boolean {
	const mime = rawMime.split(';')[0]?.trim().toLowerCase() ?? '';
	if (ALLOWED_IMAGE_MIME.has(mime)) return true;
	if (/^audio\/[a-z0-9.+-]+$/i.test(mime)) return true;
	if (/^video\/[a-z0-9.+-]+$/i.test(mime)) return true;
	return false;
}

function resolveMediaContentType(
	key: string,
	upstreamType?: string
): { contentType: string; attachment: boolean } {
	if (upstreamType) {
		const normalized = upstreamType.split(';')[0]?.trim().toLowerCase() ?? '';
		if (isAllowedMime(normalized)) {
			return { contentType: normalized, attachment: false };
		}
	}
	const ext = key.split('.').pop()?.toLowerCase() ?? '';
	const fromExt = EXT_TO_MIME[ext];
	if (fromExt && isAllowedMime(fromExt)) {
		if (ext === 'mp4' && key.startsWith('audio/')) {
			return { contentType: 'audio/mp4', attachment: false };
		}
		return { contentType: fromExt, attachment: false };
	}
	return { contentType: 'application/octet-stream', attachment: true };
}

function buildMediaHeaders(key: string, upstreamType?: string): Headers {
	const { contentType, attachment } = resolveMediaContentType(key, upstreamType);
	const headers = new Headers({
		'Content-Type': contentType,
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'public, max-age=31536000, immutable',
		'Content-Security-Policy': "default-src 'none'; sandbox",
		'X-Content-Type-Options': 'nosniff'
	});
	if (attachment) {
		headers.set('Content-Disposition', 'attachment');
	}
	return headers;
}

interface ParsedRange {
	start: number;
	end: number;
}

function parseByteRangeSyntax(range: string): { start: number | null; end: number | null } | null {
	const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
	if (!match) return null;
	const [, rawStart, rawEnd] = match;
	if (!rawStart && !rawEnd) return null;
	const start = rawStart ? Number(rawStart) : null;
	const end = rawEnd ? Number(rawEnd) : null;
	if (start !== null && (!Number.isSafeInteger(start) || start < 0)) return null;
	if (end !== null && (!Number.isSafeInteger(end) || end < 0)) return null;
	if (start === null && (end === null || end === 0)) return null;
	if (start !== null && end !== null && start > end) return null;
	return { start, end };
}

function resolveByteRange(range: string, size: number): ParsedRange | null {
	if (size <= 0) return null;
	const parsed = parseByteRangeSyntax(range);
	if (!parsed) return null;
	if (parsed.start === null) {
		// Suffix range: bytes=-N
		const suffixLength = parsed.end!;
		const start = Math.max(0, size - suffixLength);
		return { start, end: size - 1 };
	}
	const start = parsed.start;
	if (start >= size) return null;
	const end = parsed.end !== null ? Math.min(parsed.end, size - 1) : size - 1;
	if (start > end) return null;
	return { start, end };
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
	let stat: fs.Stats;
	try {
		stat = await fsp.stat(filePath);
	} catch {
		return null;
	}

	const headers = buildMediaHeaders(key);
	if (!range) {
		headers.set('Content-Length', String(stat.size));
		return new Response(Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream, {
			headers
		});
	}

	const resolved = resolveByteRange(range, stat.size);
	if (!resolved) {
		return new Response('Range Not Satisfiable', {
			status: 416,
			headers: { 'Content-Range': `bytes */${stat.size}` }
		});
	}

	headers.set('Content-Length', String(resolved.end - resolved.start + 1));
	headers.set('Content-Range', `bytes ${resolved.start}-${resolved.end}/${stat.size}`);
	return new Response(
		Readable.toWeb(
			fs.createReadStream(filePath, { start: resolved.start, end: resolved.end })
		) as ReadableStream,
		{ status: 206, headers }
	);
}

async function collectCacheFiles(
	dir: string
): Promise<Array<{ filePath: string; size: number; mtimeMs: number }>> {
	const results: Array<{ filePath: string; size: number; mtimeMs: number }> = [];
	let entries: fs.Dirent[];
	try {
		entries = await fsp.readdir(dir, { withFileTypes: true });
	} catch {
		return results;
	}
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await collectCacheFiles(fullPath)));
		} else if (entry.isFile()) {
			const stat = await fsp.stat(fullPath).catch(() => null);
			if (stat) results.push({ filePath: fullPath, size: stat.size, mtimeMs: stat.mtimeMs });
		}
	}
	return results;
}

let pruningCache = false;
async function pruneCacheIfNeeded(): Promise<void> {
	if (pruningCache) return;
	pruningCache = true;
	try {
		const files = await collectCacheFiles(CACHE_DIR);
		let total = files.reduce((sum, f) => sum + f.size, 0);
		if (total <= MAX_CACHE_TOTAL_BYTES) return;
		files.sort((a, b) => a.mtimeMs - b.mtimeMs);
		for (const file of files) {
			if (total <= MAX_CACHE_TOTAL_BYTES) break;
			await fsp.unlink(file.filePath).catch(() => {});
			total -= file.size;
		}
	} finally {
		pruningCache = false;
	}
}

async function cacheImage(key: string, bytes: Uint8Array): Promise<void> {
	if (!/\.(?:webp|png|jpe?g)$/i.test(key)) return;
	if (bytes.byteLength > MAX_CACHE_FILE_BYTES) return;
	const target = cachePath(key);
	if (!target) return;
	const tmp = `${target}.${randomUUID()}.tmp`;
	try {
		await fsp.mkdir(path.dirname(target), { recursive: true });
		await fsp.writeFile(tmp, bytes);
		await fsp.rename(tmp, target);
		void pruneCacheIfNeeded();
	} catch {
		await fsp.unlink(tmp).catch(() => {});
		// Cache is best-effort; R2 remains the source of truth.
	}
}

export const GET: RequestHandler = async ({ params, request }) => {
	const key = params.key?.trim();
	if (!key || !isAllowedMediaKey(key)) throw error(404, 'Not found');

	const rangeHeader = request.headers.get('range');
	if (rangeHeader && !parseByteRangeSyntax(rangeHeader)) {
		return new Response('Range Not Satisfiable', {
			status: 416,
			headers: { 'Content-Range': 'bytes */*' }
		});
	}

	const mediaSettings = await loadMediaSettings();
	const directUrl = directMediaUrl(mediaSettings, key);
	if (directUrl) throw redirect(302, directUrl);

	const target = cachePath(key);
	if (target) {
		const local = await serveLocal(target, key, rangeHeader);
		if (local) return local;
	}

	try {
		const object = await getMediaObject(key, rangeHeader ?? undefined);
		if (!object?.Body) throw error(404, 'Not found');
		const headers = buildMediaHeaders(key, object.ContentType);
		if (object.ContentLength !== undefined) {
			headers.set('Content-Length', String(object.ContentLength));
		}
		if (object.ContentRange) headers.set('Content-Range', object.ContentRange);

		if (
			target &&
			!object.ContentRange &&
			/\.(?:webp|png|jpe?g)$/i.test(key) &&
			(object.ContentLength === undefined || object.ContentLength <= MAX_CACHE_FILE_BYTES)
		) {
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
