import { redirect, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';
import { dev } from '$app/environment';

export const load = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth?redirect=/admin');
	}

	const isAdmin = locals.user.role === 'admin';

	return {
		user: locals.user,
		isAdmin,
		isDev: dev
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
