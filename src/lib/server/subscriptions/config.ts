import { env } from '$env/dynamic/private';
import { DEFAULT_PRICE_PER_DAY_RUB } from '$lib/subscriptions/domain';
import { DEFAULT_BOOSTY_URL } from '$lib/types/site';

function trim(value: string | undefined): string {
	return value?.trim() ?? '';
}

const boostyBlogUrl = DEFAULT_BOOSTY_URL;
const boostyBlogName = boostyBlogUrl.split('/').filter(Boolean).pop() ?? 'hedgehoginc';

const configuredPrice = Number(trim(env.SUBSCRIPTION_PRICE_PER_DAY_RUB));
export const subscriptionConfig = {
	pricePerDay:
		Number.isFinite(configuredPrice) && configuredPrice > 0
			? Math.floor(configuredPrice)
			: DEFAULT_PRICE_PER_DAY_RUB,
	telegramChatId: trim(env.TELEGRAM_SUBSCRIPTION_CHAT_ID),
	telegramWebhookSecret: trim(env.TELEGRAM_WEBHOOK_SECRET),
	telegramBotToken: trim(env.TELEGRAM_BOT_TOKEN),
	discordGuildId: trim(env.DISCORD_GUILD_ID),
	discordRoleIds: trim(env.DISCORD_SUBSCRIBER_ROLE_IDS)
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean),
	discordBotToken: trim(env.DISCORD_BOT_TOKEN),
	boostyBlogUrl,
	boostyBlogName
};

export function isTelegramConfigured(): boolean {
	return Boolean(subscriptionConfig.telegramChatId && subscriptionConfig.telegramBotToken);
}

export function isDiscordConfigured(): boolean {
	return Boolean(subscriptionConfig.discordGuildId && subscriptionConfig.discordRoleIds.length);
}

export function publicSubscriptionConfig() {
	return {
		pricePerDay: subscriptionConfig.pricePerDay,
		telegramConfigured: isTelegramConfigured(),
		discordConfigured: isDiscordConfigured(),
		telegramChatConfigured: Boolean(subscriptionConfig.telegramChatId),
		discordGuildConfigured: Boolean(subscriptionConfig.discordGuildId),
		discordBotConfigured: Boolean(subscriptionConfig.discordBotToken),
		boostyBlogUrl: subscriptionConfig.boostyBlogUrl,
		boostyBlogName: subscriptionConfig.boostyBlogName,
		boostyConfigured: Boolean(boostyBlogUrl)
	};
}
