import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import type { ShowcaseBook } from '$lib/types/showcase';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({
			id: books.id,
			title: books.title,
			description: books.description,
			homeImageUrl: books.homeImageUrl,
			homeVideoUrl: books.homeVideoUrl,
			blurhash: books.blurhash
		})
		.from(books)
		.orderBy(asc(books.sortOrder), asc(books.title));

	const showcaseBooks: ShowcaseBook[] = rows.map((book) => ({
		id: book.id,
		title: book.title,
		description: book.description ?? '',
		bgImage: book.homeImageUrl,
		bgBlurhash: book.blurhash,
		bgVideo: book.homeVideoUrl
	}));

	return { books: showcaseBooks };
};
