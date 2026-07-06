import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	// Fetch recent books for home carousel
	const recentBooks = await db.query.books.findMany({
		orderBy: [desc(books.createdAt)],
		limit: 5
	});

	return {
		user: locals.user,
		books: recentBooks.map((b) => ({
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
