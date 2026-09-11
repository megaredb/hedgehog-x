import TelegramIcon from '$lib/components/ui/brand-icons/TelegramIcon.svelte';
import DiscordIcon from '$lib/components/ui/brand-icons/DiscordIcon.svelte';
import type { Component } from 'svelte';

/**
 * Описание способа авторизации (OAuth-провайдера) для UI.
 * providerId совпадает с providerId в таблице account better-auth.
 */
export interface AuthProvider {
	id: string;
	label: string;
	description: string;
	icon: Component;
	/** Фирменный цвет платформы (для кнопки входа). */
	brandColor: string;
	/** Имя поля в session.user, где хранится аватар этого провайдера. */
	userAvatarField: string;
	/** Имя поля в session.user, где хранится username этого провайдера. */
	userUsernameField: string;
}

export const AUTH_PROVIDERS: AuthProvider[] = [
	{
		id: 'telegram-oidc',
		label: 'Telegram',
		description: 'Вход через Telegram',
		icon: TelegramIcon,
		brandColor: '#26A5E4',
		userAvatarField: 'telegramAvatar',
		userUsernameField: 'telegramOidcUsername'
	},
	{
		id: 'discord',
		label: 'Discord',
		description: 'Вход через Discord',
		icon: DiscordIcon,
		brandColor: '#5865F2',
		userAvatarField: 'discordAvatar',
		userUsernameField: 'discordUsername'
	}
];

/** Доступный для текущей настройки способ входа (все, что настроены в auth.ts). */
export function getProvider(id: string): AuthProvider | undefined {
	return AUTH_PROVIDERS.find((p) => p.id === id);
}

/** Человекочитаемое название провайдера по его id. */
export function providerLabel(id: string): string {
	return getProvider(id)?.label ?? id;
}

export type SessionUser = {
	name?: string | null;
	image?: string | null;
	telegramAvatar?: string | null;
	telegramOidcUsername?: string | null;
	discordAvatar?: string | null;
	discordUsername?: string | null;
	[key: string]: unknown;
} | null;

/** Аватар пользователя, полученный от конкретного провайдера. */
export function providerAvatar(providerId: string, user: SessionUser): string | null {
	const provider = getProvider(providerId);
	if (!provider || !user) return null;
	const avatar = user[provider.userAvatarField];
	return typeof avatar === 'string' && avatar.length > 0 ? avatar : null;
}

/** Имя пользователя на конкретной платформе. */
export function providerUsername(providerId: string, user: SessionUser): string | null {
	const provider = getProvider(providerId);
	if (!provider || !user) return null;
	const username = user[provider.userUsernameField];
	return typeof username === 'string' && username.length > 0 ? username : null;
}

/**
 * Текст для отображения в профиле этого провайдера:
 * аватар ещё есть платформа, иначе — username (или first name/имя),
 * если username нет.
 * Приоритет: username провайдера → имя (name) → null.
 */
export function providerDisplayName(providerId: string, user: SessionUser): string | null {
	const username = providerUsername(providerId, user);
	if (username) return username;
	if (!user) return null;
	const name = user.name;
	if (typeof name === 'string' && name.trim().length > 0) {
		// Берём первую часть (first name), чтобы не показывать «Ivan Petrov»
		return name.trim().split(/\s+/)[0] ?? null;
	}
	return null;
}
