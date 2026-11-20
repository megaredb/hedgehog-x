import { db } from '$lib/server/db';
import { isUniqueViolation } from '$lib/server/db/errors';
import { books, chapters, illustrations, volumes } from '$lib/server/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
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
import { isValidContentStatus } from '$lib/utils/validation';
import type { PageServerLoad } from './$types';

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
		let coverWidth: number | null = null;
		let coverHeight: number | null = null;
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
		if (!isValidContentStatus(status)) {
			return fail(400, { error: 'Некорректный статус тома' });
		}

		if (!id) {
			const slug = slugify(title);
			id = slug
				? `${bookId}_vol_${volumeNumber}_${slug}`
				: `${bookId}_vol_${volumeNumber}_${randomUUID().slice(0, 6)}`;
		}

		let uploadedUrl: string | null = null;
		const coverFile = form.get('coverFile');
		if (coverFile && coverFile instanceof File && coverFile.size > 0) {
			if (coverFile.size > MAX_IMAGE_BYTES) {
				return fail(400, { error: 'Размер обложки не должен превышать 15 МБ' });
			}
			try {
				const buffer = Buffer.from(await coverFile.arrayBuffer());
				const uploaded = await uploadImage(buffer, { folder: 'volumes', filenamePrefix: id });
				uploadedUrl = uploaded.url;
				coverUrl = uploaded.url;
				coverWidth = uploaded.width;
				coverHeight = uploaded.height;
				blurhash = uploaded.blurhash;
			} catch (e) {
				const statusCode = e instanceof StorageValidationError ? 400 : 500;
				return fail(statusCode, {
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
				coverWidth,
				coverHeight,
				blurhash,
				status
			});
			return { success: true };
		} catch (e) {
			if (uploadedUrl) await deleteFromStorage(uploadedUrl).catch(() => {});
			if (isUniqueViolation(e)) {
				return fail(400, { error: 'Том с таким номером уже существует в этой книге' });
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
		const bookId = (form.get('bookId') as string)?.trim();
		const volumeNumber = parseInt(form.get('volumeNumber') as string, 10);
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || null;
		const status = (form.get('status') as string) || 'ongoing';
		let coverUrl = (form.get('coverUrl') as string)?.trim() || null;
		let coverWidth: number | null = null;
		let coverHeight: number | null = null;
		let blurhash: string | null = null;

		if (!id || !bookId || !title || isNaN(volumeNumber)) {
			return fail(400, { error: 'ID, книга, номер тома и название обязательны' });
		}
		if (!isValidContentStatus(status)) {
			return fail(400, { error: 'Некорректный статус тома' });
		}

		const [old] = await db
			.select({ coverUrl: volumes.coverUrl })
			.from(volumes)
			.where(eq(volumes.id, id))
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
				const uploaded = await uploadImage(buffer, { folder: 'volumes', filenamePrefix: id });
				uploadedUrl = uploaded.url;
				coverUrl = uploaded.url;
				coverWidth = uploaded.width;
				coverHeight = uploaded.height;
				blurhash = uploaded.blurhash;
			} catch (e) {
				const statusCode = e instanceof StorageValidationError ? 400 : 500;
				return fail(statusCode, {
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
				coverWidth?: number | null;
				coverHeight?: number | null;
				blurhash?: string | null;
			} = {
				bookId,
				volumeNumber,
				title,
				description,
				status
			};

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

			await db.update(volumes).set(updateData).where(eq(volumes.id, id));
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
			if (isUniqueViolation(e)) {
				return fail(400, { error: 'Том с таким номером уже существует в этой книге' });
			}
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
			const [old] = await db
				.select({ coverUrl: volumes.coverUrl })
				.from(volumes)
				.where(eq(volumes.id, id))
				.limit(1);
			const [volChapters, volIllustrations] = await Promise.all([
				db.select({ audioUrl: chapters.audioUrl }).from(chapters).where(eq(chapters.volumeId, id)),
				db
					.select({ imageUrl: illustrations.imageUrl })
					.from(illustrations)
					.where(eq(illustrations.volumeId, id))
			]);

			await db.delete(volumes).where(eq(volumes.id, id));

			const mediaUrls = [
				old?.coverUrl,
				...volChapters.map((c) => c.audioUrl),
				...volIllustrations.map((i) => i.imageUrl)
			].filter((u): u is string => Boolean(u));
			await Promise.allSettled(mediaUrls.map((u) => deleteFromStorage(u)));
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: `Ошибка удаления тома: ${e instanceof Error ? e.message : String(e)}`
			});
		}
	}
};
