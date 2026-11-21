import { db } from '$lib/server/db';
import {
	audioVersions,
	books,
	chapters,
	chapterAudioVersions,
	volumes
} from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/admin';
import { fail, type Actions } from '@sveltejs/kit';
import {
	deleteFromStorage,
	MAX_AUDIO_BYTES,
	StorageValidationError,
	uploadAudio
} from '$lib/server/storage/r2';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const [chaptersRows, versions, tracks] = await Promise.all([
		db
			.select({
				id: chapters.id,
				title: chapters.title,
				chapterNumber: chapters.chapterNumber,
				volumeId: chapters.volumeId,
				volumeTitle: volumes.title,
				volumeNumber: volumes.volumeNumber,
				bookTitle: books.title,
				audioUrl: chapters.audioUrl,
				durationSeconds: chapters.durationSeconds
			})
			.from(chapters)
			.innerJoin(volumes, eq(chapters.volumeId, volumes.id))
			.innerJoin(books, eq(volumes.bookId, books.id))
			.orderBy(asc(books.title), asc(volumes.volumeNumber), asc(chapters.chapterNumber)),
		db.select().from(audioVersions).orderBy(asc(audioVersions.sortOrder)),
		db
			.select({
				id: chapterAudioVersions.id,
				chapterId: chapterAudioVersions.chapterId,
				versionId: chapterAudioVersions.versionId,
				title: chapterAudioVersions.title,
				audioUrl: chapterAudioVersions.audioUrl,
				durationSeconds: chapterAudioVersions.durationSeconds,
				chapterStart: chapterAudioVersions.chapterStart,
				chapterEnd: chapterAudioVersions.chapterEnd,
				chapterTitle: chapters.title,
				chapterNumber: chapters.chapterNumber,
				volumeTitle: volumes.title,
				bookTitle: books.title
			})
			.from(chapterAudioVersions)
			.innerJoin(chapters, eq(chapterAudioVersions.chapterId, chapters.id))
			.innerJoin(volumes, eq(chapters.volumeId, volumes.id))
			.innerJoin(books, eq(volumes.bookId, books.id))
			.orderBy(asc(books.title), asc(volumes.volumeNumber), asc(chapters.chapterNumber))
	]);

	return { chapters: chaptersRows, versions, tracks };
};

function parseNumber(value: FormDataEntryValue | null): number {
	return Number.parseInt(String(value ?? ''), 10);
}

export const actions: Actions = {
	add: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const chapterId = String(form.get('chapterId') ?? '').trim();
		const versionId = String(form.get('versionId') ?? 'old').trim() || 'old';
		const title = String(form.get('title') ?? '').trim();
		const chapterStart = parseNumber(form.get('chapterStart'));
		const chapterEnd = parseNumber(form.get('chapterEnd'));
		const durationSeconds = parseNumber(form.get('durationSeconds'));
		const audioFile = form.get('audioFile');
		const audioUrlInput = String(form.get('audioUrl') ?? '').trim();

		if (!chapterId) return fail(400, { error: 'Выберите главу' });
		const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
		if (!chapter) return fail(400, { error: 'Глава не найдена' });
		if (!title) return fail(400, { error: 'Название версии обязательно' });
		if (
			!Number.isInteger(chapterStart) ||
			!Number.isInteger(chapterEnd) ||
			chapterStart > chapterEnd
		) {
			return fail(400, { error: 'Некорректный диапазон глав' });
		}

		let uploadedUrl: string | null = null;
		let audioUrl = audioUrlInput;
		if (audioFile && audioFile instanceof File && audioFile.size > 0) {
			if (audioFile.size > MAX_AUDIO_BYTES) return fail(400, { error: 'Аудиофайл больше 500 МБ' });
			try {
				const uploaded = await uploadAudio(Buffer.from(await audioFile.arrayBuffer()), {
					originalFilename: audioFile.name,
					contentType: audioFile.type,
					folder: 'chapters'
				});
				uploadedUrl = uploaded.url;
				audioUrl = uploaded.url;
			} catch (e) {
				return fail(e instanceof StorageValidationError ? 400 : 500, {
					error: `Ошибка загрузки: ${e instanceof Error ? e.message : String(e)}`
				});
			}
		}
		if (!audioUrl) {
			// Snapshot: keep a reference to the current default audio. The chapter
			// update action must not delete a file referenced by an archive track.
			audioUrl = chapter.audioUrl;
		}

		try {
			await db.insert(chapterAudioVersions).values({
				id: `${chapter.id}:${versionId}`,
				chapterId: chapter.id,
				versionId,
				title,
				audioUrl,
				durationSeconds:
					Number.isFinite(durationSeconds) && durationSeconds > 0
						? durationSeconds
						: chapter.durationSeconds,
				chapterStart,
				chapterEnd
			});
			return { success: true };
		} catch (e) {
			if (uploadedUrl) await deleteFromStorage(uploadedUrl).catch(() => {});
			return fail(500, {
				error: `Не удалось сохранить версию: ${e instanceof Error ? e.message : String(e)}`
			});
		}
	},

	promote: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Не указана версия' });

		const [track] = await db
			.select()
			.from(chapterAudioVersions)
			.where(eq(chapterAudioVersions.id, id))
			.limit(1);
		if (!track) return fail(404, { error: 'Версия не найдена' });
		if (track.chapterStart !== track.chapterEnd) {
			return fail(400, {
				error: 'Нельзя сделать основной объединённую версию. Сначала разделите её на главы.'
			});
		}
		const [chapter] = await db
			.select()
			.from(chapters)
			.where(eq(chapters.id, track.chapterId))
			.limit(1);
		if (!chapter) return fail(404, { error: 'Глава не найдена' });

		await db.transaction(async (tx) => {
			await tx
				.update(chapters)
				.set({ audioUrl: track.audioUrl, durationSeconds: track.durationSeconds })
				.where(eq(chapters.id, chapter.id));
			await tx
				.update(chapterAudioVersions)
				.set({
					audioUrl: chapter.audioUrl,
					durationSeconds: chapter.durationSeconds,
					title: track.title,
					chapterStart: chapter.chapterNumber,
					chapterEnd: chapter.chapterNumber
				})
				.where(eq(chapterAudioVersions.id, track.id));
		});
		return { success: true };
	},

	delete: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Не указана версия' });
		const [track] = await db
			.select()
			.from(chapterAudioVersions)
			.where(eq(chapterAudioVersions.id, id))
			.limit(1);
		if (!track) return fail(404, { error: 'Версия не найдена' });
		const [chapter] = await db
			.select({ audioUrl: chapters.audioUrl })
			.from(chapters)
			.where(eq(chapters.id, track.chapterId))
			.limit(1);
		await db.delete(chapterAudioVersions).where(eq(chapterAudioVersions.id, id));
		if (track.audioUrl !== chapter?.audioUrl) {
			await deleteFromStorage(track.audioUrl).catch(() => {});
		}
		return { success: true };
	}
};
