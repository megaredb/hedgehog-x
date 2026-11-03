import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { encode } from 'blurhash';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '$lib/logger';

const dynamicPrivate = await import('$env/dynamic/private').catch(() => ({ env: process.env }));
const env = dynamicPrivate.env;

const log = createLogger('R2Storage');

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

function getS3Client(): { client: S3Client; bucket: string; publicUrl: string } | null {
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

	// Fallback for local development if R2 credentials are not set
	const localDir = path.resolve('static/uploads', folder);
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

	// Fallback for local development
	const localDir = path.resolve('static/uploads', folder);
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

	// Local file fallback
	try {
		const localFilePath = path.resolve('static/uploads', key);
		await fs.unlink(localFilePath);
		return true;
	} catch {
		return false;
	}
}
