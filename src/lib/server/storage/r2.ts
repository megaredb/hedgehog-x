import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { encode } from 'blurhash';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '$lib/logger';
import { loadMediaSettings } from '$lib/server/site-settings';

const dynamicPrivate = await import('$env/dynamic/private').catch(() => ({ env: process.env }));
const env = dynamicPrivate.env;

const log = createLogger('R2Storage');

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 500 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.mp4', '.ogg', '.opus', '.wav', '.aac']);
const ALLOWED_VIDEO_EXTENSIONS = new Set(['.webm', '.mp4', '.mov', '.m4v']);

const AUDIO_CONTENT_TYPES: Record<string, string> = {
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.mp4': 'audio/mp4',
	'.ogg': 'audio/ogg',
	'.opus': 'audio/opus',
	'.wav': 'audio/wav',
	'.aac': 'audio/aac'
};

const VIDEO_CONTENT_TYPES: Record<string, string> = {
	'.webm': 'video/webm',
	'.mp4': 'video/mp4',
	'.mov': 'video/quicktime',
	'.m4v': 'video/x-m4v'
};

export function audioContentTypeForExt(ext: string): string {
	return AUDIO_CONTENT_TYPES[ext.toLowerCase()] ?? 'audio/mpeg';
}

export function videoContentTypeForExt(ext: string): string {
	return VIDEO_CONTENT_TYPES[ext.toLowerCase()] ?? 'video/mp4';
}

export function resolveLocalUploadPath(rootDir: string, relativeKey: string): string | null {
	if (!relativeKey || relativeKey.includes('\0') || relativeKey.includes('\\')) return null;
	if (path.isAbsolute(relativeKey) || relativeKey.startsWith('/')) return null;
	const segments = relativeKey.split('/');
	if (segments.some((seg) => seg === '' || seg === '.' || seg === '..')) return null;

	const root = path.resolve(rootDir);
	const resolved = path.resolve(root, ...segments);
	if (!resolved.startsWith(root + path.sep)) return null;
	return resolved;
}

export class StorageValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'StorageValidationError';
	}
}

function isProduction(): boolean {
	return process.env.NODE_ENV === 'production';
}

function isSupportedImage(buffer: Buffer): boolean {
	return (
		(buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) ||
		(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
		(buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
			buffer.subarray(8, 12).toString('ascii') === 'WEBP') ||
		buffer.subarray(0, 3).toString('ascii') === 'GIF'
	);
}

function isSupportedAudio(buffer: Buffer): boolean {
	const ascii = buffer.subarray(0, 12).toString('ascii');
	return (
		ascii.startsWith('ID3') ||
		(buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) ||
		ascii.startsWith('OggS') ||
		ascii.startsWith('RIFF') ||
		ascii.slice(4, 8) === 'ftyp'
	);
}

export interface UploadImageResult {
	url: string;
	key: string;
	blurhash: string;
	themeColor: string;
	width: number;
	height: number;
}

export interface UploadAudioResult {
	url: string;
	key: string;
}

export interface UploadVideoResult {
	url: string;
	key: string;
}

function isSupportedVideo(buffer: Buffer): boolean {
	if (buffer.length < 12) return false;
	const ascii = buffer.subarray(0, 12).toString('ascii');
	return (
		(buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) ||
		ascii.slice(4, 8) === 'ftyp'
	);
}

/** Fetches an object for the local media proxy (including byte ranges for audio seeking). */
export async function getMediaObject(key: string, range?: string) {
	const r2 = getS3Client();
	if (!r2) return null;
	return r2.client.send(
		new GetObjectCommand({
			Bucket: r2.bucket,
			Key: key,
			...(range ? { Range: range } : {})
		})
	);
}

const MEDIA_PROXY_BASE = '/api/media';

/**
 * Stores media as canonical /api/media URLs so the admin "Через сайт" toggle
 * can switch existing files between the proxy and a direct CDN redirect.
 * A relative R2_PUBLIC_URL (e.g. /api/media) is kept as the base; an absolute
 * CDN URL is intentionally not baked into stored content because that would
 * bypass the toggle for every later request.
 */
async function publicMediaUrl(publicUrl: string, key: string): Promise<string> {
	const base = publicUrl.startsWith('/') ? publicUrl.replace(/\/$/, '') : MEDIA_PROXY_BASE;
	const encodedKey = key.split('/').map(encodeURIComponent).join('/');
	return `${base}/${encodedKey}`;
}

export function getS3Client(): { client: S3Client; bucket: string; publicUrl: string } | null {
	const accountId = env.R2_ACCOUNT_ID;
	const accessKeyId = env.R2_ACCESS_KEY_ID;
	const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
	const bucket = env.R2_BUCKET_NAME;
	const publicUrl = env.R2_PUBLIC_URL;

	if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
		return null;
	}

	const client = new S3Client({
		region: 'auto',
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId,
			secretAccessKey
		}
	});

	return { client, bucket, publicUrl: publicUrl.replace(/\/$/, '') };
}

