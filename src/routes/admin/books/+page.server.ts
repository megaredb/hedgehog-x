import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
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

	const allBooks = await db.select().from(books).orderBy(desc(books.updatedAt));
	const editId = url.searchParams.get('edit');
	const editBook = editId ? allBooks.find((b) => b.id === editId) : null;

	return {
		books: allBooks,
		editBook
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();

		let id = (form.get('id') as string)?.trim();
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || null;
		const status = (form.get('status') as string) || 'ongoing';
		let coverUrl = (form.get('coverUrl') as string)?.trim() || null;
		let blurhash: string | null = null;
		let themeColor = (form.get('themeColor') as string)?.trim()?.replace(/^#/, '') || null;

		if (!title) {
			return fail(400, { error: 'Название книги обязательно' });
		}

		if (!id) {
			const slug = slugify(title);
			id = slug || randomUUID().slice(0, 8);
		}

		// Handle file upload if provided
		const coverFile = form.get('coverFile');
		if (coverFile && coverFile instanceof File && coverFile.size > 0) {
			try {
				const buffer = Buffer.from(await coverFile.arrayBuffer());
				const uploaded = await uploadImage(buffer, { folder: 'books', filenamePrefix: id });
				coverUrl = uploaded.url;
				blurhash = uploaded.blurhash;
				if (!themeColor) {
					themeColor = uploaded.themeColor;
				}
			} catch (e) {
				return fail(500, {
					error: `Ошибка загрузки обложки: ${e instanceof Error ? e.message : String(e)}`
				});
			}
		}

		try {
			await db.insert(books).values({
				id,
				title,
				description,
				coverUrl,
				blurhash,
				themeColor: themeColor?.slice(0, 6) || null,
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
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || null;
		const status = (form.get('status') as string) || 'ongoing';
		let coverUrl = (form.get('coverUrl') as string)?.trim() || null;
		let themeColor = (form.get('themeColor') as string)?.trim()?.replace(/^#/, '') || null;
		let blurhash: string | null = null;

		if (!id || !title) {
			return fail(400, { error: 'ID и Название обязательны' });
		}

		const coverFile = form.get('coverFile');
		if (coverFile && coverFile instanceof File && coverFile.size > 0) {
			try {
				const buffer = Buffer.from(await coverFile.arrayBuffer());
				const uploaded = await uploadImage(buffer, { folder: 'books', filenamePrefix: id });
				coverUrl = uploaded.url;
				blurhash = uploaded.blurhash;
				if (!themeColor) {
					themeColor = uploaded.themeColor;
				}
			} catch (e) {
				return fail(500, {
					error: `Ошибка загрузки обложки: ${e instanceof Error ? e.message : String(e)}`
				});
			}
		}

		try {
			const updateData: {
				title: string;
				description: string | null;
				status: string;
				coverUrl?: string | null;
				blurhash?: string | null;
				themeColor?: string | null;
			} = {
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
			if (themeColor !== null) {
				updateData.themeColor = themeColor.slice(0, 6);
			}

			await db.update(books).set(updateData).where(eq(books.id, id));
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: `Ошибка обновления: ${e instanceof Error ? e.message : String(e)}`
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
			await db.delete(books).where(eq(books.id, id));
			return { success: true };
		} catch (e) {
			return fail(500, { error: `Ошибка удаления: ${e instanceof Error ? e.message : String(e)}` });
		}
	}
};
