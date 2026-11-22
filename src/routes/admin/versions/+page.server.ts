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

const VERSION_ID_PATTERN = /^[a-z0-9_-]{1,64}$/i;
const MAX_TITLE_LENGTH = 255;

/** Built-in version kinds that are created lazily when the archive uses them. */
const BUILTIN_VERSION_PRESETS: Record<
	string,
	{ label: string; description: string; sortOrder: number }
> = {
	old: { label: 'Старая версия', description: 'OLD VERSION', sortOrder: 1 }
};

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const [chapterRows, versions, tracks] = await Promise.all([
		db
			.select({
				id: chapters.id,
				title: chapters.title,
				chapterNumber: chapters.chapterNumber,
				volumeId: chapters.volumeId,
				volumeTitle: volumes.title,
				volumeNumber: volumes.volumeNumber,
				bookId: books.id,
				bookTitle: books.title,
				audioUrl: chapters.audioUrl,
				telegramPostUrl: chapters.telegramPostUrl,
				durationSeconds: chapters.durationSeconds
			})
			.from(chapters)
			.innerJoin(volumes, eq(chapters.volumeId, volumes.id))
			.innerJoin(books, eq(volumes.bookId, books.id))
			.orderBy(asc(books.title), asc(volumes.volumeNumber), asc(chapters.chapterNumber)),
		db.select().from(audioVersions).orderBy(asc(audioVersions.sortOrder), asc(audioVersions.id)),
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
				createdAt: chapterAudioVersions.createdAt,
				chapterTitle: chapters.title,
				chapterNumber: chapters.chapterNumber,
				chapterAudioUrl: chapters.audioUrl,
				volumeId: volumes.id,
				volumeTitle: volumes.title,
				volumeNumber: volumes.volumeNumber,
				bookId: books.id,
				bookTitle: books.title
			})
			.from(chapterAudioVersions)
			.innerJoin(chapters, eq(chapterAudioVersions.chapterId, chapters.id))
			.innerJoin(volumes, eq(chapters.volumeId, volumes.id))
			.innerJoin(books, eq(volumes.bookId, books.id))
			.orderBy(
				asc(books.title),
				asc(volumes.volumeNumber),
				asc(chapters.chapterNumber),
				asc(chapterAudioVersions.createdAt)
			)
	]);

	return { chapters: chapterRows, versions, tracks };
};

function parseInteger(value: FormDataEntryValue | null): number {
	const raw = String(value ?? '').trim();
	return raw ? Number.parseInt(raw, 10) : Number.NaN;
}

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code === '23505'
	);
}

/** Creates the version kind on first use so fresh databases can still archive audio. */
async function ensureAudioVersion(versionId: string): Promise<void> {
	const [existing] = await db
		.select({ id: audioVersions.id })
		.from(audioVersions)
		.where(eq(audioVersions.id, versionId))
		.limit(1);
	if (existing) return;

	const preset = BUILTIN_VERSION_PRESETS[versionId];
	await db
		.insert(audioVersions)
		.values({
			id: versionId,
			label: preset?.label ?? versionId,
			description: preset?.description ?? null,
			sortOrder: preset?.sortOrder ?? 10
		})
		.onConflictDoNothing();
}

async function isAudioReferenced(audioUrl: string): Promise<boolean> {
	if (!audioUrl) return false;

	const [chapterRef] = await db
		.select({ id: chapters.id })
		.from(chapters)
		.where(eq(chapters.audioUrl, audioUrl))
		.limit(1);
	if (chapterRef) return true;

	const [versionRef] = await db
		.select({ id: chapterAudioVersions.id })
		.from(chapterAudioVersions)
		.where(eq(chapterAudioVersions.audioUrl, audioUrl))
		.limit(1);
	return Boolean(versionRef);
}

/** Removes a track from storage only when no chapter or archive entry points at it. */
async function removeAudioIfUnreferenced(audioUrl: string): Promise<void> {
	try {
		if (await isAudioReferenced(audioUrl)) return;
		await deleteFromStorage(audioUrl);
	} catch {
		// Best-effort cleanup: the database change already succeeded.
	}
}

type UploadResult =
	| { url: string; error?: never; status?: never }
	| {
			url?: never;
			error: string;
			status: number;
	  };

async function uploadAudioFile(file: FormDataEntryValue | null): Promise<UploadResult> {
	if (!file || !(file instanceof File) || file.size === 0) return { url: '' };
	if (file.size > MAX_AUDIO_BYTES) return { error: 'Аудиофайл больше 500 МБ', status: 400 };

	try {
		const uploaded = await uploadAudio(Buffer.from(await file.arrayBuffer()), {
			originalFilename: file.name,
			contentType: file.type,
			folder: 'chapters'
		});
		return { url: uploaded.url };
	} catch (e) {
		return {
			error: `Ошибка загрузки: ${e instanceof Error ? e.message : String(e)}`,
			status: e instanceof StorageValidationError ? 400 : 500
		};
	}
}

