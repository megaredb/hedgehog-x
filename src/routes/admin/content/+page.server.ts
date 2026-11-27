import { db } from '$lib/server/db';
import { isUniqueViolation } from '$lib/server/db/errors';
import {
	audioVersions,
	books,
	chapters,
	chapterAudioVersions,
	chapterIllustrations,
	illustrations,
	volumes
} from '$lib/server/db/schema';
import { asc, count, eq, ilike, inArray, max, or } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/admin';
import { sanitizeHttpUrl } from '$lib/server/site-content';
import {
	deleteFromStorage,
	MAX_AUDIO_BYTES,
	MAX_IMAGE_BYTES,
	MAX_VIDEO_BYTES,
	StorageValidationError,
	uploadAudio,
	uploadImage,
	uploadVideo
} from '$lib/server/storage/r2';
import { fail, type Actions } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { slugify } from '$lib/utils/slugify';
import { isValidContentStatus, isValidThemeColor } from '$lib/utils/validation';
import type { PageServerLoad } from './$types';
import type {
	AdminArchiveTrack,
	AdminAudioVersion,
	AdminBook,
	AdminChapter,
	AdminIllustration,
	AdminVolume,
	ContentIntent,
	ContentTab
} from '$lib/components/admin/content/types';

const VERSION_ID_PATTERN = /^[a-z0-9_-]{1,64}$/i;
const BOOK_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const VALID_TABS: ContentTab[] = ['chapters', 'illustrations', 'volume'];
const VALID_INTENTS: ContentIntent[] = ['book', 'volume', 'chapter', 'illustration'];
const BUILTIN_VERSION_PRESETS: Record<
	string,
	{ label: string; description: string; sortOrder: number }
> = {
	old: { label: 'Старая версия', description: 'OLD VERSION', sortOrder: 1 }
};

type EditTarget =
	| { kind: 'book'; bookId: string }
	| { kind: 'volume'; bookId: string; volumeId: string }
	| { kind: 'chapter'; bookId: string; volumeId: string; chapterId: string }
	| { kind: 'illustration'; bookId: string; volumeId: string; illustrationId: string };

