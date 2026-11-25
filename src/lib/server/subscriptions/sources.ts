import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { account, user } from '$lib/server/db/schema';
import {
	DiscordApiError,
	getGuildId,
	getGuildMemberWithBot,
	getGuildMemberWithOAuth,
	getSubscriberRoleIds,
	hasSubscriberRole
} from '$lib/server/discord/api';
import {
	getChatMember,
	isActiveMember,
	TelegramApiError,
	type TelegramChatMember
} from '$lib/server/telegram/api';
import { isDiscordConfigured, isTelegramConfigured, subscriptionConfig } from './config';
import { getSubscriptionSummary, recordSourceState, touchSourceCheck } from './entitlement';

export type SourceCheckStatus =
	'active' | 'inactive' | 'not_configured' | 'not_linked' | 'reauth' | 'error';

export interface SourceCheckResult {
	provider: 'telegram' | 'discord';
	status: SourceCheckStatus;
	message: string;
	checked: boolean;
}

export interface TelegramIdentity {
	accountId: string;
	username: string | null;
}

export interface DiscordIdentity {
	accountId: string;
	accessToken: string | null;
	username: string | null;
}

let migratedTelegramChatId: string | null = null;

export function getEffectiveTelegramChatId(): string {
	return migratedTelegramChatId ?? subscriptionConfig.telegramChatId;
}

async function loadTelegramMember(telegramUserId: string) {
	const chatId = getEffectiveTelegramChatId();
	try {
		return { member: await getChatMember(chatId, telegramUserId), chatId };
	} catch (error) {
		if (error instanceof TelegramApiError && error.migrateToChatId) {
			const migratedChatId = String(error.migrateToChatId);
			migratedTelegramChatId = migratedChatId;
			return {
				member: await getChatMember(migratedChatId, telegramUserId),
				chatId: migratedChatId
			};
		}
		throw error;
	}
}

export async function getTelegramIdentityForUser(userId: string): Promise<TelegramIdentity | null> {
	const [row] = await db
		.select({
			accountId: account.accountId,
			username: user.telegramOidcUsername
		})
		.from(account)
		.innerJoin(user, eq(account.userId, user.id))
		.where(
			and(eq(account.userId, userId), inArray(account.providerId, ['telegram-oidc', 'telegram']))
		)
		.orderBy(desc(account.updatedAt))
		.limit(1);
	return row ? { accountId: row.accountId, username: row.username ?? null } : null;
}

export async function getDiscordIdentityForUser(userId: string): Promise<DiscordIdentity | null> {
	const [row] = await db
		.select({
			accountId: account.accountId,
			accessToken: account.accessToken,
			username: user.discordUsername
		})
		.from(account)
		.innerJoin(user, eq(account.userId, user.id))
		.where(and(eq(account.userId, userId), eq(account.providerId, 'discord')))
		.orderBy(desc(account.updatedAt))
		.limit(1);
	return row
		? {
				accountId: row.accountId,
				accessToken: row.accessToken ?? null,
				username: row.username ?? null
			}
		: null;
}

export async function findUserByTelegramId(telegramId: string): Promise<string | null> {
	const [row] = await db
		.select({ userId: account.userId })
		.from(account)
		.where(
			and(
				inArray(account.providerId, ['telegram-oidc', 'telegram']),
				eq(account.accountId, telegramId)
			)
		)
		.orderBy(desc(account.updatedAt))
		.limit(1);
	return row?.userId ?? null;
}

export async function checkTelegramSource(userId: string): Promise<SourceCheckResult> {
	if (!isTelegramConfigured()) {
		return {
			provider: 'telegram',
			status: 'not_configured',
			message: 'Telegram-группа или бот не настроены',
			checked: false
		};
	}
	const identity = await getTelegramIdentityForUser(userId);
	if (!identity) {
		return {
			provider: 'telegram',
			status: 'not_linked',
			message: 'Telegram не привязан к аккаунту',
			checked: false
		};
	}

	try {
		const { member, chatId } = await loadTelegramMember(identity.accountId);
		const active = isActiveMember(member);
		await recordSourceState({
			userId,
			provider: 'telegram',
			externalId: identity.accountId,
			active,
			lastError: null,
			metadata: JSON.stringify({
				chatId,
				memberStatus: member.status
			})
		});
		return {
			provider: 'telegram',
			status: active ? 'active' : 'inactive',
			message: active
				? 'Участник найден в Telegram-группе'
				: 'Пользователь не найден в Telegram-группе',
			checked: true
		};
	} catch (error) {
		if (error instanceof TelegramApiError && error.status === 400) {
			const userNotFound = /user not found|participant|member not found/i.test(error.description);
			if (userNotFound) {
				await recordSourceState({
					userId,
					provider: 'telegram',
					externalId: identity.accountId,
					active: false,
					lastError: null,
					metadata: JSON.stringify({ chatId: getEffectiveTelegramChatId() })
				});
				return {
					provider: 'telegram',
					status: 'inactive',
					message: 'Пользователь не найден в Telegram-группе',
					checked: true
				};
			}
		}
		const message = error instanceof Error ? error.message : 'Ошибка Telegram';
		await touchSourceCheck({
			userId,
			provider: 'telegram',
			externalId: identity.accountId,
			lastError: message.slice(0, 500)
		});
		return {
			provider: 'telegram',
			status: 'error',
			message,
			checked: false
		};
	}
}

