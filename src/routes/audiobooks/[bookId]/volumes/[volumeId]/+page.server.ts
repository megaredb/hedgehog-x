import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, volumes, chapters, listeningProgress } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { bookId, volumeId } = params;
	const user = locals.user;

	// Fetch book and volume to verify they exist and match
	const book = await db.query.books.findFirst({
		where: eq(books.id, bookId)
	});

	if (!book) {
		throw error(404, 'Книга не найдена');
	}

	const volume = await db.query.volumes.findFirst({
		where: and(eq(volumes.id, volumeId), eq(volumes.bookId, bookId))
	});

	if (!volume) {
		throw error(404, 'Том не найден');
	}

	// Fetch all chapters in the volume
	const volumeChapters = await db.query.chapters.findMany({
		where: eq(chapters.volumeId, volumeId),
		orderBy: (chapters, { asc }) => [asc(chapters.chapterNumber)]
	});

	// Fetch listening progress if user is logged in
	const progressMap: Record<string, { progressSeconds: number; isCompleted: boolean }> = {};
	if (user && volumeChapters.length > 0) {
		const chapterIds = volumeChapters.map((c) => c.id);
		const userProgress = await db.query.listeningProgress.findMany({
			where: and(
				eq(listeningProgress.userId, user.id),
				inArray(listeningProgress.chapterId, chapterIds)
			)
		});

		for (const p of userProgress) {
			progressMap[p.chapterId] = {
				progressSeconds: p.progressSeconds,
				isCompleted: p.isCompleted
			};
		}
	}

	return {
		book: {
			id: book.id,
			title: book.title,
			coverUrl: book.coverUrl,
			themeColor: book.themeColor,
			bookAuthor: 'Автор' // В нашей текущей схеме автора нет на уровне книги, мы можем выводить плейсхолдер или позже добавить
		},
		volume: {
			id: volume.id,
			volumeNumber: volume.volumeNumber,
			title: volume.title,
			coverUrl: volume.coverUrl
		},
		chapters: volumeChapters.map((c) => ({
			id: c.id,
			chapterNumber: c.chapterNumber,
			title: c.title,
			audioUrl: c.audioUrl,
			durationSeconds: c.durationSeconds,
			telegramPostUrl: c.telegramPostUrl,
			progress: progressMap[c.id] || null
		}))
	};
};