export const load: PageServerLoad = async ({ locals, url }) => {
	requireAdmin(locals);

	const editId = url.searchParams.get('edit');
	let editTarget: EditTarget | null = null;
	if (editId) editTarget = await resolveEditTarget(editId);

	let requestedBookId = url.searchParams.get('book');
	let requestedVolumeId = url.searchParams.get('volume');
	let openChapterId = url.searchParams.get('chapter');
	const tabHint = url.searchParams.get('tab');
	let editBookId: string | null = null;
	let editIllustrationId: string | null = null;

	if (editTarget) {
		requestedBookId = editTarget.bookId;
		if (editTarget.kind === 'book') {
			editBookId = editTarget.bookId;
			requestedVolumeId = null;
		} else if (editTarget.kind === 'volume') {
			requestedVolumeId = editTarget.volumeId;
		} else if (editTarget.kind === 'chapter') {
			requestedVolumeId = editTarget.volumeId;
			openChapterId = editTarget.chapterId;
		} else {
			requestedVolumeId = editTarget.volumeId;
			editIllustrationId = editTarget.illustrationId;
		}
	}

	if (requestedVolumeId && !requestedBookId) {
		const [volumeRow] = await db
			.select({ bookId: volumes.bookId })
			.from(volumes)
			.where(eq(volumes.id, requestedVolumeId))
			.limit(1);
		if (volumeRow) requestedBookId = volumeRow.bookId;
		else requestedVolumeId = null;
	}

	if (openChapterId) {
		const [chapterRow] = await db
			.select({ id: chapters.id, volumeId: chapters.volumeId, bookId: volumes.bookId })
			.from(chapters)
			.innerJoin(volumes, eq(chapters.volumeId, volumes.id))
			.where(eq(chapters.id, openChapterId))
			.limit(1);
		if (chapterRow) {
			requestedBookId = chapterRow.bookId;
			requestedVolumeId = chapterRow.volumeId;
		} else {
			openChapterId = null;
		}
	}

	const intentValue = url.searchParams.get('new');
	const intent = VALID_INTENTS.includes(intentValue as ContentIntent)
		? (intentValue as ContentIntent)
		: null;

	const [bookRows, volumeCountRows] = await Promise.all([
		db.select().from(books).orderBy(asc(books.sortOrder), asc(books.title)),
		db.select({ bookId: volumes.bookId, total: count() }).from(volumes).groupBy(volumes.bookId)
	]);
	const volumeCountMap = new Map(
		volumeCountRows.map((row) => [row.bookId, Number(row.total ?? 0)])
	);
	const bookList: AdminBook[] = bookRows.map((book) => ({
		...book,
		volumeCount: volumeCountMap.get(book.id) ?? 0
	}));

	const selectedBook = bookList.find((book) => book.id === requestedBookId) ?? bookList[0] ?? null;

	let volumeRows: Array<typeof volumes.$inferSelect> = [];
	if (selectedBook) {
		volumeRows = await db
			.select()
			.from(volumes)
			.where(eq(volumes.bookId, selectedBook.id))
			.orderBy(asc(volumes.volumeNumber));
	}

	const volumeIds = volumeRows.map((volume) => volume.id);
	const [chapterCountRows, illustrationCountRows, archiveCountRows] = volumeIds.length
		? await Promise.all([
				db
					.select({ volumeId: chapters.volumeId, total: count() })
					.from(chapters)
					.where(inArray(chapters.volumeId, volumeIds))
					.groupBy(chapters.volumeId),
				db
					.select({ volumeId: illustrations.volumeId, total: count() })
					.from(illustrations)
					.where(inArray(illustrations.volumeId, volumeIds))
					.groupBy(illustrations.volumeId),
				db
					.select({ volumeId: chapters.volumeId, total: count() })
					.from(chapterAudioVersions)
					.innerJoin(chapters, eq(chapterAudioVersions.chapterId, chapters.id))
					.where(inArray(chapters.volumeId, volumeIds))
					.groupBy(chapters.volumeId)
			])
		: [[], [], []];
	const chapterCountMap = new Map(
		chapterCountRows.map((row) => [row.volumeId, Number(row.total ?? 0)])
	);
	const illustrationCountMap = new Map(
		illustrationCountRows.map((row) => [row.volumeId, Number(row.total ?? 0)])
	);
	const archiveCountMap = new Map(
		archiveCountRows.map((row) => [row.volumeId, Number(row.total ?? 0)])
	);

	const volumeList: AdminVolume[] = volumeRows.map((volume) => ({
		...volume,
		bookTitle: selectedBook?.title ?? '',
		chapterCount: chapterCountMap.get(volume.id) ?? 0,
		illustrationCount: illustrationCountMap.get(volume.id) ?? 0,
		archiveCount: archiveCountMap.get(volume.id) ?? 0
	}));
	const selectedVolume =
		volumeList.find((volume) => volume.id === requestedVolumeId) ?? volumeList[0] ?? null;

	let chapterList: AdminChapter[] = [];
	let trackList: AdminArchiveTrack[] = [];
	let illustrationList: AdminIllustration[] = [];
	let chapterIllustrationTimings: Array<{
		chapterId: string;
		illustrationId: string;
		showAtSeconds: number;
	}> = [];
	if (selectedVolume) {
		[chapterList, illustrationList] = await Promise.all([
			db
				.select()
				.from(chapters)
				.where(eq(chapters.volumeId, selectedVolume.id))
				.orderBy(asc(chapters.chapterNumber)),
			db
				.select()
				.from(illustrations)
				.where(eq(illustrations.volumeId, selectedVolume.id))
				.orderBy(asc(illustrations.sortOrder), asc(illustrations.createdAt), asc(illustrations.id))
		]);

		const chapterIds = chapterList.map((chapter) => chapter.id);
		if (chapterIds.length) {
			[trackList, chapterIllustrationTimings] = await Promise.all([
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
						chapterNumber: chapters.chapterNumber,
						chapterTitle: chapters.title,
						chapterAudioUrl: chapters.audioUrl
					})
					.from(chapterAudioVersions)
					.innerJoin(chapters, eq(chapterAudioVersions.chapterId, chapters.id))
					.where(inArray(chapterAudioVersions.chapterId, chapterIds))
					.orderBy(asc(chapters.chapterNumber), asc(chapterAudioVersions.createdAt)),
				db
					.select({
						chapterId: chapterIllustrations.chapterId,
						illustrationId: chapterIllustrations.illustrationId,
						showAtSeconds: chapterIllustrations.showAtSeconds
					})
					.from(chapterIllustrations)
					.where(inArray(chapterIllustrations.chapterId, chapterIds))
			]);
		}
	}

	if (openChapterId && !chapterList.some((chapter) => chapter.id === openChapterId)) {
		openChapterId = null;
	}

	const versionRows: AdminAudioVersion[] = await db
		.select()
		.from(audioVersions)
		.orderBy(asc(audioVersions.sortOrder), asc(audioVersions.id));

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	let search: {
		q: string;
		books: Array<{
			id: string;
			title: string;
			coverUrl: string | null;
			blurhash: string | null;
			status: string | null;
		}>;
		volumes: Array<{
			id: string;
			title: string;
			volumeNumber: number;
			bookId: string;
			bookTitle: string;
		}>;
		chapters: Array<{
			id: string;
			title: string;
			chapterNumber: number;
			durationSeconds: number;
			bookId: string;
			bookTitle: string;
			volumeId: string;
			volumeTitle: string;
			volumeNumber: number;
		}>;
		tracks: Array<{
			id: string;
			title: string;
			versionId: string;
			durationSeconds: number;
			chapterId: string;
			chapterTitle: string;
			chapterNumber: number;
			bookId: string;
			bookTitle: string;
			volumeId: string;
			volumeTitle: string;
			volumeNumber: number;
		}>;
		illustrations: Array<{
			id: string;
			caption: string | null;
			imageUrl: string;
			blurhash: string | null;
			sortOrder: number;
			bookId: string;
			bookTitle: string;
			volumeId: string;
			volumeTitle: string;
			volumeNumber: number;
		}>;
		total: number;
	} | null = null;

	if (q) {
		const pattern = '%' + q + '%';
		const [bookHits, volumeHits, chapterHits, trackHits, illustrationHits] = await Promise.all([
			db
				.select({
					id: books.id,
					title: books.title,
					coverUrl: books.coverUrl,
					blurhash: books.blurhash,
					status: books.status
				})
				.from(books)
				.where(or(ilike(books.title, pattern), ilike(books.id, pattern)))
				.orderBy(asc(books.sortOrder), asc(books.title))
				.limit(20),
			db
				.select({
					id: volumes.id,
					title: volumes.title,
					volumeNumber: volumes.volumeNumber,
					bookId: volumes.bookId,
					bookTitle: books.title
				})
				.from(volumes)
				.innerJoin(books, eq(volumes.bookId, books.id))
				.where(
					or(ilike(volumes.title, pattern), ilike(volumes.id, pattern), ilike(books.title, pattern))
				)
				.orderBy(asc(books.sortOrder), asc(volumes.volumeNumber))
				.limit(30),
			db
				.select({
					id: chapters.id,
					title: chapters.title,
					chapterNumber: chapters.chapterNumber,
					durationSeconds: chapters.durationSeconds,
					bookId: books.id,
					bookTitle: books.title,
					volumeId: volumes.id,
					volumeTitle: volumes.title,
					volumeNumber: volumes.volumeNumber
				})
				.from(chapters)
				.innerJoin(volumes, eq(chapters.volumeId, volumes.id))
				.innerJoin(books, eq(volumes.bookId, books.id))
				.where(or(ilike(chapters.title, pattern), ilike(chapters.id, pattern)))
				.orderBy(asc(books.sortOrder), asc(volumes.volumeNumber), asc(chapters.chapterNumber))
				.limit(30),
			db
				.select({
					id: chapterAudioVersions.id,
					title: chapterAudioVersions.title,
					versionId: chapterAudioVersions.versionId,
					durationSeconds: chapterAudioVersions.durationSeconds,
					chapterId: chapters.id,
					chapterTitle: chapters.title,
					chapterNumber: chapters.chapterNumber,
					bookId: books.id,
					bookTitle: books.title,
					volumeId: volumes.id,
					volumeTitle: volumes.title,
					volumeNumber: volumes.volumeNumber
				})
				.from(chapterAudioVersions)
				.innerJoin(chapters, eq(chapterAudioVersions.chapterId, chapters.id))
				.innerJoin(volumes, eq(chapters.volumeId, volumes.id))
				.innerJoin(books, eq(volumes.bookId, books.id))
				.where(
					or(
						ilike(chapterAudioVersions.title, pattern),
						ilike(chapterAudioVersions.versionId, pattern)
					)
				)
				.orderBy(asc(books.sortOrder), asc(volumes.volumeNumber), asc(chapters.chapterNumber))
				.limit(30),
			db
				.select({
					id: illustrations.id,
					caption: illustrations.caption,
					imageUrl: illustrations.imageUrl,
					blurhash: illustrations.blurhash,
					sortOrder: illustrations.sortOrder,
					bookId: books.id,
					bookTitle: books.title,
					volumeId: volumes.id,
					volumeTitle: volumes.title,
					volumeNumber: volumes.volumeNumber
				})
				.from(illustrations)
				.innerJoin(volumes, eq(illustrations.volumeId, volumes.id))
				.innerJoin(books, eq(volumes.bookId, books.id))
				.where(or(ilike(illustrations.caption, pattern), ilike(illustrations.id, pattern)))
				.orderBy(asc(books.sortOrder), asc(volumes.volumeNumber), asc(illustrations.sortOrder))
				.limit(20)
		]);
		search = {
			q,
			books: bookHits,
			volumes: volumeHits,
			chapters: chapterHits,
			tracks: trackHits,
			illustrations: illustrationHits,
			total:
				bookHits.length +
				volumeHits.length +
				chapterHits.length +
				trackHits.length +
				illustrationHits.length
		};
	}

	let tab: ContentTab = 'chapters';
	if (tabHint && VALID_TABS.includes(tabHint as ContentTab)) tab = tabHint as ContentTab;
	if (!tabHint) {
		if (intent === 'illustration' || editTarget?.kind === 'illustration') tab = 'illustrations';
		else if (intent === 'volume' || editTarget?.kind === 'volume') tab = 'volume';
	}

	return {
		books: bookList,
		volumes: volumeList,
		selectedBook,
		selectedVolume,
		chapters: chapterList,
		tracks: trackList,
		illustrations: illustrationList,
		chapterIllustrationTimings,
		audioVersions: versionRows,
		tab,
		intent,
		editBookId,
		editIllustrationId,
		openChapterId,
		q,
		search
	};
};

