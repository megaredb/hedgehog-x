import { db } from '$lib/server/db';
import { books, volumes, illustrations } from '$lib/server/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/admin';
import { uploadImage } from '$lib/server/storage/r2';
import { fail, type Actions } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireAdmin(locals);

	const allVolumes = await db
		.select({
			id: volumes.id,
			title: volumes.title,
			volumeNumber: volumes.volumeNumber,
			bookId: volumes.bookId,
			bookTitle: books.title
		})
		.from(volumes)
		.leftJoin(books, eq(volumes.bookId, books.id))
		.orderBy(asc(books.title), asc(volumes.volumeNumber));

	const selectedVolumeId = url.searchParams.get('volumeId');

	const allIllustrationsQuery = db
		.select({
			id: illustrations.id,
			volumeId: illustrations.volumeId,
			imageUrl: illustrations.imageUrl,
			blurhash: illustrations.blurhash,
			caption: illustrations.caption,
			sortOrder: illustrations.sortOrder,
			createdAt: illustrations.createdAt,
			updatedAt: illustrations.updatedAt,
			volumeTitle: volumes.title,
			volumeNumber: volumes.volumeNumber,
			bookId: volumes.bookId,
			bookTitle: books.title
		})
		.from(illustrations)
		.leftJoin(volumes, eq(illustrations.volumeId, volumes.id))
		.leftJoin(books, eq(volumes.bookId, books.id));

	const allIllustrations = selectedVolumeId
		? await allIllustrationsQuery
				.where(eq(illustrations.volumeId, selectedVolumeId))
				.orderBy(asc(illustrations.sortOrder))
		: await allIllustrationsQuery.orderBy(desc(illustrations.updatedAt)).limit(100);

	const editId = url.searchParams.get('edit');
	const editIllustration = editId ? allIllustrations.find((i) => i.id === editId) : null;

	return {
		volumes: allVolumes,
		illustrations: allIllustrations,
		selectedVolumeId,
		editIllustration
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();

		const volumeId = (form.get('volumeId') as string)?.trim();
		const caption = (form.get('caption') as string)?.trim() || null;
		const sortOrder = parseInt(form.get('sortOrder') as string, 10) || 0;
		let imageUrl = (form.get('imageUrl') as string)?.trim() || '';
		let blurhash: string | null = null;

		if (!volumeId) {
			return fail(400, { error: 'Необходимо выбрать том' });
		}

		const id = `ill_${volumeId}_${randomUUID().slice(0, 8)}`;

		const imageFile = form.get('imageFile');
		if (imageFile && imageFile instanceof File && imageFile.size > 0) {
			try {
				const buffer = Buffer.from(await imageFile.arrayBuffer());
				const uploaded = await uploadImage(buffer, {
					folder: 'illustrations',
					filenamePrefix: volumeId
				});
				imageUrl = uploaded.url;
				blurhash = uploaded.blurhash;
			} catch (e) {
				return fail(500, {
					error: `Ошибка загрузки изображения: ${e instanceof Error ? e.message : String(e)}`
				});
			}
		}

		if (!imageUrl) {
			return fail(400, { error: 'Необходимо прикрепить изображение или указать URL' });
		}

		try {
			await db.insert(illustrations).values({
				id,
				volumeId,
				imageUrl,
				blurhash,
				caption,
				sortOrder
			});
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: `Ошибка базы данных: ${e instanceof Error ? e.message : String(e)}`
			});
		}
	},

	update: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();

		const id = (form.get('id') as string)?.trim();
		const volumeId = (form.get('volumeId') as string)?.trim();
		const caption = (form.get('caption') as string)?.trim() || null;
		const sortOrder = parseInt(form.get('sortOrder') as string, 10) || 0;
		let imageUrl = (form.get('imageUrl') as string)?.trim() || null;
		let blurhash: string | null = null;

		if (!id || !volumeId) {
			return fail(400, { error: 'ID и том обязательны' });
		}

		const imageFile = form.get('imageFile');
		if (imageFile && imageFile instanceof File && imageFile.size > 0) {
			try {
				const buffer = Buffer.from(await imageFile.arrayBuffer());
				const uploaded = await uploadImage(buffer, {
					folder: 'illustrations',
					filenamePrefix: volumeId
				});
				imageUrl = uploaded.url;
				blurhash = uploaded.blurhash;
			} catch (e) {
				return fail(500, {
					error: `Ошибка загрузки изображения: ${e instanceof Error ? e.message : String(e)}`
				});
			}
		}

		try {
			const updateData: {
				volumeId: string;
				caption: string | null;
				sortOrder: number;
				imageUrl?: string;
				blurhash?: string | null;
			} = {
				volumeId,
				caption,
				sortOrder
			};

			if (imageUrl) {
				updateData.imageUrl = imageUrl;
			}
			if (blurhash !== null) {
				updateData.blurhash = blurhash;
			}

			await db.update(illustrations).set(updateData).where(eq(illustrations.id, id));
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: `Ошибка обновления иллюстрации: ${e instanceof Error ? e.message : String(e)}`
			});
		}
	},

	delete: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = (form.get('id') as string)?.trim();

		if (!id) {
			return fail(400, { error: 'ID обязателен' });
		}

		try {
			await db.delete(illustrations).where(eq(illustrations.id, id));
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: `Ошибка удаления иллюстрации: ${e instanceof Error ? e.message : String(e)}`
			});
		}
	}
};
