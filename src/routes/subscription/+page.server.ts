import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	getSubscriptionSummary,
	listSubscriptionEvents
} from '$lib/server/subscriptions/entitlement';
import {
	getDiscordIdentityForUser,
	getTelegramIdentityForUser,
	checkAllSubscriptionSources
} from '$lib/server/subscriptions/sources';
import { publicSubscriptionConfig } from '$lib/server/subscriptions/config';
import { getUserDonationSummary } from '$lib/server/subscriptions/reports';
import {
	dismissPriceNotice,
	getActivePriceNotices,
	getSubscriptionPricePerDay
} from '$lib/server/subscriptions/pricing';
import { summarizeSubscription } from '$lib/subscriptions/domain';
import { loadSitePage } from '$lib/server/site-content';

const lastChecks = new Map<string, number>();
const CHECK_COOLDOWN_MS = 20_000;

export const load: PageServerLoad = async ({ locals }) => {
	const baseConfig = publicSubscriptionConfig();
	const supportPage = await loadSitePage('support');
	const boostyBlogUrl = supportPage.data.support?.boostyUrl?.trim() || baseConfig.boostyBlogUrl;
	const config = {
		...baseConfig,
		boostyBlogUrl,
		boostyBlogName: boostyBlogUrl.split('/').filter(Boolean).pop() ?? baseConfig.boostyBlogName
	};
	if (!locals.user) {
		return {
			isGuest: true,
			summary: summarizeSubscription({}),
			events: [],
			telegram: null,
			discord: null,
			donations: { totalRub: 0, donationsCount: 0, lastDonationAt: null },
			priceNotices: [],
			config,
			price: await getSubscriptionPricePerDay(),
			userName: ''
		};
	}

	const [summary, events, telegram, discord, donations, notices, price] = await Promise.all([
		getSubscriptionSummary(locals.user.id),
		listSubscriptionEvents(locals.user.id, 100),
		getTelegramIdentityForUser(locals.user.id),
		getDiscordIdentityForUser(locals.user.id),
		getUserDonationSummary(locals.user.id),
		getActivePriceNotices(locals.user.id),
		getSubscriptionPricePerDay()
	]);

	return {
		isGuest: false,
		summary,
		events,
		telegram,
		discord,
		donations,
		priceNotices: notices,
		config,
		price,
		userName: locals.user.name ?? ''
	};
};

export const actions: Actions = {
	check: async ({ locals }) => {
		if (!locals.user) return fail(401, { error: 'Требуется авторизация' });
		const previous = lastChecks.get(locals.user.id) ?? 0;
		if (Date.now() - previous < CHECK_COOLDOWN_MS) {
			return fail(429, {
				error: 'Проверка уже выполнялась недавно. Попробуйте через несколько секунд.'
			});
		}
		lastChecks.set(locals.user.id, Date.now());
		const result = await checkAllSubscriptionSources(locals.user.id);
		const messages = [result.telegram.message, result.discord.message].filter(Boolean);
		return {
			success: true,
			message: messages.length ? messages.join(' · ') : 'Источники проверены'
		};
	},
	dismissNotice: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Требуется авторизация' });
		const form = await request.formData();
		const noticeId = String(form.get('noticeId') ?? '').trim();
		if (!noticeId) return fail(400, { error: 'Некорректное уведомление' });
		const dismissed = await dismissPriceNotice(locals.user.id, noticeId);
		if (!dismissed) return fail(404, { error: 'Уведомление не найдено' });
		return { success: true, message: 'Уведомление закрыто' };
	}
};
