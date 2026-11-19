import { error } from '@sveltejs/kit';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { books, chapters, illustrations, volumes } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	const [book] = await db.select().from(books).where(eq(books.id, params.bookId)).limit(1);
	if (!book) throw error(404, 'Книга не найдена');

	const volumeRows = await db
		.select()
		.from(volumes)
		.where(eq(volumes.bookId, book.id))
		.orderBy(asc(volumes.volumeNumber));

	const volumeIds = volumeRows.map((v) => v.id);
	const [chapterRows, illustrationRows] = volumeIds.length
		? await Promise.all([
				db
					.select()
					.from(chapters)
					.where(inArray(chapters.volumeId, volumeIds))
					.orderBy(asc(chapters.chapterNumber)),
				db
					.select()
					.from(illustrations)
					.where(inArray(illustrations.volumeId, volumeIds))
					.orderBy(asc(illustrations.sortOrder))
			])
		: [[], []];

	const volumesWithChildren = volumeRows.map((volume) => ({
		...volume,
		chapters: chapterRows.filter((c) => c.volumeId === volume.id),
		illustrations: illustrationRows.filter((i) => i.volumeId === volume.id)
	}));

	const selectedVolume = params.volumeId
		? volumesWithChildren.find((v) => v.id === params.volumeId)
		: undefined;
	if (params.volumeId && !selectedVolume) throw error(404, 'Том не найден');

	return {
		book,
		volumes: volumesWithChildren,
		volume: selectedVolume,
		chapters: selectedVolume?.chapters ?? [],
		illustrations: selectedVolume?.illustrations ?? []
	};
};