async function resolveEditTarget(id: string): Promise<EditTarget | null> {
	const [bookRow] = await db.select({ id: books.id }).from(books).where(eq(books.id, id)).limit(1);
	if (bookRow) return { kind: 'book', bookId: bookRow.id };

	const [volumeRow] = await db
		.select({ id: volumes.id, bookId: volumes.bookId })
		.from(volumes)
		.where(eq(volumes.id, id))
		.limit(1);
	if (volumeRow) return { kind: 'volume', bookId: volumeRow.bookId, volumeId: volumeRow.id };

	const [chapterRow] = await db
		.select({ id: chapters.id, volumeId: chapters.volumeId, bookId: volumes.bookId })
		.from(chapters)
		.innerJoin(volumes, eq(chapters.volumeId, volumes.id))
		.where(eq(chapters.id, id))
		.limit(1);
	if (chapterRow) {
		return {
			kind: 'chapter',
			bookId: chapterRow.bookId,
			volumeId: chapterRow.volumeId,
			chapterId: chapterRow.id
		};
	}

	const [illustrationRow] = await db
		.select({ id: illustrations.id, volumeId: illustrations.volumeId, bookId: volumes.bookId })
		.from(illustrations)
		.innerJoin(volumes, eq(illustrations.volumeId, volumes.id))
		.where(eq(illustrations.id, id))
		.limit(1);
	if (illustrationRow) {
		return {
			kind: 'illustration',
			bookId: illustrationRow.bookId,
			volumeId: illustrationRow.volumeId,
			illustrationId: illustrationRow.id
		};
	}

	return null;
}

type UploadFailure = { error: string; status: number };
type ImageUploadResult = {
	url: string;
	width: number;
	height: number;
	blurhash: string | null;
	themeColor?: string;
};

async function uploadImageFile(
	file: FormDataEntryValue | null,
	folder: string,
	filenamePrefix: string
): Promise<ImageUploadResult | UploadFailure | null> {
	if (!file || !(file instanceof File) || file.size === 0) return null;
	if (file.size > MAX_IMAGE_BYTES) {
		return { error: 'Размер изображения не должен превышать 15 МБ', status: 400 };
	}
	try {
		const uploaded = await uploadImage(Buffer.from(await file.arrayBuffer()), {
			folder,
			filenamePrefix
		});
		return {
			url: uploaded.url,
			width: uploaded.width,
			height: uploaded.height,
			blurhash: uploaded.blurhash,
			themeColor: uploaded.themeColor
		};
	} catch (e) {
		return {
			error: 'Ошибка загрузки изображения: ' + (e instanceof Error ? e.message : String(e)),
			status: e instanceof StorageValidationError ? 400 : 500
		};
	}
}

type AudioUploadResult = { url: string } | UploadFailure;
type VideoUploadResult = { url: string } | UploadFailure;

