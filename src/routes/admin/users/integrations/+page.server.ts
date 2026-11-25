import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { publicSubscriptionConfig, subscriptionConfig } from '$lib/server/subscriptions/config';
import { setWebhook } from '$lib/server/telegram/api';
import type { DiscordStatus, TelegramStatus } from '$lib/server/integrations/status';
import { loadSitePage } from '$lib/server/site-content';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const baseConfig = publicSubscriptionConfig();
	const supportPage = await loadSitePage('support');
	const boostyBlogUrl = supportPage.data.support?.boostyUrl?.trim() || baseConfig.boostyBlogUrl;
	const config = {
		...baseConfig,
		boostyBlogUrl,
		boostyBlogName: boostyBlogUrl.split('/').filter(Boolean).pop() ?? baseConfig.boostyBlogName
	};
	const telegram: TelegramStatus = {
		configured: config.telegramConfigured,
		bot: null,
		chat: null,
		webhook: null,
		error: null
	};
	const discord: DiscordStatus = {
		configured: config.discordConfigured,
		mode: config.discordBotConfigured ? 'bot' : 'oauth',
		bot: null,
		guild: null,
		roles: [],
		oauthCheck: null,
		error: null
	};
	return { config, telegram, discord };
};

export const actions: Actions = {
	check: async ({ locals }) => {
		requireAdmin(locals);
		return { success: true, message: 'Проверка выполнена' };
	},
	setWebhook: async ({ locals, url }) => {
		requireAdmin(locals);
		if (!subscriptionConfig.telegramWebhookSecret) {
			return fail(400, { error: 'TELEGRAM_WEBHOOK_SECRET не настроен' });
		}
		const target = url.origin + '/api/telegram/webhook';
		if (!target.startsWith('https://')) {
			return fail(400, {
				error:
					'Telegram принимает webhook только по HTTPS. Используйте публичный туннель или production-домен.'
			});
		}
		try {
			await setWebhook({ url: target, secretToken: subscriptionConfig.telegramWebhookSecret });
			return { success: true, message: 'Webhook настроен' };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Ошибка настройки webhook'
			});
		}
	}
};
