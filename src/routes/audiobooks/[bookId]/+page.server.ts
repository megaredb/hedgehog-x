import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, volumes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const { bookId } = params;

	const book = await db.query.books.findFirst({
		where: eq(books.id, bookId)
	});

	if (!book) {
		throw error(404, 'Книга не найдена');
	}

	const bookVolumes = await db.query.volumes.findMany({
		where: eq(volumes.bookId, bookId),
		orderBy: (volumes, { asc }) => [asc(volumes.volumeNumber)]
	});

	return {
		book: {
			id: book.id,
			title: book.title,
			description: book.description,
			coverUrl: book.coverUrl,
			status: book.status,
			themeColor: book.themeColor,
			createdAt: book.createdAt.toISOString()
		},
		volumes: bookVolumes.map((v) => ({
			id: v.id,
			bookId: v.bookId,
			volumeNumber: v.volumeNumber,
			title: v.title,
			coverUrl: v.coverUrl,
			createdAt: v.createdAt.toISOString()
		}))
	};
};
