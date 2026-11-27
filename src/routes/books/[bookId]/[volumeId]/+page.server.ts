import { error } from '@sveltejs/kit';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	audioVersions,
	books,
	chapters,
	chapterAudioVersions,
	chapterIllustrations,
	chapterLikes,
	illustrations,
	listeningProgress,
	volumes
} from '$lib/server/db/schema';
import { loadSitePage } from '$lib/server/site-content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const [book] = await db.select().from(books).where(eq(books.id, params.bookId)).limit(1);
	if (!book) throw error(404, 'Книга не найдена');
	const allVolumes = await db
		.select()
		.from(volumes)
		.where(eq(volumes.bookId, book.id))
		.orderBy(asc(volumes.volumeNumber));
	const volume = allVolumes.find((v) => v.id === params.volumeId);
	if (!volume) throw error(404, 'Том не найден');
	const [chapterRows, illustrationRows, versionRows, chapterVersionRows, supportPage] =
		await Promise.all([
			db
				.select()
				.from(chapters)
				.where(and(eq(chapters.volumeId, volume.id), eq(chapters.published, true)))
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
				.where(and(eq(chapters.volumeId, volume.id), eq(chapters.published, true)))
				.orderBy(asc(chapterAudioVersions.chapterStart)),
			loadSitePage('support')
		]);
	const chapterIllustrationTimings = chapterRows.length
		? await db
				.select({
					chapterId: chapterIllustrations.chapterId,
					illustrationId: chapterIllustrations.illustrationId,
					showAtSeconds: chapterIllustrations.showAtSeconds
				})
				.from(chapterIllustrations)
				.where(
					inArray(
						chapterIllustrations.chapterId,
						chapterRows.map((chapter) => chapter.id)
					)
				)
		: [];
	const serverProgress =
		locals.user && chapterRows.length
			? await db
					.select({
						chapterId: listeningProgress.chapterId,
						versionId: listeningProgress.versionId,
						progressSeconds: listeningProgress.progressSeconds,
						isCompleted: listeningProgress.isCompleted,
						updatedAt: listeningProgress.updatedAt
					})
					.from(listeningProgress)
					.where(
						and(
							eq(listeningProgress.userId, locals.user.id),
							inArray(
								listeningProgress.chapterId,
								chapterRows.map((chapter) => chapter.id)
							)
						)
					)
			: [];

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
		chapterIllustrationTimings,
		audioVersions: versionRows,
		chapterVersions: chapterVersionRows.map(({ chapter_audio_versions }) => chapter_audio_versions),
		chapterVersionLikes,
		serverProgress,
		support: supportPage.data.support
	};
};
