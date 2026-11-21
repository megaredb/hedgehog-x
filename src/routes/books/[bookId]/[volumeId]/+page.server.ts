import { error } from '@sveltejs/kit';
import { asc, count, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	audioVersions,
	books,
	chapters,
	chapterAudioVersions,
	chapterLikes,
	illustrations,
	volumes
} from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [book] = await db.select().from(books).where(eq(books.id, params.bookId)).limit(1);
	if (!book) throw error(404, 'Книга не найдена');
	const allVolumes = await db
		.select()
		.from(volumes)
		.where(eq(volumes.bookId, book.id))
		.orderBy(asc(volumes.volumeNumber));
	const volume = allVolumes.find((v) => v.id === params.volumeId);
	if (!volume) throw error(404, 'Том не найден');
	const [chapterRows, illustrationRows, versionRows, chapterVersionRows] = await Promise.all([
		db
			.select()
			.from(chapters)
			.where(eq(chapters.volumeId, volume.id))
			.orderBy(asc(chapters.chapterNumber)),
		db
			.select()
			.from(illustrations)
			.where(eq(illustrations.volumeId, volume.id))
			.orderBy(asc(illustrations.sortOrder)),
		db.select().from(audioVersions).orderBy(asc(audioVersions.sortOrder)),
		db
			.select()
			.from(chapterAudioVersions)
			.innerJoin(chapters, eq(chapterAudioVersions.chapterId, chapters.id))
			.where(eq(chapters.volumeId, volume.id))
			.orderBy(asc(chapterAudioVersions.chapterStart))
	]);
	const chapterVersionLikes = chapterRows.length
		? await db
				.select({
					chapterId: chapterLikes.chapterId,
					versionId: chapterLikes.versionId,
					count: count()
				})
				.from(chapterLikes)
				.where(
					inArray(
						chapterLikes.chapterId,
						chapterRows.map((chapter) => chapter.id)
					)
				)
				.groupBy(chapterLikes.chapterId, chapterLikes.versionId)
		: [];
	return {
		bookId: params.bookId,
		volumeId: params.volumeId,
		book,
		volume,
		volumes: allVolumes,
		chapters: chapterRows,
		illustrations: illustrationRows,
		audioVersions: versionRows,
		chapterVersions: chapterVersionRows.map(({ chapter_audio_versions }) => chapter_audio_versions),
		chapterVersionLikes
	};
};
