import { db } from '$lib/server/db';
import { books, volumes, chapters } from '$lib/server/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/admin';
import { uploadAudio } from '$lib/server/storage/r2';
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

	const allChaptersQuery = db
		.select({
			id: chapters.id,
			volumeId: chapters.volumeId,
			chapterNumber: chapters.chapterNumber,
			title: chapters.title,
			audioUrl: chapters.audioUrl,
			durationSeconds: chapters.durationSeconds,
			telegramPostUrl: chapters.telegramPostUrl,
			createdAt: chapters.createdAt,
			updatedAt: chapters.updatedAt,
			volumeTitle: volumes.title,
			volumeNumber: volumes.volumeNumber,
			bookId: volumes.bookId,
			bookTitle: books.title
		})
		.from(chapters)
		.leftJoin(volumes, eq(chapters.volumeId, volumes.id))
		.leftJoin(books, eq(volumes.bookId, books.id));

	const allChapters = selectedVolumeId
		? await allChaptersQuery
				.where(eq(chapters.volumeId, selectedVolumeId))
				.orderBy(asc(chapters.chapterNumber))
		: await allChaptersQuery.orderBy(desc(chapters.updatedAt)).limit(100);

	const editId = url.searchParams.get('edit');
	const editChapter = editId ? allChapters.find((c) => c.id === editId) : null;

	return {
		volumes: allVolumes,
		chapters: allChapters,
		selectedVolumeId,
		editChapter
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();

		let id = (form.get('id') as string)?.trim();
		const volumeId = (form.get('volumeId') as string)?.trim();
		const chapterNumber = parseInt(form.get('chapterNumber') as string, 10);
		const title = (form.get('title') as string)?.trim();
		let durationSeconds = parseInt(form.get('durationSeconds') as string, 10);
		const telegramPostUrl = (form.get('telegramPostUrl') as string)?.trim() || null;
		let audioUrl = (form.get('audioUrl') as string)?.trim() || '';

		if (!volumeId) {
			return fail(400, { error: 'Необходимо выбрать том' });
		}
		if (!title) {
			return fail(400, { error: 'Название главы обязательно' });
		}
		if (isNaN(chapterNumber)) {
			return fail(400, { error: 'Номер главы должен быть числом' });
		}
		if (isNaN(durationSeconds) || durationSeconds < 0) {
			durationSeconds = 0;
		}

		if (!id) {
			id = `${volumeId}_ch_${chapterNumber}_${randomUUID().slice(0, 6)}`;
		}

		const audioFile = form.get('audioFile');
		if (audioFile && audioFile instanceof File && audioFile.size > 0) {
			try {
				const buffer = Buffer.from(await audioFile.arrayBuffer());
				const uploaded = await uploadAudio(buffer, {
					originalFilename: audioFile.name,
					contentType: audioFile.type,
					folder: 'chapters'
				});
				audioUrl = uploaded.url;
			} catch (e) {
				return fail(500, {
					error: `Ошибка загрузки аудиофайла: ${e instanceof Error ? e.message : String(e)}`
				});
			}
		}

		if (!audioUrl) {
			return fail(400, { error: 'Необходимо загрузить аудиофайл или указать URL' });
		}

		try {
			await db.insert(chapters).values({
				id,
				volumeId,
				chapterNumber,
				title,
				audioUrl,
				durationSeconds,
				telegramPostUrl
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
		const chapterNumber = parseInt(form.get('chapterNumber') as string, 10);
		const title = (form.get('title') as string)?.trim();
		let durationSeconds = parseInt(form.get('durationSeconds') as string, 10);
		const telegramPostUrl = (form.get('telegramPostUrl') as string)?.trim() || null;
		let audioUrl = (form.get('audioUrl') as string)?.trim() || null;

		if (!id || !volumeId || !title || isNaN(chapterNumber)) {
			return fail(400, { error: 'Все ключевые поля обязательны' });
		}
		if (isNaN(durationSeconds) || durationSeconds < 0) {
			durationSeconds = 0;
		}

		const audioFile = form.get('audioFile');
		if (audioFile && audioFile instanceof File && audioFile.size > 0) {
			try {
				const buffer = Buffer.from(await audioFile.arrayBuffer());
				const uploaded = await uploadAudio(buffer, {
					originalFilename: audioFile.name,
					contentType: audioFile.type,
					folder: 'chapters'
				});
				audioUrl = uploaded.url;
			} catch (e) {
				return fail(500, {
					error: `Ошибка загрузки аудиофайла: ${e instanceof Error ? e.message : String(e)}`
				});
			}
		}

		try {
			const updateData: {
				volumeId: string;
				chapterNumber: number;
				title: string;
				durationSeconds: number;
				telegramPostUrl: string | null;
				audioUrl?: string;
			} = {
				volumeId,
				chapterNumber,
				title,
				durationSeconds,
				telegramPostUrl
			};

			if (audioUrl) {
				updateData.audioUrl = audioUrl;
			}

			await db.update(chapters).set(updateData).where(eq(chapters.id, id));
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: `Ошибка обновления главы: ${e instanceof Error ? e.message : String(e)}`
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
			await db.delete(chapters).where(eq(chapters.id, id));
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: `Ошибка удаления главы: ${e instanceof Error ? e.message : String(e)}`
			});
		}
	}
};
