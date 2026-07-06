import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { ilike, and, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const searchQuery = url.searchParams.get('q') || '';
	const statusFilter = url.searchParams.get('status') || '';

	const conditions = [];

	if (searchQuery) {
		const escapedQuery = searchQuery.replace(/[%_\\]/g, '\\$&');
		conditions.push(ilike(books.title, `%${escapedQuery}%`));
	}

	if (statusFilter && (statusFilter === 'ongoing' || statusFilter === 'completed')) {
		conditions.push(eq(books.status, statusFilter));
	}

	const allBooks = await db.query.books.findMany({
		where: conditions.length > 0 ? and(...conditions) : undefined,
		orderBy: (books, { desc }) => [desc(books.createdAt)]
	});

	return {
		books: allBooks.map((b) => ({
			id: b.id,
			title: b.title,
			description: b.description,
			coverUrl: b.coverUrl,
			status: b.status,
			themeColor: b.themeColor,
			createdAt: b.createdAt.toISOString()
		}))
	};
};
