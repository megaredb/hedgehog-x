import { publicSubscriptionConfig, subscriptionConfig } from '$lib/server/subscriptions/config';
import { getBotUser, getGuildRoleWithBot, getGuildWithBot } from '$lib/server/discord/api';
import { getChat, getMe, getWebhookInfo } from '$lib/server/telegram/api';
import { checkDiscordSource } from '$lib/server/subscriptions/sources';

async function safeStatus<T>(
	label: string,
	promise: () => Promise<T>
): Promise<{ ok: boolean; value?: T; error?: string }> {
	try {
		return { ok: true, value: await promise() };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : `Ошибка: ${label}` };
	}
}

export interface TelegramStatus {
	configured: boolean;
	bot: { id: number; username?: string; first_name: string } | null;
	chat: { id: number; type: string; title?: string } | null;
	webhook: { url: string; pending: number; lastError: string | null; allowed: string[] } | null;
	error: string | null;
}

export interface DiscordStatus {
	configured: boolean;
	mode: 'bot' | 'oauth' | 'none';
	bot: { id: string; username: string } | null;
	guild: { id: string; name: string } | null;
	roles: Array<{ id: string; name: string }>;
	oauthCheck: string | null;
	error: string | null;
}

export async function getIntegrationStatus(userId?: string): Promise<{
	telegram: TelegramStatus;
	discord: DiscordStatus;
}> {
	const config = publicSubscriptionConfig();
	const telegram: TelegramStatus = {
		configured: config.telegramConfigured,
		bot: null,
		chat: null,
		webhook: null,
		error: null
	};

	if (config.telegramConfigured) {
		const bot = await safeStatus('bot', getMe);
		if (bot.ok && bot.value) telegram.bot = bot.value;
		else telegram.error = bot.error ?? 'Не удалось получить данные бота';
		if (bot.ok && subscriptionConfig.telegramChatId) {
			const chat = await safeStatus('chat', () => getChat(subscriptionConfig.telegramChatId));
			if (chat.ok && chat.value) telegram.chat = chat.value;
			else telegram.error = chat.error ?? telegram.error;
		}
		const webhook = await safeStatus('webhook', getWebhookInfo);
		if (webhook.ok && webhook.value) {
			telegram.webhook = {
				url: webhook.value.url,
				pending: webhook.value.pending_update_count,
				lastError: webhook.value.last_error_message ?? null,
				allowed: webhook.value.allowed_updates ?? []
			};
		}
	} else {
		telegram.error = 'Не заданы TELEGRAM_SUBSCRIPTION_CHAT_ID или TELEGRAM_BOT_TOKEN';
	}

	const discord: DiscordStatus = {
		configured: config.discordConfigured,
		mode: config.discordBotConfigured ? 'bot' : 'oauth',
		bot: null,
		guild: null,
		roles: [],
		oauthCheck: null,
		error: null
	};

	if (config.discordConfigured) {
		if (config.discordBotConfigured) {
			const bot = await safeStatus('discord bot', getBotUser);
			if (bot.ok && bot.value) discord.bot = { id: bot.value.id, username: bot.value.username };
			else discord.error = bot.error ?? 'Не удалось получить данные Discord-бота';
			const guild = await safeStatus('discord guild', () =>
				getGuildWithBot(subscriptionConfig.discordGuildId)
			);
			if (guild.ok && guild.value) discord.guild = { id: guild.value.id, name: guild.value.name };
			else discord.error = guild.error ?? discord.error;
			for (const roleId of subscriptionConfig.discordRoleIds) {
				const role = await safeStatus('discord role', () =>
					getGuildRoleWithBot(subscriptionConfig.discordGuildId, roleId)
				);
				if (role.ok && role.value) discord.roles.push({ id: role.value.id, name: role.value.name });
			}
		} else if (userId) {
			const check = await checkDiscordSource(userId);
			discord.oauthCheck = check.message;
			if (check.status === 'error' || check.status === 'reauth') discord.error = check.message;
		}
	} else {
		discord.error = 'Не заданы DISCORD_GUILD_ID или DISCORD_SUBSCRIBER_ROLE_IDS';
	}

	return { telegram, discord };
}