/**
 * Converts image buffer to WebP format, generates a BlurHash string,
 * and uploads the image to Cloudflare R2 (or fallback local directory if R2 is not configured).
 */
export async function uploadImage(
	buffer: Buffer,
	options: { folder?: string; filenamePrefix?: string } = {}
): Promise<UploadImageResult> {
	if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
		throw new StorageValidationError('Image must be between 1 byte and 15 MB');
	}
	if (!isSupportedImage(buffer)) {
		throw new StorageValidationError('Unsupported image format (PNG, JPEG, WebP, GIF only)');
	}

	const folder = options.folder ?? 'images';
	const prefix = options.filenamePrefix ? `${options.filenamePrefix}-` : '';
	const key = `${folder}/${prefix}${randomUUID()}.webp`;

	// 1. Process image to WebP
	const image = sharp(buffer);
	const metadata = await image.metadata();
	const width = metadata.width ?? 0;
	const height = metadata.height ?? 0;

	const webpBuffer = await sharp(buffer).webp({ quality: 85, effort: 4 }).toBuffer();

	// 2. Compute BlurHash and Dominant Theme Color via Sharp
	let blurhash = '';
	let themeColor = '101828';
	try {
		const stats = await sharp(buffer).stats();
		if (stats.dominant) {
			themeColor = [stats.dominant.r, stats.dominant.g, stats.dominant.b]
				.map((x) => Math.round(x).toString(16).padStart(2, '0'))
				.join('');
		}
	} catch {
		// ignore stats failure
	}

	try {
		const { data, info } = await sharp(buffer)
			.resize(32, 32, { fit: 'inside' })
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
	} catch (e) {
		log.warn(`Failed to generate blurhash: ${e instanceof Error ? e.message : String(e)}`);
	}

	// 3. Upload to R2 or fallback local static folder
	const r2 = getS3Client();
	if (r2) {
		log.info(`Uploading image to R2 bucket ${r2.bucket}: ${key}`);
		await r2.client.send(
			new PutObjectCommand({
				Bucket: r2.bucket,
				Key: key,
				Body: webpBuffer,
				ContentType: 'image/webp'
			})
		);
		return {
			url: await publicMediaUrl(r2.publicUrl, key),
			key,
			blurhash,
			themeColor,
			width,
			height
		};
	}

	if (isProduction()) {
		throw new Error('R2 is not configured; uploads are disabled in production');
	}

	// Fallback for local development if R2 credentials are not set
	const uploadRoot = process.env.LOCAL_UPLOAD_DIR ?? 'static/uploads';
	const localFilePath = resolveLocalUploadPath(uploadRoot, key);
	if (!localFilePath) {
		throw new StorageValidationError('Invalid upload path');
	}
	await fs.mkdir(path.dirname(localFilePath), { recursive: true });
	await fs.writeFile(localFilePath, webpBuffer);
	log.info(`Saved image locally (fallback): ${localFilePath}`);

	return {
		url: `/uploads/${key}`,
		key,
		blurhash,
		themeColor,
		width,
		height
	};
}

/**
 * Uploads an audio buffer to Cloudflare R2 (or fallback local directory).
 */
