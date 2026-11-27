import { env } from '$env/dynamic/private';
import { createLogger } from '$lib/logger';

const log = createLogger('DiscordApi');
const API_BASE = (env.DISCORD_API_BASE_URL?.trim() || 'https://discord.com/api/v10').replace(
	/\/$/,
	''
);
const TIMEOUT_MS = 8000;

export class DiscordApiError extends Error {
	status: number;
	code: string | null;

	constructor(status: number, message: string, code: string | null = null) {
		super(message);
		this.name = 'DiscordApiError';
		this.status = status;
		this.code = code;
	}
}

export interface DiscordGuildMember {
	user?: { id: string; username?: string; global_name?: string | null };
	roles: string[];
	nick?: string | null;
}

export interface DiscordGuild {
	id: string;
	name: string;
	icon: string | null;
}

export interface DiscordRole {
	id: string;
	name: string;
	color: number;
	position: number;
}

export interface DiscordBotUser {
	id: string;
	username: string;
	bot?: boolean;
}

async function discordFetch<T>(
	path: string,
	authorization: string,
	init: RequestInit = {}
): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${API_BASE}${path}`, {
			...init,
			headers: {
				accept: 'application/json',
				authorization,
				...(init.headers ?? {})
			},
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'network error';
		log.warn(`${path}: request failed`, message);
		throw new DiscordApiError(0, `Discord недоступен: ${message}`);
	}

	const data = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			(data && typeof data === 'object' && 'message' in data && String(data.message)) ||
			`HTTP ${response.status}`;
		const code =
			data && typeof data === 'object' && 'code' in data && data.code != null
				? String(data.code)
				: null;
		throw new DiscordApiError(response.status, message, code);
	}
	return data as T;
}

export function getBotToken(): string {
	return env.DISCORD_BOT_TOKEN?.trim() ?? '';
}

export function getGuildId(): string {
	return env.DISCORD_GUILD_ID?.trim() ?? '';
}

export function getSubscriberRoleIds(): string[] {
	return (env.DISCORD_SUBSCRIBER_ROLE_IDS ?? '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
}

export function isDiscordConfigured(): boolean {
	return Boolean(getGuildId() && getSubscriberRoleIds().length);
}

export function hasSubscriberRole(
	member: DiscordGuildMember,
	roleIds = getSubscriberRoleIds()
): boolean {
	const roles = Array.isArray(member.roles) ? member.roles : [];
	return roles.some((roleId) => roleIds.includes(roleId));
}

export function getGuildMemberWithBot(
	guildId: string,
	userId: string
): Promise<DiscordGuildMember> {
	const token = getBotToken();
	if (!token) throw new DiscordApiError(0, 'DISCORD_BOT_TOKEN не настроен');
	return discordFetch<DiscordGuildMember>(`/guilds/${guildId}/members/${userId}`, `Bot ${token}`);
}

export function getGuildMemberWithOAuth(
	guildId: string,
	accessToken: string
): Promise<DiscordGuildMember> {
	return discordFetch<DiscordGuildMember>(
		`/users/@me/guilds/${guildId}/member`,
		`Bearer ${accessToken}`
	);
}

export function getGuildWithBot(guildId: string): Promise<DiscordGuild> {
	const token = getBotToken();
	if (!token) throw new DiscordApiError(0, 'DISCORD_BOT_TOKEN не настроен');
	return discordFetch<DiscordGuild>(`/guilds/${guildId}`, `Bot ${token}`);
}

export function getGuildRoleWithBot(guildId: string, roleId: string): Promise<DiscordRole> {
	const token = getBotToken();
	if (!token) throw new DiscordApiError(0, 'DISCORD_BOT_TOKEN не настроен');
	return discordFetch<DiscordRole>(`/guilds/${guildId}/roles/${roleId}`, `Bot ${token}`);
}

export function getBotUser(): Promise<DiscordBotUser> {
	const token = getBotToken();
	if (!token) throw new DiscordApiError(0, 'DISCORD_BOT_TOKEN не настроен');
	return discordFetch<DiscordBotUser>('/users/@me', `Bot ${token}`);
}

export function getUserGuildsWithOAuth(
	accessToken: string
): Promise<Array<{ id: string; name: string; owner?: boolean; permissions?: string }>> {
	return discordFetch('/users/@me/guilds', `Bearer ${accessToken}`);
}
