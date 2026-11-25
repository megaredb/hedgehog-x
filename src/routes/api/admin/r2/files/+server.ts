import { error, json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin';
import {
	listMediaFiles,
	uploadAudio,
	uploadImage,
	uploadVideo,
	StorageValidationError,
	type MediaType
} from '$lib/server/storage/r2';
import type { RequestHandler } from './$types';

const MEDIA_TYPES = new Set<MediaType>(['image', 'audio', 'video']);

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

	try {
		const buffer = Buffer.from(await file.arrayBuffer());
		const uploaded =
			type === 'image'
				? await uploadImage(buffer, { folder: 'library' })
				: type === 'audio'
					? await uploadAudio(buffer, {
							folder: 'audio',
							originalFilename: file.name,
							contentType: file.type || 'audio/mpeg'
						})
					: await uploadVideo(buffer, {
							folder: 'video',
							originalFilename: file.name,
							contentType: file.type || 'video/mp4'
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
		throw error(500, e instanceof Error ? e.message : 'Не удалось загрузить файл');
	}
};
