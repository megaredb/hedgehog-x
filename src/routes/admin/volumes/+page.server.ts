import { db } from '$lib/server/db';
import { books, volumes } from '$lib/server/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/admin';
import { uploadImage } from '$lib/server/storage/r2';
import { fail, type Actions } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { PageServerLoad } from './$types';

function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '_')
		.replace(/^-+|-+$/g, '');
}

export const load: PageServerLoad = async ({ locals, url }) => {
	requireAdmin(locals);

	const allBooks = await db
		.select({ id: books.id, title: books.title })
		.from(books)
		.orderBy(asc(books.title));
	const allVolumes = await db
		.select({
			id: volumes.id,
			bookId: volumes.bookId,
			volumeNumber: volumes.volumeNumber,
			title: volumes.title,
			description: volumes.description,
			coverUrl: volumes.coverUrl,
			blurhash: volumes.blurhash,
			status: volumes.status,
			createdAt: volumes.createdAt,
			updatedAt: volumes.updatedAt,
			bookTitle: books.title
		})
		.from(volumes)
		.leftJoin(books, eq(volumes.bookId, books.id))
		.orderBy(desc(volumes.updatedAt));

	const editId = url.searchParams.get('edit');
	const editVolume = editId ? allVolumes.find((v) => v.id === editId) : null;

	return {
		books: allBooks,
		volumes: allVolumes,
		editVolume
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();

		let id = (form.get('id') as string)?.trim();
		const bookId = (form.get('bookId') as string)?.trim();
		const volumeNumber = parseInt(form.get('volumeNumber') as string, 10);
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || null;
		const status = (form.get('status') as string) || 'ongoing';
		let coverUrl = (form.get('coverUrl') as string)?.trim() || null;
		let blurhash: string | null = null;

		if (!bookId) {
			return fail(400, { error: 'Необходимо выбрать книгу' });
		}
		if (!title) {
			return fail(400, { error: 'Название тома обязательно' });
		}
		if (isNaN(volumeNumber)) {
			return fail(400, { error: 'Номер тома должен быть числом' });
		}

		if (!id) {
			const slug = slugify(title);
			id = slug
				? `${bookId}_vol_${volumeNumber}_${slug}`
				: `${bookId}_vol_${volumeNumber}_${randomUUID().slice(0, 6)}`;
		}

		const coverFile = form.get('coverFile');
		if (coverFile && coverFile instanceof File && coverFile.size > 0) {
			try {
				const buffer = Buffer.from(await coverFile.arrayBuffer());
				const uploaded = await uploadImage(buffer, { folder: 'volumes', filenamePrefix: id });
				coverUrl = uploaded.url;
				blurhash = uploaded.blurhash;
			} catch (e) {
				return fail(500, {
					error: `Ошибка загрузки обложки: ${e instanceof Error ? e.message : String(e)}`
				});
			}
		}

		try {
			await db.insert(volumes).values({
				id,
				bookId,
				volumeNumber,
				title,
				description,
				coverUrl,
				blurhash,
				status
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
		const bookId = (form.get('bookId') as string)?.trim();
		const volumeNumber = parseInt(form.get('volumeNumber') as string, 10);
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || null;
		const status = (form.get('status') as string) || 'ongoing';
		let coverUrl = (form.get('coverUrl') as string)?.trim() || null;
		let blurhash: string | null = null;

		if (!id || !bookId || !title || isNaN(volumeNumber)) {
			return fail(400, { error: 'ID, книга, номер тома и название обязательны' });
		}

		const coverFile = form.get('coverFile');
		if (coverFile && coverFile instanceof File && coverFile.size > 0) {
			try {
				const buffer = Buffer.from(await coverFile.arrayBuffer());
				const uploaded = await uploadImage(buffer, { folder: 'volumes', filenamePrefix: id });
				coverUrl = uploaded.url;
				blurhash = uploaded.blurhash;
			} catch (e) {
				return fail(500, {
					error: `Ошибка загрузки обложки: ${e instanceof Error ? e.message : String(e)}`
				});
			}
		}

		try {
			const updateData: {
				bookId: string;
				volumeNumber: number;
				title: string;
				description: string | null;
				status: string;
				coverUrl?: string | null;
				blurhash?: string | null;
			} = {
				bookId,
				volumeNumber,
				title,
				description,
				status
			};

			if (coverUrl !== null) {
				updateData.coverUrl = coverUrl;
			}
			if (blurhash !== null) {
				updateData.blurhash = blurhash;
			}

			await db.update(volumes).set(updateData).where(eq(volumes.id, id));
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: `Ошибка обновления тома: ${e instanceof Error ? e.message : String(e)}`
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
			await db.delete(volumes).where(eq(volumes.id, id));
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: `Ошибка удаления тома: ${e instanceof Error ? e.message : String(e)}`
			});
		}
	}
};
