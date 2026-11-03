import { db } from '$lib/server/db';
import { books, volumes, chapters, illustrations } from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import { count, desc } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const [[booksC], [volumesC], [chaptersC], [illustrationsC], [usersC]] = await Promise.all([
		db.select({ count: count() }).from(books),
		db.select({ count: count() }).from(volumes),
		db.select({ count: count() }).from(chapters),
		db.select({ count: count() }).from(illustrations),
		db.select({ count: count() }).from(userTable)
	]);

	const recentBooks = await db.select().from(books).orderBy(desc(books.updatedAt)).limit(5);

	return {
		counts: {
			books: booksC?.count ?? 0,
			volumes: volumesC?.count ?? 0,
			chapters: chaptersC?.count ?? 0,
			illustrations: illustrationsC?.count ?? 0,
			users: usersC?.count ?? 0
		},
		recentBooks
	};
};