export const actions: Actions = {
	add: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const chapterId = String(form.get('chapterId') ?? '').trim();
		const versionId = String(form.get('versionId') ?? 'old').trim() || 'old';
		const title = String(form.get('title') ?? '').trim();
		const chapterStart = parseInteger(form.get('chapterStart'));
		const chapterEnd = parseInteger(form.get('chapterEnd'));
		const durationSeconds = parseInteger(form.get('durationSeconds'));
		const audioFile = form.get('audioFile');
		const audioUrlInput = String(form.get('audioUrl') ?? '').trim();

		if (!chapterId) return fail(400, { error: 'Выберите главу' });
		if (!VERSION_ID_PATTERN.test(versionId) || versionId === 'default') {
			return fail(400, { error: 'Некорректный вид версии' });
		}
		if (!title) return fail(400, { error: 'Название версии обязательно' });
		if (title.length > MAX_TITLE_LENGTH) {
			return fail(400, { error: 'Название версии длиннее 255 символов' });
		}

		const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
		if (!chapter) return fail(400, { error: 'Глава не найдена' });

		if (
			!Number.isInteger(chapterStart) ||
			!Number.isInteger(chapterEnd) ||
			chapterStart < 0 ||
			chapterEnd < chapterStart
		) {
			return fail(400, { error: 'Некорректный диапазон глав' });
		}

		const uploaded = await uploadAudioFile(audioFile);
		if (uploaded.error) return fail(uploaded.status, { error: uploaded.error });

		// Without a file or URL the archive entry references the current chapter audio.
		const audioUrl = uploaded.url || audioUrlInput || chapter.audioUrl;
		const duration =
			Number.isFinite(durationSeconds) && durationSeconds > 0
				? durationSeconds
				: chapter.durationSeconds;

		try {
			await ensureAudioVersion(versionId);
			await db.insert(chapterAudioVersions).values({
				id: `${chapter.id}:${versionId}`,
				chapterId: chapter.id,
				versionId,
				title,
				audioUrl,
				durationSeconds: duration,
				chapterStart,
				chapterEnd
			});
			return { success: true };
		} catch (e) {
			if (uploaded.url) await deleteFromStorage(uploaded.url).catch(() => {});
			if (isUniqueViolation(e)) {
				return fail(400, {
					error: 'У этой главы уже есть версия такого вида. Выберите другой вид версии.'
				});
			}
			return fail(500, {
				error: `Не удалось сохранить версию: ${e instanceof Error ? e.message : String(e)}`
			});
		}
	},

	updateCurrent: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const chapterId = String(form.get('chapterId') ?? '').trim();
		if (!chapterId) return fail(400, { error: 'Выберите главу' });

		const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
		if (!chapter) return fail(400, { error: 'Глава не найдена' });

		const audioFile = form.get('audioFile');
		const audioUrlInput = String(form.get('audioUrl') ?? '').trim();
		const telegramPostUrl = String(form.get('telegramPostUrl') ?? '').trim() || null;
		const durationInput = parseInteger(form.get('durationSeconds'));

		const uploaded = await uploadAudioFile(audioFile);
		if (uploaded.error) return fail(uploaded.status, { error: uploaded.error });

		let audioUrl = chapter.audioUrl;
		if (uploaded.url) audioUrl = uploaded.url;
		else if (audioUrlInput) audioUrl = audioUrlInput;

		const durationSeconds =
			Number.isFinite(durationInput) && durationInput > 0 ? durationInput : chapter.durationSeconds;

		try {
			await db
				.update(chapters)
				.set({ audioUrl, durationSeconds, telegramPostUrl })
				.where(eq(chapters.id, chapterId));
		} catch (e) {
			if (uploaded.url) await deleteFromStorage(uploaded.url).catch(() => {});
			return fail(500, {
				error: `Не удалось обновить новую версию: ${e instanceof Error ? e.message : String(e)}`
			});
		}

		if (audioUrl !== chapter.audioUrl) {
			await removeAudioIfUnreferenced(chapter.audioUrl);
		}
		return { success: true };
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
					title: chapter.title,
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

		await db.delete(chapterAudioVersions).where(eq(chapterAudioVersions.id, id));
		await removeAudioIfUnreferenced(track.audioUrl);
		return { success: true };
	}
};
