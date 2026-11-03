import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin';
import { uploadImage, uploadAudio } from '$lib/server/storage/r2';

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);

	const formData = await request.formData();
	const file = formData.get('file');
	const type = (formData.get('type') as string) || 'image';
	const folder = (formData.get('folder') as string) || (type === 'audio' ? 'audio' : 'images');
	const prefix = (formData.get('prefix') as string) || '';

	if (!file || !(file instanceof File)) {
		return json({ error: 'Файл не предоставлен' }, { status: 400 });
	}

	const buffer = Buffer.from(await file.arrayBuffer());

	if (type === 'image') {
		try {
			const result = await uploadImage(buffer, { folder, filenamePrefix: prefix });
			return json({ success: true, ...result });
		} catch (e) {
			return json(
				{ error: `Ошибка обработки изображения: ${e instanceof Error ? e.message : String(e)}` },
				{ status: 500 }
			);
		}
	} else if (type === 'audio') {
		try {
			const result = await uploadAudio(buffer, {
				originalFilename: file.name,
				contentType: file.type,
				folder
			});
			return json({ success: true, ...result });
		} catch (e) {
			return json(
				{ error: `Ошибка загрузки аудио: ${e instanceof Error ? e.message : String(e)}` },
				{ status: 500 }
			);
		}
	}

	return json({ error: 'Неизвестный тип файла' }, { status: 400 });
};
