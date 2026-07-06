import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { listeningProgress, volumeLikes, chapters, volumes, books } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return {
			history: [],
			likedVolumes: [],
			isGuest: true
		};
	}

	// Fetch listening history (joined with chapter, volume, and book details)
	const historyRecords = await db
		.select({
			chapterId: listeningProgress.chapterId,
			progressSeconds: listeningProgress.progressSeconds,
			isCompleted: listeningProgress.isCompleted,
			updatedAt: listeningProgress.updatedAt,
			chapterTitle: chapters.title,
			chapterNumber: chapters.chapterNumber,
			durationSeconds: chapters.durationSeconds,
			volumeId: volumes.id,
			volumeTitle: volumes.title,
			volumeNumber: volumes.volumeNumber,
			bookId: books.id,
			bookTitle: books.title,
			coverUrl: books.coverUrl
		})
		.from(listeningProgress)
		.innerJoin(chapters, eq(listeningProgress.chapterId, chapters.id))
		.innerJoin(volumes, eq(chapters.volumeId, volumes.id))
		.innerJoin(books, eq(volumes.bookId, books.id))
		.where(eq(listeningProgress.userId, user.id))
		.orderBy(desc(listeningProgress.updatedAt))
		.limit(20);

	// Fetch liked volumes (joined with book details)
	const likedVolumesRecords = await db
		.select({
			volumeId: volumeLikes.volumeId,
			createdAt: volumeLikes.createdAt,
			volumeTitle: volumes.title,
			volumeNumber: volumes.volumeNumber,
			volumeCoverUrl: volumes.coverUrl,
			bookId: books.id,
			bookTitle: books.title,
			bookCoverUrl: books.coverUrl
		})
		.from(volumeLikes)
		.innerJoin(volumes, eq(volumeLikes.volumeId, volumes.id))
		.innerJoin(books, eq(volumes.bookId, books.id))
		.where(eq(volumeLikes.userId, user.id))
		.orderBy(desc(volumeLikes.createdAt));

	return {
		history: historyRecords.map((h) => ({
			chapterId: h.chapterId,
			progressSeconds: h.progressSeconds,
			isCompleted: h.isCompleted,
			updatedAt: h.updatedAt.toISOString(),
			chapterTitle: h.chapterTitle,
			chapterNumber: h.chapterNumber,
			durationSeconds: h.durationSeconds,
			volumeId: h.volumeId,
			volumeTitle: h.volumeTitle,
			volumeNumber: h.volumeNumber,
			bookId: h.bookId,
			bookTitle: h.bookTitle,
			coverUrl: h.coverUrl
		})),
		likedVolumes: likedVolumesRecords.map((l) => ({
			volumeId: l.volumeId,
			createdAt: l.createdAt.toISOString(),
			volumeTitle: l.volumeTitle,
			volumeNumber: l.volumeNumber,
			coverUrl: l.volumeCoverUrl || l.bookCoverUrl,
			bookId: l.bookId,
			bookTitle: l.bookTitle
		})),
		isGuest: false
	};
};
