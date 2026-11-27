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

	const loadTelegram = async () => {
		if (!config.telegramConfigured) {
			telegram.error = 'Не заданы TELEGRAM_SUBSCRIPTION_CHAT_ID или TELEGRAM_BOT_TOKEN';
			return;
		}
		const [bot, chat, webhook] = await Promise.all([
			safeStatus('bot', getMe),
			subscriptionConfig.telegramChatId
				? safeStatus('chat', () => getChat(subscriptionConfig.telegramChatId))
				: Promise.resolve(null),
			safeStatus('webhook', getWebhookInfo)
		]);
		if (bot.ok && bot.value) telegram.bot = bot.value;
		else telegram.error = bot.error ?? 'Не удалось получить данные бота';
		if (bot.ok && chat) {
			if (chat.ok && chat.value) telegram.chat = chat.value;
			else telegram.error = chat.error ?? telegram.error;
		}
		if (webhook.ok && webhook.value) {
			telegram.webhook = {
				url: webhook.value.url,
				pending: webhook.value.pending_update_count,
				lastError: webhook.value.last_error_message ?? null,
				allowed: webhook.value.allowed_updates ?? []
			};
		}
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

	const loadDiscord = async () => {
		if (!config.discordConfigured) {
			discord.error = 'Не заданы DISCORD_GUILD_ID или DISCORD_SUBSCRIBER_ROLE_IDS';
			return;
		}
		if (config.discordBotConfigured) {
			const [bot, guild, roles] = await Promise.all([
				safeStatus('discord bot', getBotUser),
				safeStatus('discord guild', () => getGuildWithBot(subscriptionConfig.discordGuildId)),
				Promise.all(
					subscriptionConfig.discordRoleIds.map((roleId) =>
						safeStatus('discord role', () =>
							getGuildRoleWithBot(subscriptionConfig.discordGuildId, roleId)
						)
					)
				)
			]);
			if (bot.ok && bot.value) discord.bot = { id: bot.value.id, username: bot.value.username };
			else discord.error = bot.error ?? 'Не удалось получить данные Discord-бота';
			if (guild.ok && guild.value) discord.guild = { id: guild.value.id, name: guild.value.name };
			else discord.error = guild.error ?? discord.error;
			for (const role of roles) {
				if (role.ok && role.value) discord.roles.push({ id: role.value.id, name: role.value.name });
			}
		} else if (userId) {
			const check = await checkDiscordSource(userId);
			discord.oauthCheck = check.message;
			if (check.status === 'error' || check.status === 'reauth') discord.error = check.message;
		}
	};

	await Promise.all([loadTelegram(), loadDiscord()]);

	return { telegram, discord };
}