export async function checkDiscordSource(userId: string): Promise<SourceCheckResult> {
	if (!isDiscordConfigured()) {
		return {
			provider: 'discord',
			status: 'not_configured',
			message: 'Discord-сервер или роль не настроены',
			checked: false
		};
	}
	const identity = await getDiscordIdentityForUser(userId);
	if (!identity) {
		return {
			provider: 'discord',
			status: 'not_linked',
			message: 'Discord не привязан к аккаунту',
			checked: false
		};
	}
	const guildId = getGuildId();
	const roleIds = getSubscriberRoleIds();
	const botToken = subscriptionConfig.discordBotToken;

	try {
		let member;
		if (botToken) {
			member = await getGuildMemberWithBot(guildId, identity.accountId);
		} else {
			if (!identity.accessToken) {
				return {
					provider: 'discord',
					status: 'reauth',
					message: 'Нет Discord-токена. Перепривяжите Discord в профиле',
					checked: false
				};
			}
			member = await getGuildMemberWithOAuth(guildId, identity.accessToken);
		}
		const active = hasSubscriberRole(member, roleIds);
		await recordSourceState({
			userId,
			provider: 'discord',
			externalId: identity.accountId,
			active,
			lastError: null,
			metadata: JSON.stringify({ guildId, roles: member.roles })
		});
		return {
			provider: 'discord',
			status: active ? 'active' : 'inactive',
			message: active ? 'Роль подписчика найдена на Discord-сервере' : 'Роль подписчика не найдена',
			checked: true
		};
	} catch (error) {
		if (error instanceof DiscordApiError && (error.status === 404 || error.status === 400)) {
			await recordSourceState({
				userId,
				provider: 'discord',
				externalId: identity.accountId,
				active: false,
				lastError: null,
				metadata: JSON.stringify({ guildId })
			});
			return {
				provider: 'discord',
				status: 'inactive',
				message: 'Пользователь не найден на Discord-сервере',
				checked: true
			};
		}
		const message = error instanceof Error ? error.message : 'Ошибка Discord';
		await touchSourceCheck({
			userId,
			provider: 'discord',
			externalId: identity.accountId,
			lastError: message.slice(0, 500)
		});
		const reauth =
			error instanceof DiscordApiError && (error.status === 401 || error.status === 403);
		return {
			provider: 'discord',
			status: reauth ? 'reauth' : 'error',
			message: reauth
				? 'Discord-токен устарел или не хватает прав. Перепривяжите Discord в профиле'
				: message,
			checked: false
		};
	}
}

export async function checkAllSubscriptionSources(userId: string) {
	const [telegram, discord] = await Promise.all([
		checkTelegramSource(userId),
		checkDiscordSource(userId)
	]);
	const summary = await getSubscriptionSummary(userId);
	return { telegram, discord, summary };
}

export async function handleTelegramChatMemberUpdate(params: {
	chatId: string;
	telegramUserId: string;
	status: TelegramChatMember['status'];
	isMember?: boolean;
}): Promise<{ handled: boolean; reason?: string }> {
	const expectedChatId = getEffectiveTelegramChatId();
	if (!expectedChatId || params.chatId !== expectedChatId) {
		return { handled: false, reason: 'unknown_chat' };
	}
	const userId = await findUserByTelegramId(params.telegramUserId);
	if (!userId) return { handled: false, reason: 'user_not_found' };

	const active =
		params.status === 'creator' ||
		params.status === 'administrator' ||
		params.status === 'member' ||
		(params.status === 'restricted' && params.isMember === true);

	await recordSourceState({
		userId,
		provider: 'telegram',
		externalId: params.telegramUserId,
		active,
		lastError: null,
		metadata: JSON.stringify({
			chatId: params.chatId,
			memberStatus: params.status
		})
	});
	return { handled: true };
}
