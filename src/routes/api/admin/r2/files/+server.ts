import { error, json } from '@sveltejs/kit';
import { createLogger } from '$lib/logger';
import { requireAdmin } from '$lib/server/admin';
import {
	listMediaFiles,
	uploadAudio,
	uploadImage,
	uploadVideo,
	MAX_AUDIO_BYTES,
	MAX_IMAGE_BYTES,
	MAX_VIDEO_BYTES,
	StorageValidationError,
	type MediaType
} from '$lib/server/storage/r2';
import type { RequestHandler } from './$types';

const log = createLogger('AdminR2Files');
const MEDIA_TYPES = new Set<MediaType>(['image', 'audio', 'video']);

const MAX_BYTES_BY_TYPE: Record<MediaType, number> = {
	image: MAX_IMAGE_BYTES,
	audio: MAX_AUDIO_BYTES,
	video: MAX_VIDEO_BYTES
};

function parseType(value: string | null): MediaType {
	if (!value || !MEDIA_TYPES.has(value as MediaType)) {
		throw error(400, 'Некорректный тип файла');
	}
	return value as MediaType;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	requireAdmin(locals);
	const type = parseType(url.searchParams.get('type'));
	const cursor = url.searchParams.get('cursor');
	return json(await listMediaFiles({ type, cursor }));
};

export const POST: RequestHandler = async ({ locals, request }) => {
	requireAdmin(locals);
	const form = await request.formData();
	const type = parseType(String(form.get('type') ?? ''));
	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0) {
		throw error(400, 'Выберите файл для загрузки');
	}
	if (file.size > MAX_BYTES_BY_TYPE[type]) {
		throw error(413, 'Файл превышает допустимый размер');
	}

	try {
		const buffer = Buffer.from(await file.arrayBuffer());
		const uploaded =
			type === 'image'
				? await uploadImage(buffer, { folder: 'library' })
				: type === 'audio'
					? await uploadAudio(buffer, {
							folder: 'audio',
							originalFilename: file.name
						})
					: await uploadVideo(buffer, {
							folder: 'video',
							originalFilename: file.name
						});

		return json({
			file: {
				key: uploaded.key,
				url: uploaded.url,
				name: file.name,
				size: file.size,
				lastModified: new Date().toISOString(),
				type,
				...('blurhash' in uploaded ? { blurhash: uploaded.blurhash } : {})
			}
		});
	} catch (e) {
		if (e instanceof StorageValidationError) throw error(400, e.message);
		if (e && typeof e === 'object' && 'status' in e) throw e;
		log.error('Failed to upload media file:', e);
		throw error(500, 'Не удалось загрузить файл');
	}
};
