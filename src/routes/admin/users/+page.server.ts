import { db } from '$lib/server/db';
import { sitePages, translators, user } from '$lib/server/db/schema';
import { account } from '$lib/server/db/auth.schema';
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { requireAdmin, requireFullAdmin } from '$lib/server/admin';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	grantManual,
	getSubscriptionSummaries,
	getSubscriptionSummary,
	listSubscriptionEvents,
	restoreSubscription,
	revokeManual,
	setBlocked,
	SubscriptionError
} from '$lib/server/subscriptions/entitlement';
import { checkAllSubscriptionSources } from '$lib/server/subscriptions/sources';
import { publicSubscriptionConfig } from '$lib/server/subscriptions/config';
import {
	getSubscriptionPricePerDay,
	setSubscriptionPrice,
	PriceChangeError
} from '$lib/server/subscriptions/pricing';
import { getDonationSummaries } from '$lib/server/subscriptions/reports';
import { loadSitePage, loadTranslators, setDeveloperAccount } from '$lib/server/site-content';
import { pluralDays } from '$lib/subscriptions/domain';

const ROLES = ['admin', 'author', 'user'] as const;
const SORTS = ['newest', 'oldest', 'name', 'role'] as const;

function parseUserId(value: FormDataEntryValue | null): string {
	return String(value ?? '').trim();
}

async function assertUserExists(userId: string): Promise<boolean> {
	if (!userId) return false;
	const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
	return Boolean(row);
}

interface AccountIdentity {
	providerId: string;
	accountId: string;
}

interface UserIdentity {
	telegramId: string | null;
	discordId: string | null;
	identityId: string;
	providers: string[];
}

