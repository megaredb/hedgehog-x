import { db } from '$lib/server/db';
import { books, volumes, chapters } from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const catalog = await db
		.select({
			id: books.id,
			title: books.title,
			description: books.description,
			coverUrl: books.coverUrl,
			blurhash: books.blurhash,
			themeColor: books.themeColor,
			volumeCount: sql<number>`count(distinct ${volumes.id})`,
			chapterCount: sql<number>`count(${chapters.id})`
		})
		.from(books)
		.leftJoin(volumes, sql`${volumes.bookId} = ${books.id}`)
		.leftJoin(chapters, and(eq(chapters.volumeId, volumes.id), eq(chapters.published, true)))
		.groupBy(books.id)
		.orderBy(books.sortOrder, books.title);

	return {
		books: catalog.map((book) => ({
			...book,
			volumeCount: Number(book.volumeCount),
			chapterCount: Number(book.chapterCount)
		}))
	};
};
