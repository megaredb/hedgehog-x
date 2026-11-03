import { db } from '$lib/server/db';
import { books, volumes, chapters, illustrations } from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import { count, desc, eq } from 'drizzle-orm';
import { dev } from '$app/environment';
import { redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth?redirect=/admin');
	}

	if (locals.user.role !== 'admin') {
		return {
			notAdmin: true,
			counts: { books: 0, volumes: 0, chapters: 0, illustrations: 0, users: 0 },
			recentBooks: []
		};
	}

	const [[booksC], [volumesC], [chaptersC], [illustrationsC], [usersC]] = await Promise.all([
		db.select({ count: count() }).from(books),
		db.select({ count: count() }).from(volumes),
		db.select({ count: count() }).from(chapters),
		db.select({ count: count() }).from(illustrations),
		db.select({ count: count() }).from(userTable)
	]);

	const recentBooks = await db.select().from(books).orderBy(desc(books.updatedAt)).limit(5);

	return {
		notAdmin: false,
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

export const actions: Actions = {
	makeSelfAdmin: async ({ locals }) => {
		if (!locals.user) {
			throw redirect(303, '/auth?redirect=/admin');
		}
		if (dev) {
			await db.update(userTable).set({ role: 'admin' }).where(eq(userTable.id, locals.user.id));
			locals.user.role = 'admin';
			return { success: true };
		}
		return { success: false, message: 'Доступно только в режиме разработки' };
	}
};