function buildIdentity(userId: string, accounts: AccountIdentity[]): UserIdentity {
	const telegram = accounts.find(
		(account) => account.providerId === 'telegram-oidc' || account.providerId === 'telegram'
	);
	const discord = accounts.find((account) => account.providerId === 'discord');
	return {
		telegramId: telegram?.accountId ?? null,
		discordId: discord?.accountId ?? null,
		identityId: telegram?.accountId ?? discord?.accountId ?? userId,
		providers: Array.from(new Set(accounts.map((account) => account.providerId)))
	};
}

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
			or(
				ilike(user.name, pattern),
				ilike(user.id, pattern),
				ilike(user.telegramOidcUsername, pattern),
				ilike(user.discordUsername, pattern),
				inArray(
					user.id,
					db
						.select({ userId: account.userId })
						.from(account)
						.where(ilike(account.accountId, pattern))
				)
			)
		);
	}
	if (role !== 'all') conditions.push(eq(user.role, role));
	const where = conditions.length ? and(...conditions) : undefined;

	const orderBy =
		sort === 'oldest'
			? asc(user.createdAt)
			: sort === 'name'
				? asc(user.name)
				: sort === 'role'
					? asc(user.role)
					: desc(user.createdAt);

	const [userRows, [totalRow], providerRows] = await Promise.all([
		db
			.select({
				id: user.id,
				name: user.name,
				role: user.role,
				createdAt: user.createdAt,
				image: user.image,
				telegramAvatar: user.telegramAvatar,
				discordAvatar: user.discordAvatar,
				telegramOidcUsername: user.telegramOidcUsername,
				discordUsername: user.discordUsername,
				includeInStats: user.includeInStats
			})
			.from(user)
			.where(where)
			.orderBy(orderBy),
		db.select({ count: count() }).from(user),
		db.select({ providerId: account.providerId }).from(account).groupBy(account.providerId)
	]);

	const userIds = userRows.map((row) => row.id);
	const [accounts, summaries, donationSummaries, subscriptionPrice] = await Promise.all([
		userIds.length
			? db
					.select({
						userId: account.userId,
						providerId: account.providerId,
						accountId: account.accountId
					})
					.from(account)
					.where(inArray(account.userId, userIds))
			: Promise.resolve([]),
		getSubscriptionSummaries(userIds),
		getDonationSummaries(userIds),
		getSubscriptionPricePerDay()
	]);

	const accountsByUser = new Map<string, AccountIdentity[]>();
	for (const accountRow of accounts) {
		const list = accountsByUser.get(accountRow.userId) ?? [];
		list.push({ providerId: accountRow.providerId, accountId: accountRow.accountId });
		accountsByUser.set(accountRow.userId, list);
	}
	const identityByUser = new Map<string, UserIdentity>();
	for (const [userId, userAccounts] of accountsByUser) {
		identityByUser.set(userId, buildIdentity(userId, userAccounts));
	}

	const providers = Array.from(new Set(providerRows.map((row) => row.providerId))).sort();
	const provider = providers.includes(requestedProvider) ? requestedProvider : 'all';
	const users = userRows
		.map((row) => ({
			...row,
			...(identityByUser.get(row.id) ?? buildIdentity(row.id, [])),
			subscription: summaries.get(row.id),
			donations: donationSummaries.get(row.id) ?? {
				totalRub: 0,
				donationsCount: 0,
				lastDonationAt: null
			}
		}))
		.filter((row) => provider === 'all' || row.providers.includes(provider));

	let active = 0;
	let boosty = 0;
	let expiring = 0;
	let lifetime = 0;
	let blocked = 0;
	for (const summary of summaries.values()) {
		if (summary.active) active += 1;
		if (summary.boostyActive) boosty += 1;
		if (summary.daysLeft != null && summary.daysLeft > 0 && summary.daysLeft <= 7) expiring += 1;
		if (summary.isLifetime) lifetime += 1;
		if (summary.blocked) blocked += 1;
	}

	const selectedUserId = (url.searchParams.get('user') ?? '').trim();
	let selectedUser = null;
	let selectedEvents: Awaited<ReturnType<typeof listSubscriptionEvents>> = [];
	if (selectedUserId) {
		const selectedRow = userRows.find((row) => row.id === selectedUserId);
		if (selectedRow && selectedRow.role !== 'author') {
			const selectedSummary =
				summaries.get(selectedRow.id) ?? (await getSubscriptionSummary(selectedRow.id));
			selectedUser = {
				...selectedRow,
				...(identityByUser.get(selectedRow.id) ?? buildIdentity(selectedRow.id, [])),
				developerLink: null,
				translatorLink: null,
				subscription: selectedSummary,
				donations: donationSummaries.get(selectedRow.id) ?? {
					totalRub: 0,
					donationsCount: 0,
					lastDonationAt: null
				}
			};
			selectedEvents = await listSubscriptionEvents(selectedRow.id, 100);
		}
	}

	const [authorRow] = await db
		.select({ id: user.id, name: user.name })
		.from(user)
		.where(eq(user.role, 'author'))
		.limit(1);

	const [aboutPage, translatorRows] = await Promise.all([loadSitePage('about'), loadTranslators()]);
	const developers = aboutPage.data.developers ?? [];
	const usersWithLinks = users.map((row) => ({
		...row,
		developerLink: developers.find((developer) => developer.userId === row.id) ?? null,
		translatorLink: translatorRows.find((translator) => translator.userId === row.id) ?? null
	}));

	return {
		users: usersWithLinks,
		authorUser: authorRow ?? null,
		selectedUser,
		selectedEvents,
		totalUsers: Number(totalRow?.count ?? 0),
		providers,
		filters: { q, role, provider, sort },
		currentUserId: locals.user?.id ?? '',
		currentUserRole: locals.user?.role ?? 'user',
		subscriptionCounts: { active, boosty, expiring, lifetime, blocked },
		subscriptionConfig: publicSubscriptionConfig(),
		subscriptionPrice
	};
};