export async function uploadAudio(
	buffer: Buffer,
	options: { originalFilename?: string; contentType?: string; folder?: string } = {}
): Promise<UploadAudioResult> {
	if (buffer.length === 0 || buffer.length > MAX_AUDIO_BYTES) {
		throw new StorageValidationError('Audio must be between 1 byte and 500 MB');
	}
	if (!isSupportedAudio(buffer)) {
		throw new StorageValidationError('Unsupported audio format');
	}

	const folder = options.folder ?? 'audio';
	const rawExt = options.originalFilename
		? path.extname(options.originalFilename).toLowerCase()
		: '.mp3';
	const safeExt = ALLOWED_AUDIO_EXTENSIONS.has(rawExt) ? rawExt : '.mp3';
	const key = `${folder}/${randomUUID()}${safeExt}`;
	const contentType = audioContentTypeForExt(safeExt);

	const r2 = getS3Client();
	if (r2) {
		log.info(`Uploading audio to R2 bucket ${r2.bucket}: ${key}`);
		await r2.client.send(
			new PutObjectCommand({
				Bucket: r2.bucket,
				Key: key,
				Body: buffer,
				ContentType: contentType
			})
		);
		return {
			url: await publicMediaUrl(r2.publicUrl, key),
			key
		};
	}

	if (isProduction()) {
		throw new Error('R2 is not configured; uploads are disabled in production');
	}

	// Fallback for local development
	const uploadRoot = process.env.LOCAL_UPLOAD_DIR ?? 'static/uploads';
	const localFilePath = resolveLocalUploadPath(uploadRoot, key);
	if (!localFilePath) {
		throw new StorageValidationError('Invalid upload path');
	}
	await fs.mkdir(path.dirname(localFilePath), { recursive: true });
	await fs.writeFile(localFilePath, buffer);
	log.info(`Saved audio locally (fallback): ${localFilePath}`);

	return {
		url: `/uploads/${key}`,
		key
	};
}

/**
 * Uploads a background video to Cloudflare R2 (or fallback local directory).
 */
export async function uploadVideo(
	buffer: Buffer,
	options: { originalFilename?: string; contentType?: string; folder?: string } = {}
): Promise<UploadVideoResult> {
	if (buffer.length === 0 || buffer.length > MAX_VIDEO_BYTES) {
		throw new StorageValidationError('Video must be between 1 byte and 100 MB');
	}
	if (!isSupportedVideo(buffer)) {
		throw new StorageValidationError('Unsupported video format');
	}

	const folder = options.folder ?? 'video';
	const rawExt = options.originalFilename
		? path.extname(options.originalFilename).toLowerCase()
		: '.mp4';
	const safeExt = ALLOWED_VIDEO_EXTENSIONS.has(rawExt) ? rawExt : '.mp4';
	const key = `${folder}/${randomUUID()}${safeExt}`;
	const contentType = videoContentTypeForExt(safeExt);

	const r2 = getS3Client();
	if (r2) {
		log.info(`Uploading video to R2 bucket ${r2.bucket}: ${key}`);
		await r2.client.send(
			new PutObjectCommand({
				Bucket: r2.bucket,
				Key: key,
				Body: buffer,
				ContentType: contentType
			})
		);
		return {
			url: await publicMediaUrl(r2.publicUrl, key),
			key
		};
	}

	if (isProduction()) {
		throw new Error('R2 is not configured; uploads are disabled in production');
	}

	const uploadRoot = process.env.LOCAL_UPLOAD_DIR ?? 'static/uploads';
	const localFilePath = resolveLocalUploadPath(uploadRoot, key);
	if (!localFilePath) {
		throw new StorageValidationError('Invalid upload path');
	}
	await fs.mkdir(path.dirname(localFilePath), { recursive: true });
	await fs.writeFile(localFilePath, buffer);
	log.info(`Saved video locally (fallback): ${localFilePath}`);

	return {
		url: `/uploads/${key}`,
		key
	};
}

export type MediaType = 'image' | 'audio' | 'video';

export interface MediaLibraryFile {
	key: string;
	url: string;
	name: string;
	size: number;
	lastModified: string | null;
	type: MediaType;
}

const IMAGE_EXTENSIONS = new Set(['.webp', '.jpg', '.jpeg', '.png', '.gif', '.avif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.ogg', '.opus', '.wav', '.aac']);
const VIDEO_EXTENSIONS = new Set(['.webm', '.mp4', '.mov', '.m4v']);

export function mediaTypeForKey(key: string): MediaType | null {
	const ext = path.extname(key).toLowerCase();
	if (IMAGE_EXTENSIONS.has(ext)) return 'image';
	if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
	if (ext === '.mp4' && key.startsWith('audio/')) return 'audio';
	if (VIDEO_EXTENSIONS.has(ext)) return 'video';
	return null;
}

export async function getMediaUrl(key: string): Promise<string> {
	const r2 = getS3Client();
	if (!r2) return `/uploads/${key}`;
	return publicMediaUrl(r2.publicUrl, key);
}