async function uploadAudioFile(file: FormDataEntryValue | null): Promise<AudioUploadResult | null> {
	if (!file || !(file instanceof File) || file.size === 0) return null;
	if (file.size > MAX_AUDIO_BYTES) {
		return { error: 'Размер аудиофайла не должен превышать 500 МБ', status: 400 };
	}
	try {
		const uploaded = await uploadAudio(Buffer.from(await file.arrayBuffer()), {
			originalFilename: file.name,
			contentType: file.type,
			folder: 'chapters'
		});
		return { url: uploaded.url };
	} catch (e) {
		return {
			error: 'Ошибка загрузки аудиофайла: ' + (e instanceof Error ? e.message : String(e)),
			status: e instanceof StorageValidationError ? 400 : 500
		};
	}
}

async function uploadVideoFile(file: FormDataEntryValue | null): Promise<VideoUploadResult | null> {
	if (!file || !(file instanceof File) || file.size === 0) return null;
	if (file.size > MAX_VIDEO_BYTES) {
		return { error: 'Размер видео не должен превышать 100 МБ', status: 400 };
	}
	try {
		const uploaded = await uploadVideo(Buffer.from(await file.arrayBuffer()), {
			originalFilename: file.name,
			contentType: file.type,
			folder: 'video'
		});
		return { url: uploaded.url };
	} catch (e) {
		return {
			error: 'Ошибка загрузки видео: ' + (e instanceof Error ? e.message : String(e)),
			status: e instanceof StorageValidationError ? 400 : 500
		};
	}
}

function isUploadFailure(value: unknown): value is UploadFailure {
	return Boolean(value && typeof value === 'object' && 'error' in value);
}

function parseInteger(value: FormDataEntryValue | null): number {
	const raw = String(value ?? '').trim();
	return raw ? Number.parseInt(raw, 10) : Number.NaN;
}

function parseNumber(value: FormDataEntryValue | null): number {
	const raw = String(value ?? '').trim();
	return raw ? Number.parseFloat(raw) : Number.NaN;
}

function text(form: FormData, key: string): string {
	return String(form.get(key) ?? '').trim();
}

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

async function removeAudioIfUnreferenced(audioUrl: string): Promise<void> {
	try {
		if (await isAudioReferenced(audioUrl)) return;
		await deleteFromStorage(audioUrl);
	} catch {
		// Best-effort cleanup: the database change already succeeded.
	}
}