export const actions: Actions = {
	markDeveloper: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = parseUserId(form.get('userId'));
		const remove = String(form.get('remove') ?? '') === 'true';
		if (!userId) return fail(400, { error: 'Некорректный пользователь' });
		const [target] = await db
			.select({ id: user.id, name: user.name })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (!target) return fail(404, { error: 'Пользователь не найден' });

		const about = await loadSitePage('about');
		const developers = setDeveloperAccount(
			about.data.developers ?? [],
			userId,
			target.name,
			remove
		);
		const linked = (about.data.developers ?? []).some((developer) => developer.userId === userId);
		if (remove || !linked) {
			const data = { ...about.data, developers };
			await db
				.insert(sitePages)
				.values({
					key: 'about',
					title: about.title,
					intro: about.intro,
					content: about.content,
					data
				})
				.onConflictDoUpdate({ target: sitePages.key, set: { data, updatedAt: new Date() } });
		}
		return {
			success: true,
			message: remove ? 'Разработчик убран' : 'Пользователь указан разработчиком'
		};
	},
	markTranslator: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = parseUserId(form.get('userId'));
		const remove = String(form.get('remove') ?? '') === 'true';
		if (!userId) return fail(400, { error: 'Некорректный пользователь' });
		const [target] = await db
			.select({ id: user.id, name: user.name })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (!target) return fail(404, { error: 'Пользователь не найден' });

		const [linked] = await db
			.select({ id: translators.id })
			.from(translators)
			.where(eq(translators.userId, userId))
			.limit(1);
		if (remove) {
			if (linked)
				await db.update(translators).set({ userId: null }).where(eq(translators.id, linked.id));
		} else if (!linked) {
			await db.insert(translators).values({
				name: target.name,
				role: 'Переводчик',
				userId,
				links: [],
				enabled: true
			});
		}
		return {
			success: true,
			message: remove ? 'Переводчик убран' : 'Пользователь указан переводчиком'
		};
	},
	setRole: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = parseUserId(form.get('id'));
		const role = String(form.get('role') ?? '').trim();
		if (!id || !['admin', 'user'].includes(role)) return fail(400, { error: 'Некорректная роль' });
		const [target] = await db
			.select({ role: user.role })
			.from(user)
			.where(eq(user.id, id))
			.limit(1);
		if (target?.role === 'author') {
			return fail(400, { error: 'Роль автора назначается отдельно' });
		}

		if (id === locals.user?.id && role !== 'admin') {
			const [{ count: adminCount }] = await db
				.select({ count: sql<number>`count(*)` })
				.from(user)
				.where(eq(user.role, 'admin'));
			if (Number(adminCount) <= 1) {
				return fail(400, { error: 'Нельзя снять последнего администратора' });
			}
		}

		await db.update(user).set({ role }).where(eq(user.id, id));
		return { success: true, message: 'Роль обновлена' };
	},

	setAuthor: async ({ request, locals }) => {
		const admin = requireFullAdmin(locals);
		const form = await request.formData();
		const userId = parseUserId(form.get('userId'));
		if (!(await assertUserExists(userId))) return fail(404, { error: 'Пользователь не найден' });
		const [target] = await db
			.select({ role: user.role })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (target?.role === 'author') {
			return { success: true, message: 'Этот пользователь уже автор' };
		}

		await db.transaction(async (tx) => {
			await tx
				.update(user)
				.set({ role: 'user', includeInStats: true })
				.where(eq(user.role, 'author'));
			await tx
				.update(user)
				.set({ role: 'author', includeInStats: false })
				.where(eq(user.id, userId));
		});
		return {
			success: true,
			message: 'Автор назначен',
			authorUserId: userId,
			adminUserId: admin.id
		};
	},

	authorStats: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = parseUserId(form.get('userId'));
		if (!(await assertUserExists(userId))) return fail(404, { error: 'Пользователь не найден' });
		const [target] = await db
			.select({ role: user.role, includeInStats: user.includeInStats })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (target?.role !== 'author') return fail(400, { error: 'Пользователь не является автором' });
		const include = !target.includeInStats;
		await db.update(user).set({ includeInStats: include }).where(eq(user.id, userId));
		return {
			success: true,
			message: include ? 'Автор включён в статистику' : 'Автор исключён из статистики',
			userId
		};
	},

	grant: async ({ request, locals }) => {
		requireAdmin(locals);
		const admin = locals.user;
		if (!admin) return fail(401, { error: 'Требуется авторизация' });
		const form = await request.formData();
		const userId = parseUserId(form.get('userId'));
		if (!(await assertUserExists(userId))) return fail(404, { error: 'Пользователь не найден' });
		const [grantTarget] = await db
			.select({ role: user.role })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (grantTarget?.role === 'author') {
			return fail(400, { error: 'Автору нельзя выдать подписку из этой панели' });
		}

		const mode = String(form.get('mode') ?? 'days');
		const note = String(form.get('note') ?? '').trim() || null;
		const lifetime = mode === 'lifetime';
		const days = mode === 'days' ? Number(form.get('days') ?? 0) : null;
		const amountRub = mode === 'amount' ? Number(form.get('amountRub') ?? 0) : null;

		try {
			const result = await grantManual({
				userId,
				adminUserId: admin.id,
				days,
				amountRub,
				lifetime,
				note,
				pricePerDay: await getSubscriptionPricePerDay()
			});
			const message = result.isLifetime
				? 'Выдана вечная подписка'
				: `Выдано ${result.days ?? 0} ${pluralDays(result.days ?? 0)}`;
			return { success: true, message, userId };
		} catch (error) {
			if (error instanceof SubscriptionError) return fail(400, { error: error.message, userId });
			throw error;
		}
	},

	revoke: async ({ request, locals }) => {
		requireAdmin(locals);
		const admin = locals.user;
		if (!admin) return fail(401, { error: 'Требуется авторизация' });
		const form = await request.formData();
		const userId = parseUserId(form.get('userId'));
		if (!(await assertUserExists(userId))) return fail(404, { error: 'Пользователь не найден' });
		const changed = await revokeManual(
			userId,
			admin.id,
			String(form.get('note') ?? '').trim() || null
		);
		return {
			success: true,
			message: changed ? 'Подписка приостановлена' : 'Подписка уже приостановлена',
			userId
		};
	},

	restore: async ({ request, locals }) => {
		requireAdmin(locals);
		const admin = locals.user;
		if (!admin) return fail(401, { error: 'Требуется авторизация' });
		const form = await request.formData();
		const userId = parseUserId(form.get('userId'));
		if (!(await assertUserExists(userId))) return fail(404, { error: 'Пользователь не найден' });
		const changed = await restoreSubscription(
			userId,
			admin.id,
			String(form.get('note') ?? '').trim() || null
		);
		return {
			success: true,
			message: changed ? 'Подписка восстановлена' : 'Подписка не была приостановлена',
			userId
		};
	},

	block: async ({ request, locals }) => {
		requireAdmin(locals);
		const admin = locals.user;
		if (!admin) return fail(401, { error: 'Требуется авторизация' });
		const form = await request.formData();
		const userId = parseUserId(form.get('userId'));
		if (!(await assertUserExists(userId))) return fail(404, { error: 'Пользователь не найден' });
		const block = String(form.get('blocked') ?? '1') === '1';
		await setBlocked(userId, block, admin.id, String(form.get('reason') ?? '').trim() || null);
		return {
			success: true,
			message: block ? 'Аккаунт заблокирован, сессии завершены' : 'Аккаунт разблокирован',
			userId
		};
	},

	check: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = parseUserId(form.get('userId'));
		if (!(await assertUserExists(userId))) return fail(404, { error: 'Пользователь не найден' });
		const result = await checkAllSubscriptionSources(userId);
		const messages = [result.telegram.message, result.discord.message].filter(Boolean);
		return {
			success: true,
			message: messages.join(' · '),
			userId
		};
	},

	setPrice: async ({ request, locals }) => {
		requireAdmin(locals);
		const admin = locals.user;
		if (!admin) return fail(401, { error: 'Требуется авторизация' });
		const form = await request.formData();
		const newPrice = Number(form.get('newPrice') ?? 0);
		const scope = String(form.get('scope') ?? 'new') === 'all' ? 'all' : 'new';
		try {
			const result = await setSubscriptionPrice({
				newPrice,
				scope,
				adminUserId: admin.id
			});
			const scopeText = result.scope === 'all' ? 'с пересчётом остатка' : 'только для новых';
			return {
				success: true,
				message: `Цена дня: ${result.oldPrice} → ${result.newPrice} ₽ (${scopeText}). Пересчитано: ${result.repricedCount}, уведомлено: ${result.noticedCount}.`
			};
		} catch (error) {
			if (error instanceof PriceChangeError) return fail(400, { error: error.message });
			throw error;
		}
	}
};
