import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { encode } from 'blurhash';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '$lib/logger';

const dynamicPrivate = await import('$env/dynamic/private').catch(() => ({ env: process.env }));
const env = dynamicPrivate.env;

const log = createLogger('R2Storage');

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_AUDIO_BYTES = 500 * 1024 * 1024;

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
		throw new Error('Image must be between 1 byte and 15 MB');
	}
	if (!isSupportedImage(buffer)) {
		throw new Error('Unsupported image format (PNG, JPEG, WebP, GIF only)');
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
			url: `${r2.publicUrl}/${key}`,
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
	const localDir = path.resolve(process.env.LOCAL_UPLOAD_DIR ?? 'static/uploads', folder);
	await fs.mkdir(localDir, { recursive: true });
	const localFilePath = path.resolve(localDir, `${prefix}${path.basename(key)}`);
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
		throw new Error('Audio must be between 1 byte and 500 MB');
	}
	if (!isSupportedAudio(buffer)) {
		throw new Error('Unsupported audio format');
	}

	const folder = options.folder ?? 'audio';
	const ext = options.originalFilename ? path.extname(options.originalFilename) : '.mp3';
	const safeExt = ext || '.mp3';
	const key = `${folder}/${randomUUID()}${safeExt}`;
	const contentType = options.contentType || 'audio/mpeg';

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
			url: `${r2.publicUrl}/${key}`,
			key
		};
	}

	if (isProduction()) {
		throw new Error('R2 is not configured; uploads are disabled in production');
	}

	// Fallback for local development
	const localDir = path.resolve(process.env.LOCAL_UPLOAD_DIR ?? 'static/uploads', folder);
	await fs.mkdir(localDir, { recursive: true });
	const localFilePath = path.resolve(localDir, path.basename(key));
	await fs.writeFile(localFilePath, buffer);
	log.info(`Saved audio locally (fallback): ${localFilePath}`);

	return {
		url: `/uploads/${key}`,
		key
	};
}

/**
 * Deletes an object by key or public URL from R2 or fallback local static files.
 */
export async function deleteFromStorage(keyOrUrl: string): Promise<boolean> {
	const r2 = getS3Client();
	let key = keyOrUrl;

	if (keyOrUrl.startsWith('http')) {
		try {
			const u = new URL(keyOrUrl);
			key = u.pathname.replace(/^\/+/, '');
		} catch {
			key = keyOrUrl;
		}
	} else if (keyOrUrl.startsWith('/uploads/')) {
		key = keyOrUrl.replace(/^\/uploads\//, '');
	} else if (keyOrUrl.startsWith('/api/media/')) {
		key = keyOrUrl.replace(/^\/api\/media\//, '');
	}

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
		const localFilePath = path.resolve(process.env.LOCAL_UPLOAD_DIR ?? 'static/uploads', key);
		await fs.unlink(localFilePath);
		return true;
	} catch {
		return false;
	}
}
