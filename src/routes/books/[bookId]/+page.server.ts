import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { books, volumes } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [book] = await db.select().from(books).where(eq(books.id, params.bookId)).limit(1);
	if (!book) throw error(404, 'Книга не найдена');
	const volumeRows = await db
		.select()
		.from(volumes)
		.where(eq(volumes.bookId, book.id))
		.orderBy(asc(volumes.volumeNumber));
	return { bookId: params.bookId, book, volumes: volumeRows };
};
