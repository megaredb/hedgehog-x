import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/admin';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const users = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			createdAt: user.createdAt
		})
		.from(user)
		.orderBy(desc(user.createdAt));
	return { users, currentUserId: locals.user?.id ?? '' };
};

export const actions: Actions = {
	setRole: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		const role = String(form.get('role') ?? '').trim();
		if (!id || !['admin', 'user'].includes(role)) return fail(400, { error: 'Некорректная роль' });

		if (id === locals.user?.id && role !== 'admin') {
			const [{ count }] = await db
				.select({ count: sql<number>`count(*)` })
				.from(user)
				.where(eq(user.role, 'admin'));
			if (Number(count) <= 1) return fail(400, { error: 'Нельзя снять последнего администратора' });
		}

		await db.update(user).set({ role }).where(eq(user.id, id));
		return { success: true };
	}
};