async function localMediaFiles(root: string, prefix = ''): Promise<MediaLibraryFile[]> {
	const current = path.join(root, prefix);
	let entries: import('node:fs').Dirent[];
	try {
		entries = await fs.readdir(current, { withFileTypes: true });
	} catch {
		return [];
	}
	const files: MediaLibraryFile[] = [];
	for (const entry of entries) {
		const relative = path.join(prefix, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await localMediaFiles(root, relative)));
			continue;
		}
		const type = mediaTypeForKey(relative);
		if (!type) continue;
		const stat = await fs.stat(path.join(root, relative)).catch(() => null);
		files.push({
			key: relative.split(path.sep).join('/'),
			url: `/uploads/${relative.split(path.sep).join('/')}`,
			name: entry.name,
			size: stat?.size ?? 0,
			lastModified: stat?.mtime?.toISOString() ?? null,
			type
		});
	}
	return files;
}

export async function listMediaFiles(options: {
	type: MediaType;
	cursor?: string | null;
}): Promise<{ files: MediaLibraryFile[]; nextCursor: string | null; source: 'r2' | 'local' }> {
	const r2 = getS3Client();
	if (!r2) {
		const root = path.resolve(process.env.LOCAL_UPLOAD_DIR ?? 'static/uploads');
		const all = await localMediaFiles(root);
		return {
			files: all
				.filter((file) => file.type === options.type)
				.sort((a, b) => (b.lastModified ?? '').localeCompare(a.lastModified ?? '')),
			nextCursor: null,
			source: 'local'
		};
	}

	const result = await r2.client.send(
		new ListObjectsV2Command({
			Bucket: r2.bucket,
			MaxKeys: 1000,
			ContinuationToken: options.cursor || undefined
		})
	);
	const files: MediaLibraryFile[] = [];
	for (const object of result.Contents ?? []) {
		if (!object.Key) continue;
		const type = mediaTypeForKey(object.Key);
		if (type !== options.type) continue;
		files.push({
			key: object.Key,
			url: await publicMediaUrl(r2.publicUrl, object.Key),
			name: decodeURIComponent(object.Key.split('/').pop() ?? object.Key),
			size: object.Size ?? 0,
			lastModified: object.LastModified?.toISOString() ?? null,
			type
		});
	}
	files.sort((a, b) => (b.lastModified ?? '').localeCompare(a.lastModified ?? ''));
	return {
		files,
		nextCursor: result.IsTruncated ? (result.NextContinuationToken ?? null) : null,
		source: 'r2'
	};
}

/**
 * Deletes an object by key or public URL from R2 or fallback local static files.
 */
export async function deleteFromStorage(keyOrUrl: string): Promise<boolean> {
	const r2 = getS3Client();
	let key = keyOrUrl.trim();
	if (!key) return false;

	if (key.startsWith('http://') || key.startsWith('https://')) {
		if (!r2) return false;
		let parsed: URL;
		try {
			parsed = new URL(key);
		} catch {
			return false;
		}
		const allowedOrigins = new Set<string>();
		try {
			allowedOrigins.add(new URL(r2.publicUrl).origin);
		} catch {
			// ignore invalid publicUrl
		}
		const media = await loadMediaSettings().catch(() => null);
		if (media?.mediaDirectBaseUrl) {
			try {
				allowedOrigins.add(new URL(media.mediaDirectBaseUrl).origin);
			} catch {
				// ignore invalid mediaDirectBaseUrl
			}
		}
		if (!allowedOrigins.has(parsed.origin)) {
			return false;
		}
		try {
			const segments = parsed.pathname
				.replace(/^\/+/, '')
				.split('/')
				.map((segment) => decodeURIComponent(segment));
			if (segments.some((seg) => seg === '' || seg === '.' || seg === '..' || seg.includes('\0'))) {
				return false;
			}
			key = segments.join('/');
		} catch {
			return false;
		}
	} else if (key.startsWith('/uploads/')) {
		key = key.replace(/^\/uploads\//, '');
	} else if (key.startsWith('/api/media/')) {
		key = key.replace(/^\/api\/media\//, '');
	}

	if (!key || key.includes('\0')) return false;

	if (r2) {
		try {
			await r2.client.send(
				new DeleteObjectCommand({
					Bucket: r2.bucket,
					Key: key
				})
			);
			return true;
		} catch (e) {
			log.error(`Failed to delete from R2: ${e instanceof Error ? e.message : String(e)}`);
			return false;
		}
	}

	if (isProduction()) {
		log.error('R2 is not configured; refusing local deletion in production');
		return false;
	}

	// Local file fallback
	try {
		const uploadRoot = process.env.LOCAL_UPLOAD_DIR ?? 'static/uploads';
		const localFilePath = resolveLocalUploadPath(uploadRoot, key);
		if (!localFilePath) return false;
		await fs.unlink(localFilePath);
		return true;
	} catch {
		return false;
	}
}
