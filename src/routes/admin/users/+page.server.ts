import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { account } from '$lib/server/db/auth.schema';
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/admin';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const ROLES = ['admin', 'user'] as const;
const SORTS = ['newest', 'oldest', 'name', 'email', 'role'] as const;

export const load: PageServerLoad = async ({ locals, url }) => {
	requireAdmin(locals);

	const q = (url.searchParams.get('q') ?? '').trim();
	const requestedRole = url.searchParams.get('role') ?? 'all';
	const requestedProvider = url.searchParams.get('provider') ?? 'all';
	const requestedSort = url.searchParams.get('sort') ?? 'newest';
	const role = ROLES.includes(requestedRole as (typeof ROLES)[number]) ? requestedRole : 'all';
	const sort = SORTS.includes(requestedSort as (typeof SORTS)[number]) ? requestedSort : 'newest';

	const conditions = [];
	if (q) {
		const pattern = '%' + q + '%';
		conditions.push(
			or(ilike(user.name, pattern), ilike(user.email, pattern), ilike(user.id, pattern))
		);
	}
	if (role !== 'all') conditions.push(eq(user.role, role));
	const where = conditions.length ? and(...conditions) : undefined;

	const orderBy =
		sort === 'oldest'
			? asc(user.createdAt)
			: sort === 'name'
				? asc(user.name)
				: sort === 'email'
					? asc(user.email)
					: sort === 'role'
						? asc(user.role)
						: desc(user.createdAt);

	const [userRows, [totalRow], providerRows] = await Promise.all([
		db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				createdAt: user.createdAt,
				image: user.image,
				telegramAvatar: user.telegramAvatar,
				discordAvatar: user.discordAvatar,
				telegramOidcUsername: user.telegramOidcUsername,
				discordUsername: user.discordUsername
			})
			.from(user)
			.where(where)
			.orderBy(orderBy),
		db.select({ count: count() }).from(user),
		db.select({ providerId: account.providerId }).from(account).groupBy(account.providerId)
	]);

	const userIds = userRows.map((row) => row.id);
	const accounts = userIds.length
		? await db
				.select({ userId: account.userId, providerId: account.providerId })
				.from(account)
				.where(inArray(account.userId, userIds))
		: [];

	const providersByUser = new Map<string, string[]>();
	for (const row of accounts) {
		const list = providersByUser.get(row.userId);
		if (list) {
			if (!list.includes(row.providerId)) list.push(row.providerId);
		} else {
			providersByUser.set(row.userId, [row.providerId]);
		}
	}

	const providers = Array.from(new Set(providerRows.map((row) => row.providerId))).sort();
	const provider = providers.includes(requestedProvider) ? requestedProvider : 'all';
	const users = userRows
		.map((row) => ({ ...row, providers: providersByUser.get(row.id) ?? [] }))
		.filter((row) => provider === 'all' || row.providers.includes(provider));

	return {
		users,
		totalUsers: Number(totalRow?.count ?? 0),
		providers,
		filters: { q, role, provider, sort },
		currentUserId: locals.user?.id ?? ''
	};
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
