import { db } from '$lib/server/db';
import { isUniqueViolation } from '$lib/server/db/errors';
import { books, chapters, illustrations, volumes } from '$lib/server/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/admin';
import {
	deleteFromStorage,
	MAX_IMAGE_BYTES,
	StorageValidationError,
	uploadImage
} from '$lib/server/storage/r2';
import { fail, type Actions } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { slugify } from '$lib/utils/slugify';
import { isValidContentStatus, isValidThemeColor } from '$lib/utils/validation';
import type { PageServerLoad } from './$types';

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
		let coverWidth: number | null = null;
		let coverHeight: number | null = null;
		let blurhash: string | null = null;
		let themeColor = (form.get('themeColor') as string)?.trim()?.replace(/^#/, '') || null;

		if (!title) {
			return fail(400, { error: 'Название книги обязательно' });
		}
		if (!isValidContentStatus(status)) {
			return fail(400, { error: 'Некорректный статус книги' });
		}
		if (themeColor && !isValidThemeColor(themeColor)) {
			return fail(400, { error: 'Цвет темы должен состоять из 6 HEX-символов' });
		}

		if (!id) {
			const slug = slugify(title);
			id = slug || randomUUID().slice(0, 8);
		}

		let uploadedUrl: string | null = null;
		// Handle file upload if provided
		const coverFile = form.get('coverFile');
		if (coverFile && coverFile instanceof File && coverFile.size > 0) {
			if (coverFile.size > MAX_IMAGE_BYTES) {
				return fail(400, { error: 'Размер обложки не должен превышать 15 МБ' });
			}
			try {
				const buffer = Buffer.from(await coverFile.arrayBuffer());
				const uploaded = await uploadImage(buffer, { folder: 'books', filenamePrefix: id });
				uploadedUrl = uploaded.url;
				coverUrl = uploaded.url;
				coverWidth = uploaded.width;
				coverHeight = uploaded.height;
				blurhash = uploaded.blurhash;
				if (!themeColor) {
					themeColor = uploaded.themeColor;
				}
			} catch (e) {
				const statusCode = e instanceof StorageValidationError ? 400 : 500;
				return fail(statusCode, {
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
				coverWidth,
				coverHeight,
				blurhash,
				themeColor: themeColor?.slice(0, 6) || null,
				status
			});
			return { success: true };
		} catch (e) {
			if (uploadedUrl) await deleteFromStorage(uploadedUrl).catch(() => {});
			if (isUniqueViolation(e)) {
				return fail(400, { error: 'Книга с таким ID уже существует' });
			}
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
		let coverWidth: number | null = null;
		let coverHeight: number | null = null;
		let themeColor = (form.get('themeColor') as string)?.trim()?.replace(/^#/, '') || null;
		let blurhash: string | null = null;

		if (!id || !title) {
			return fail(400, { error: 'ID и Название обязательны' });
		}
		if (!isValidContentStatus(status)) {
			return fail(400, { error: 'Некорректный статус книги' });
		}
		if (themeColor && !isValidThemeColor(themeColor)) {
			return fail(400, { error: 'Цвет темы должен состоять из 6 HEX-символов' });
		}

		const [old] = await db
			.select({ coverUrl: books.coverUrl })
			.from(books)
			.where(eq(books.id, id))
			.limit(1);

		let uploadedUrl: string | null = null;
		const coverFile = form.get('coverFile');
		const hasNewCoverFile = coverFile instanceof File && coverFile.size > 0;
		if (hasNewCoverFile) {
			if (coverFile.size > MAX_IMAGE_BYTES) {
				return fail(400, { error: 'Размер обложки не должен превышать 15 МБ' });
			}
			try {
				const buffer = Buffer.from(await coverFile.arrayBuffer());
				const uploaded = await uploadImage(buffer, { folder: 'books', filenamePrefix: id });
				uploadedUrl = uploaded.url;
				coverUrl = uploaded.url;
				coverWidth = uploaded.width;
				coverHeight = uploaded.height;
				blurhash = uploaded.blurhash;
				if (!themeColor) {
					themeColor = uploaded.themeColor;
				}
			} catch (e) {
				const statusCode = e instanceof StorageValidationError ? 400 : 500;
				return fail(statusCode, {
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
				coverWidth?: number | null;
				coverHeight?: number | null;
				blurhash?: string | null;
				themeColor?: string | null;
			} = {
				title,
				description,
				status
			};

			// Explicit empty values clear the cover/theme; fields not present mean "not supplied".
			if (hasNewCoverFile) {
				updateData.coverUrl = coverUrl;
				updateData.coverWidth = coverWidth;
				updateData.coverHeight = coverHeight;
				if (blurhash !== null) updateData.blurhash = blurhash;
			} else if (form.has('coverUrl')) {
				updateData.coverUrl = coverUrl || null;
				if (!coverUrl) {
					updateData.blurhash = null;
					updateData.coverWidth = null;
					updateData.coverHeight = null;
				}
			}
			if (form.has('themeColor')) {
				updateData.themeColor = themeColor ? themeColor.slice(0, 6) : null;
			}

			await db.update(books).set(updateData).where(eq(books.id, id));
			if (
				updateData.coverUrl !== undefined &&
				old?.coverUrl &&
				old.coverUrl !== updateData.coverUrl
			) {
				await deleteFromStorage(old.coverUrl);
			}
			return { success: true };
		} catch (e) {
			if (uploadedUrl) await deleteFromStorage(uploadedUrl).catch(() => {});
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
			const [old] = await db
				.select({ coverUrl: books.coverUrl })
				.from(books)
				.where(eq(books.id, id))
				.limit(1);
			const bookVolumes = await db
				.select({ id: volumes.id, coverUrl: volumes.coverUrl })
				.from(volumes)
				.where(eq(volumes.bookId, id));
			const volumeIds = bookVolumes.map((v) => v.id);
			const [bookChapters, bookIllustrations] = volumeIds.length
				? await Promise.all([
						db
							.select({ audioUrl: chapters.audioUrl })
							.from(chapters)
							.where(inArray(chapters.volumeId, volumeIds)),
						db
							.select({ imageUrl: illustrations.imageUrl })
							.from(illustrations)
							.where(inArray(illustrations.volumeId, volumeIds))
					])
				: [[], []];

			await db.delete(books).where(eq(books.id, id));

			const mediaUrls = [
				old?.coverUrl,
				...bookVolumes.map((v) => v.coverUrl),
				...bookChapters.map((c) => c.audioUrl),
				...bookIllustrations.map((i) => i.imageUrl)
			].filter((u): u is string => Boolean(u));
			await Promise.allSettled(mediaUrls.map((u) => deleteFromStorage(u)));
			return { success: true };
		} catch (e) {
			return fail(500, { error: `Ошибка удаления: ${e instanceof Error ? e.message : String(e)}` });
		}
	}
};