export const actions: Actions = {
	booksReorder: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const ids = String(form.get('order') ?? '')
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean);
		if (ids.length === 0) return fail(400, { error: 'Пустой порядок книг' });
		if (new Set(ids).size !== ids.length) {
			return fail(400, { error: 'Порядок содержит повторяющиеся книги' });
		}
		const existing = await db.select({ id: books.id }).from(books);
		const existingIds = new Set(existing.map((row) => row.id));
		if (ids.some((id) => !existingIds.has(id))) {
			return fail(400, { error: 'Одна из книг не найдена' });
		}
		await db.transaction(async (tx) => {
			for (let index = 0; index < ids.length; index += 1) {
				await tx.update(books).set({ sortOrder: index }).where(eq(books.id, ids[index]));
			}
		});
		return { success: true };
	},

	bookSave: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const idInput = text(form, 'id');
		const title = text(form, 'title');
		const description = text(form, 'description') || null;
		const status = text(form, 'status') || 'ongoing';
		const rawTheme = text(form, 'themeColor').replace(/^#/, '') || null;
		const suppliedCoverUrl = text(form, 'coverUrl') || null;
		const suppliedHomeImageUrl = text(form, 'homeImageUrl') || null;
		const suppliedHomeVideoUrl = text(form, 'homeVideoUrl') || null;

		if (!title) return fail(400, { error: 'Название книги обязательно' });
		if (title.length > 255) return fail(400, { error: 'Название книги длиннее 255 символов' });
		if (!isValidContentStatus(status)) return fail(400, { error: 'Некорректный статус книги' });
		if (rawTheme && !isValidThemeColor(rawTheme)) {
			return fail(400, { error: 'Цвет темы должен состоять из 6 HEX-символов' });
		}

		const mode = text(form, 'mode');
		const isUpdate = mode ? mode === 'update' : Boolean(idInput);
		if (isUpdate && !idInput) {
			return fail(400, { error: 'ID книги обязателен' });
		}
		if (!isUpdate && idInput) {
			if (idInput.length > 128 || !BOOK_SLUG_PATTERN.test(idInput)) {
				return fail(400, {
					error:
						'ID книги должен содержать только строчные латинские буквы, цифры, «-» и «_» (до 128 символов)'
				});
			}
		}
		const id = isUpdate ? idInput : idInput || slugify(title) || randomUUID().slice(0, 8);
		let oldCoverUrl: string | null = null;
		let oldHomeImageUrl: string | null = null;
		let oldHomeVideoUrl: string | null = null;
		if (isUpdate) {
			const [existing] = await db
				.select({
					coverUrl: books.coverUrl,
					homeImageUrl: books.homeImageUrl,
					homeVideoUrl: books.homeVideoUrl
				})
				.from(books)
				.where(eq(books.id, id))
				.limit(1);
			if (!existing) return fail(404, { error: 'Книга не найдена' });
			oldCoverUrl = existing.coverUrl;
			oldHomeImageUrl = existing.homeImageUrl;
			oldHomeVideoUrl = existing.homeVideoUrl;
		} else {
			const [existing] = await db
				.select({ id: books.id })
				.from(books)
				.where(eq(books.id, id))
				.limit(1);
			if (existing) return fail(409, { error: 'Книга с таким ID уже существует' });
		}

		const uploaded = await uploadImageFile(form.get('coverFile'), 'books', id);
		if (isUploadFailure(uploaded)) return fail(uploaded.status, { error: uploaded.error });
		const uploadedHomeImage = await uploadImageFile(form.get('homeImageFile'), 'home', id);
		if (isUploadFailure(uploadedHomeImage)) {
			if (uploaded) await deleteFromStorage(uploaded.url).catch(() => {});
			return fail(uploadedHomeImage.status, { error: uploadedHomeImage.error });
		}
		const uploadedHomeVideo = await uploadVideoFile(form.get('homeVideoFile'));
		if (isUploadFailure(uploadedHomeVideo)) {
			if (uploaded) await deleteFromStorage(uploaded.url).catch(() => {});
			if (uploadedHomeImage) await deleteFromStorage(uploadedHomeImage.url).catch(() => {});
			return fail(uploadedHomeVideo.status, { error: uploadedHomeVideo.error });
		}
		let themeColor = rawTheme;
		if (!themeColor && uploaded?.themeColor) themeColor = uploaded.themeColor;
		const coverUrl = uploaded ? uploaded.url : suppliedCoverUrl;
		const homeImageUrl = uploadedHomeImage ? uploadedHomeImage.url : suppliedHomeImageUrl;
		const homeVideoUrl = uploadedHomeVideo ? uploadedHomeVideo.url : suppliedHomeVideoUrl;
		let sortOrder = 0;
		if (!isUpdate) {
			const [maxRow] = await db.select({ value: max(books.sortOrder) }).from(books);
			sortOrder = Number(maxRow?.value ?? -1) + 1;
		}

		try {
			if (isUpdate) {
				const data: Partial<typeof books.$inferInsert> = {
					title,
					description,
					status,
					themeColor: themeColor ? themeColor.slice(0, 6) : null
				};
				if (uploaded) {
					data.coverUrl = uploaded.url;
					data.coverWidth = uploaded.width;
					data.coverHeight = uploaded.height;
					data.blurhash = uploaded.blurhash;
				} else if (form.has('coverUrl')) {
					data.coverUrl = suppliedCoverUrl;
					if (!suppliedCoverUrl) {
						data.coverWidth = null;
						data.coverHeight = null;
						data.blurhash = null;
					}
				}
				if (uploadedHomeImage) data.homeImageUrl = uploadedHomeImage.url;
				else if (form.has('homeImageUrl')) data.homeImageUrl = suppliedHomeImageUrl;
				if (uploadedHomeVideo) data.homeVideoUrl = uploadedHomeVideo.url;
				else if (form.has('homeVideoUrl')) data.homeVideoUrl = suppliedHomeVideoUrl;
				await db.update(books).set(data).where(eq(books.id, id));
				if (data.coverUrl !== undefined && oldCoverUrl && oldCoverUrl !== data.coverUrl) {
					await deleteFromStorage(oldCoverUrl).catch(() => {});
				}
				if (
					data.homeImageUrl !== undefined &&
					oldHomeImageUrl &&
					oldHomeImageUrl !== data.homeImageUrl
				) {
					await deleteFromStorage(oldHomeImageUrl).catch(() => {});
				}
				if (
					data.homeVideoUrl !== undefined &&
					oldHomeVideoUrl &&
					oldHomeVideoUrl !== data.homeVideoUrl
				) {
					await deleteFromStorage(oldHomeVideoUrl).catch(() => {});
				}
				return { success: true, bookId: id };
			}

			await db.insert(books).values({
				id,
				title,
				description,
				status,
				coverUrl,
				coverWidth: uploaded?.width ?? null,
				coverHeight: uploaded?.height ?? null,
				blurhash: uploaded?.blurhash ?? null,
				homeImageUrl,
				homeVideoUrl,
				sortOrder,
				themeColor: themeColor ? themeColor.slice(0, 6) : null
			});
			return { success: true, bookId: id };
		} catch (e) {
			if (uploaded) await deleteFromStorage(uploaded.url).catch(() => {});
			if (uploadedHomeImage) await deleteFromStorage(uploadedHomeImage.url).catch(() => {});
			if (uploadedHomeVideo) await deleteFromStorage(uploadedHomeVideo.url).catch(() => {});
			if (isUniqueViolation(e)) {
				return fail(409, { error: 'Книга с таким ID уже существует' });
			}
			return fail(500, {
				error: 'Ошибка сохранения книги: ' + (e instanceof Error ? e.message : String(e))
			});
		}
	},

	volumeSave: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const idInput = text(form, 'id');
		const bookId = text(form, 'bookId');
		const volumeNumber = parseInteger(form.get('volumeNumber'));
		const title = text(form, 'title');
		const description = text(form, 'description') || null;
		const status = text(form, 'status') || 'ongoing';
		const suppliedCoverUrl = text(form, 'coverUrl') || null;

		if (!bookId) return fail(400, { error: 'Необходимо выбрать книгу' });
		if (!title) return fail(400, { error: 'Название тома обязательно' });
		if (title.length > 255) return fail(400, { error: 'Название тома длиннее 255 символов' });
		if (!Number.isInteger(volumeNumber) || volumeNumber < 0) {
			return fail(400, { error: 'Номер тома должен быть целым неотрицательным числом' });
		}
		if (!isValidContentStatus(status)) return fail(400, { error: 'Некорректный статус тома' });

		const [bookRow] = await db
			.select({ id: books.id })
			.from(books)
			.where(eq(books.id, bookId))
			.limit(1);
		if (!bookRow) return fail(404, { error: 'Книга не найдена' });

		const isUpdate = Boolean(idInput);
		const id = isUpdate
			? idInput
			: bookId + '_vol_' + volumeNumber + '_' + (slugify(title) || randomUUID().slice(0, 6));
		let oldCoverUrl: string | null = null;
		if (isUpdate) {
			const [existing] = await db
				.select({ coverUrl: volumes.coverUrl })
				.from(volumes)
				.where(eq(volumes.id, id))
				.limit(1);
			if (!existing) return fail(404, { error: 'Том не найден' });
			oldCoverUrl = existing.coverUrl;
		}

		const uploaded = await uploadImageFile(form.get('coverFile'), 'volumes', id);
		if (isUploadFailure(uploaded)) return fail(uploaded.status, { error: uploaded.error });
		const coverUrl = uploaded ? uploaded.url : suppliedCoverUrl;

		try {
			if (isUpdate) {
				const data: Partial<typeof volumes.$inferInsert> = {
					bookId,
					volumeNumber,
					title,
					description,
					status
				};
				if (uploaded) {
					data.coverUrl = uploaded.url;
					data.coverWidth = uploaded.width;
					data.coverHeight = uploaded.height;
					data.blurhash = uploaded.blurhash;
				} else if (form.has('coverUrl')) {
					data.coverUrl = suppliedCoverUrl;
					if (!suppliedCoverUrl) {
						data.coverWidth = null;
						data.coverHeight = null;
						data.blurhash = null;
					}
				}
				await db.update(volumes).set(data).where(eq(volumes.id, id));
				if (data.coverUrl !== undefined && oldCoverUrl && oldCoverUrl !== data.coverUrl) {
					await deleteFromStorage(oldCoverUrl).catch(() => {});
				}
				return { success: true, volumeId: id, bookId };
			}

			await db.insert(volumes).values({
				id,
				bookId,
				volumeNumber,
				title,
				description,
				coverUrl,
				coverWidth: uploaded?.width ?? null,
				coverHeight: uploaded?.height ?? null,
				blurhash: uploaded?.blurhash ?? null,
				status
			});
			return { success: true, volumeId: id, bookId };
		} catch (e) {
			if (uploaded) await deleteFromStorage(uploaded.url).catch(() => {});
			if (isUniqueViolation(e)) {
				return fail(400, { error: 'Том с таким ID или номером уже существует в этой книге' });
			}
			return fail(500, {
				error: 'Ошибка сохранения тома: ' + (e instanceof Error ? e.message : String(e))
			});
		}
	},

	chapterSave: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const idInput = text(form, 'id');
		const volumeId = text(form, 'volumeId');
		const chapterNumber = parseInteger(form.get('chapterNumber'));
		const title = text(form, 'title');
		const durationInput = parseNumber(form.get('durationSeconds'));
		const telegramPostUrl = text(form, 'telegramPostUrl') || null;
		const audioUrlInput = text(form, 'audioUrl');
		const published = String(form.get('published') ?? 'false') === 'true';

		if (!volumeId) return fail(400, { error: 'Необходимо выбрать том' });
		if (!title) return fail(400, { error: 'Название главы обязательно' });
		if (title.length > 255) return fail(400, { error: 'Название главы длиннее 255 символов' });
		if (!Number.isInteger(chapterNumber) || chapterNumber < 0) {
			return fail(400, { error: 'Номер главы должен быть целым неотрицательным числом' });
		}
		if (telegramPostUrl) {
			if (telegramPostUrl.length > 1024) {
				return fail(400, { error: 'Ссылка на Telegram длиннее 1024 символов' });
			}
			if (!sanitizeHttpUrl(telegramPostUrl, { allowTg: true })) {
				return fail(400, {
					error: 'Ссылка на Telegram должна использовать протокол http, https или tg'
				});
			}
		}

		const [volumeRow] = await db
			.select({ id: volumes.id, bookId: volumes.bookId })
			.from(volumes)
			.where(eq(volumes.id, volumeId))
			.limit(1);
		if (!volumeRow) return fail(404, { error: 'Том не найден' });

		const isUpdate = Boolean(idInput);
		let oldAudioUrl: string | null = null;
		if (isUpdate) {
			const [existing] = await db
				.select({ audioUrl: chapters.audioUrl })
				.from(chapters)
				.where(eq(chapters.id, idInput))
				.limit(1);
			if (!existing) return fail(404, { error: 'Глава не найдена' });
			oldAudioUrl = existing.audioUrl;
		}

		const uploaded = await uploadAudioFile(form.get('audioFile'));
		if (isUploadFailure(uploaded)) return fail(uploaded.status, { error: uploaded.error });

		const audioUrl = uploaded?.url || audioUrlInput || oldAudioUrl || '';
		if (!audioUrl) {
			return fail(400, { error: 'Необходимо загрузить аудиофайл или указать URL' });
		}
		if (audioUrl.length > 2048) {
			return fail(400, { error: 'URL аудио длиннее 2048 символов' });
		}

		const durationSeconds =
			Number.isFinite(durationInput) && durationInput >= 0
				? Math.min(durationInput, 2147483647)
				: 0;
		const id = isUpdate
			? idInput
			: volumeId + '_ch_' + chapterNumber + '_' + randomUUID().slice(0, 6);

		try {
			if (isUpdate) {
				await db
					.update(chapters)
					.set({
						volumeId,
						chapterNumber,
						title,
						audioUrl,
						durationSeconds,
						telegramPostUrl,
						published
					})
					.where(eq(chapters.id, id));
				if (oldAudioUrl && oldAudioUrl !== audioUrl) {
					await removeAudioIfUnreferenced(oldAudioUrl);
				}
				return { success: true, chapterId: id, bookId: volumeRow.bookId, volumeId };
			}

			await db.insert(chapters).values({
				id,
				volumeId,
				chapterNumber,
				title,
				audioUrl,
				durationSeconds,
				telegramPostUrl,
				published
			});
			return { success: true, chapterId: id, bookId: volumeRow.bookId, volumeId };
		} catch (e) {
			if (uploaded) await deleteFromStorage(uploaded.url).catch(() => {});
			if (isUniqueViolation(e)) {
				return fail(400, { error: 'Глава с таким номером уже существует в этом томе' });
			}
			return fail(500, {
				error: 'Ошибка сохранения главы: ' + (e instanceof Error ? e.message : String(e))
			});
		}
	},

	audioAdd: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const chapterId = text(form, 'chapterId');
		const versionId = text(form, 'versionId') || 'old';
		const title = text(form, 'title');
		const chapterStart = parseInteger(form.get('chapterStart'));
		const chapterEnd = parseInteger(form.get('chapterEnd'));
		const durationInput = parseNumber(form.get('durationSeconds'));
		const audioUrlInput = text(form, 'audioUrl');

		if (!chapterId) return fail(400, { error: 'Выберите главу' });
		if (!VERSION_ID_PATTERN.test(versionId) || versionId === 'default') {
			return fail(400, { error: 'Некорректный вид версии' });
		}
		if (!title) return fail(400, { error: 'Название версии обязательно' });
		if (title.length > 255) return fail(400, { error: 'Название версии длиннее 255 символов' });
		if (
			!Number.isInteger(chapterStart) ||
			!Number.isInteger(chapterEnd) ||
			chapterStart < 0 ||
			chapterEnd < chapterStart
		) {
			return fail(400, { error: 'Некорректный диапазон глав' });
		}

		const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
		if (!chapter) return fail(404, { error: 'Глава не найдена' });

		const uploaded = await uploadAudioFile(form.get('audioFile'));
		if (isUploadFailure(uploaded)) return fail(uploaded.status, { error: uploaded.error });
		const audioUrl = uploaded?.url || audioUrlInput || chapter.audioUrl;
		const duration =
			Number.isFinite(durationInput) && durationInput > 0
				? Math.min(durationInput, 2147483647)
				: chapter.durationSeconds;

		try {
			await ensureAudioVersion(versionId);
			await db.insert(chapterAudioVersions).values({
				id: chapter.id + ':' + versionId,
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
			if (uploaded) await deleteFromStorage(uploaded.url).catch(() => {});
			if (isUniqueViolation(e)) {
				return fail(400, {
					error: 'У этой главы уже есть версия такого вида. Выберите другой вид версии.'
				});
			}
			return fail(500, {
				error: 'Ошибка сохранения версии: ' + (e instanceof Error ? e.message : String(e))
			});
		}
	},

	audioPromote: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = text(form, 'id');
		if (!id) return fail(400, { error: 'Не указана версия' });

		const errorResult = await db.transaction(async (tx) => {
			const [track] = await tx
				.select()
				.from(chapterAudioVersions)
				.where(eq(chapterAudioVersions.id, id))
				.limit(1);
			if (!track) return { status: 404 as const, error: 'Версия не найдена' };
			if (track.chapterStart !== track.chapterEnd) {
				return { status: 400 as const, error: 'Нельзя сделать основной объединённую версию' };
			}

			const [chapter] = await tx
				.select()
				.from(chapters)
				.where(eq(chapters.id, track.chapterId))
				.limit(1);
			if (!chapter) return { status: 404 as const, error: 'Глава не найдена' };
			if (track.audioUrl === chapter.audioUrl) {
				return { status: 400 as const, error: 'Эта версия уже совпадает с текущей озвучкой' };
			}

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
			return null;
		});
		if (errorResult) return fail(errorResult.status, { error: errorResult.error });
		return { success: true };
	},

	audioDelete: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = text(form, 'id');
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
	},

	illustrationSave: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const idInput = text(form, 'id');
		const volumeId = text(form, 'volumeId');
		const caption = text(form, 'caption') || null;
		const sortOrderInput = parseInteger(form.get('sortOrder'));
		const suppliedImageUrl = text(form, 'imageUrl') || null;

		if (!volumeId) return fail(400, { error: 'Необходимо выбрать том' });
		if (caption && caption.length > 255)
			return fail(400, { error: 'Подпись длиннее 255 символов' });
		const [volumeRow] = await db
			.select({ id: volumes.id })
			.from(volumes)
			.where(eq(volumes.id, volumeId))
			.limit(1);
		if (!volumeRow) return fail(404, { error: 'Том не найден' });

		const isUpdate = Boolean(idInput);
		let oldImageUrl: string | null = null;
		let existingSortOrder: number | null = null;
		if (isUpdate) {
			const [existing] = await db
				.select({ imageUrl: illustrations.imageUrl, sortOrder: illustrations.sortOrder })
				.from(illustrations)
				.where(eq(illustrations.id, idInput))
				.limit(1);
			if (!existing) return fail(404, { error: 'Иллюстрация не найдена' });
			oldImageUrl = existing.imageUrl;
			existingSortOrder = existing.sortOrder;
		}

		const uploaded = await uploadImageFile(form.get('imageFile'), 'illustrations', volumeId);
		if (isUploadFailure(uploaded)) return fail(uploaded.status, { error: uploaded.error });
		const imageUrl = uploaded?.url || suppliedImageUrl || oldImageUrl || '';
		if (!imageUrl) return fail(400, { error: 'Необходимо прикрепить изображение или указать URL' });

		const sortOrder = Number.isInteger(sortOrderInput) ? sortOrderInput : (existingSortOrder ?? 0);
		const id = isUpdate ? idInput : 'ill_' + volumeId + '_' + randomUUID().slice(0, 8);

		const rawTimings: unknown = (() => {
			try {
				return JSON.parse(String(form.get('timings') ?? '[]'));
			} catch {
				return [];
			}
		})();
		const chapterRows = await db
			.select({ id: chapters.id, durationSeconds: chapters.durationSeconds })
			.from(chapters)
			.where(eq(chapters.volumeId, volumeId));
		const chapterById = new Map(chapterRows.map((chapter) => [chapter.id, chapter]));
		const timingRows: Array<{
			illustrationId: string;
			chapterId: string;
			showAtSeconds: number;
			sortOrder: number;
		}> = [];
		if (Array.isArray(rawTimings)) {
			const seen = new Set<string>();
			for (const item of rawTimings.slice(0, 50)) {
				if (!item || typeof item !== 'object') continue;
				const row = item as { chapterId?: unknown; showAtSeconds?: unknown };
				const chapterId = String(row.chapterId ?? '').trim();
				const chapter = chapterById.get(chapterId);
				if (!chapter || seen.has(chapterId)) continue;
				seen.add(chapterId);
				const seconds = Number(row.showAtSeconds);
				timingRows.push({
					illustrationId: id,
					chapterId,
					showAtSeconds: Math.max(
						0,
						Math.min(chapter.durationSeconds, Number.isFinite(seconds) ? seconds : 0)
					),
					sortOrder: timingRows.length
				});
			}
		}

		try {
			await db.transaction(async (tx) => {
				if (isUpdate) {
					const data: Partial<typeof illustrations.$inferInsert> = {
						volumeId,
						caption,
						sortOrder,
						imageUrl
					};
					if (uploaded?.blurhash) data.blurhash = uploaded.blurhash;
					await tx.update(illustrations).set(data).where(eq(illustrations.id, id));
					await tx.delete(chapterIllustrations).where(eq(chapterIllustrations.illustrationId, id));
					if (timingRows.length) {
						await tx.insert(chapterIllustrations).values(timingRows);
					}
					return;
				}

				await tx.insert(illustrations).values({
					id,
					volumeId,
					imageUrl,
					blurhash: uploaded?.blurhash ?? null,
					caption,
					sortOrder
				});
				if (timingRows.length) {
					await tx.insert(chapterIllustrations).values(timingRows);
				}
			});
			if (isUpdate && oldImageUrl && oldImageUrl !== imageUrl) {
				await deleteFromStorage(oldImageUrl).catch(() => {});
			}
			return { success: true, illustrationId: id };
		} catch (e) {
			if (uploaded) await deleteFromStorage(uploaded.url).catch(() => {});
			return fail(500, {
				error: 'Ошибка сохранения иллюстрации: ' + (e instanceof Error ? e.message : String(e))
			});
		}
	},

	illustrationMove: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = text(form, 'id');
		const direction = text(form, 'direction');
		if (!id || (direction !== 'up' && direction !== 'down')) {
			return fail(400, { error: 'Некорректный запрос' });
		}

		const [current] = await db
			.select()
			.from(illustrations)
			.where(eq(illustrations.id, id))
			.limit(1);
		if (!current) return fail(404, { error: 'Иллюстрация не найдена' });

		const rows = await db
			.select({ id: illustrations.id })
			.from(illustrations)
			.where(eq(illustrations.volumeId, current.volumeId))
			.orderBy(asc(illustrations.sortOrder), asc(illustrations.createdAt), asc(illustrations.id));
		const index = rows.findIndex((row) => row.id === id);
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (index === -1 || targetIndex < 0 || targetIndex >= rows.length) return { success: true };

		const swapped = [...rows];
		const temp = swapped[index];
		swapped[index] = swapped[targetIndex];
		swapped[targetIndex] = temp;
		await db.transaction(async (tx) => {
			for (const [order, row] of swapped.entries()) {
				await tx
					.update(illustrations)
					.set({ sortOrder: order })
					.where(eq(illustrations.id, row.id));
			}
		});
		return { success: true };
	},

	illustrationReorder: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const volumeId = text(form, 'volumeId');
		const submitted: unknown = (() => {
			try {
				return JSON.parse(String(form.get('order') ?? '[]'));
			} catch {
				return [];
			}
		})();
		if (!volumeId || !Array.isArray(submitted)) {
			return fail(400, { error: 'Некорректный запрос' });
		}

		const rows = await db
			.select({ id: illustrations.id })
			.from(illustrations)
			.where(eq(illustrations.volumeId, volumeId))
			.orderBy(asc(illustrations.sortOrder), asc(illustrations.createdAt), asc(illustrations.id));
		const timedRows = await db
			.select({ illustrationId: chapterIllustrations.illustrationId })
			.from(chapterIllustrations)
			.innerJoin(chapters, eq(chapterIllustrations.chapterId, chapters.id))
			.where(eq(chapters.volumeId, volumeId));
		const timedIds = new Set(timedRows.map((row) => row.illustrationId));
		const editableIds = rows.map((row) => row.id).filter((id) => !timedIds.has(id));
		const editableSet = new Set(editableIds);
		const ordered = submitted
			.map((value) => String(value))
			.filter((id, index, list) => editableSet.has(id) && list.indexOf(id) === index);
		for (const id of editableIds) {
			if (!ordered.includes(id)) ordered.push(id);
		}

		await db.transaction(async (tx) => {
			for (const [order, id] of ordered.entries()) {
				await tx.update(illustrations).set({ sortOrder: order }).where(eq(illustrations.id, id));
			}
		});
		return { success: true };
	},

	bookDelete: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = text(form, 'id');
		if (!id) return fail(400, { error: 'ID обязателен' });
		try {
			// R2 objects are intentionally preserved when a book is deleted.
			await db.delete(books).where(eq(books.id, id));
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: 'Ошибка удаления книги: ' + (e instanceof Error ? e.message : String(e))
			});
		}
	},

	volumeDelete: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = text(form, 'id');
		if (!id) return fail(400, { error: 'ID обязателен' });
		try {
			// R2 objects are intentionally preserved when a volume is deleted.
			await db.delete(volumes).where(eq(volumes.id, id));
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: 'Ошибка удаления тома: ' + (e instanceof Error ? e.message : String(e))
			});
		}
	},

	chapterDelete: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = text(form, 'id');
		if (!id) return fail(400, { error: 'ID обязателен' });
		try {
			// R2 objects are intentionally preserved when a chapter is deleted.
			await db.delete(chapters).where(eq(chapters.id, id));
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: 'Ошибка удаления главы: ' + (e instanceof Error ? e.message : String(e))
			});
		}
	},

	illustrationDelete: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = text(form, 'id');
		if (!id) return fail(400, { error: 'ID обязателен' });
		try {
			const [row] = await db
				.select({ imageUrl: illustrations.imageUrl })
				.from(illustrations)
				.where(eq(illustrations.id, id))
				.limit(1);
			await db.delete(illustrations).where(eq(illustrations.id, id));
			if (row?.imageUrl) await deleteFromStorage(row.imageUrl).catch(() => {});
			return { success: true };
		} catch (e) {
			return fail(500, {
				error: 'Ошибка удаления иллюстрации: ' + (e instanceof Error ? e.message : String(e))
			});
		}
	}
};
