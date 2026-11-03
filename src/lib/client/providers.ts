import TelegramIcon from '$lib/components/ui/brand-icons/TelegramIcon.svelte';
import DiscordIcon from '$lib/components/ui/brand-icons/DiscordIcon.svelte';
import type { Component } from 'svelte';

/**
 * UI description of supported OAuth providers.
 */
export interface AuthProvider {
	id: string;
	label: string;
	description: string;
	icon: Component;
	brandColor: string;
	userAvatarField: string;
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

/** Looks up provider configuration by ID */
export function getProvider(id: string): AuthProvider | undefined {
	return AUTH_PROVIDERS.find((p) => p.id === id);
}

/** Human-readable provider label */
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

/** User avatar received from a specific provider */
export function providerAvatar(providerId: string, user: SessionUser): string | null {
	const provider = getProvider(providerId);
	if (!provider || !user) return null;
	const avatar = user[provider.userAvatarField];
	return typeof avatar === 'string' && avatar.length > 0 ? avatar : null;
}

/** User handle received from a specific provider */
export function providerUsername(providerId: string, user: SessionUser): string | null {
	const provider = getProvider(providerId);
	if (!provider || !user) return null;
	const username = user[provider.userUsernameField];
	return typeof username === 'string' && username.length > 0 ? username : null;
}

/**
 * Display name for a provider profile:
 * Priority: provider handle -> user first name -> null
 */
export function providerDisplayName(providerId: string, user: SessionUser): string | null {
	const username = providerUsername(providerId, user);
	if (username) return username;
	if (!user) return null;
	const name = user.name;
	if (typeof name === 'string' && name.trim().length > 0) {
		return name.trim().split(/\s+/)[0] ?? null;
	}
	return null;
}
