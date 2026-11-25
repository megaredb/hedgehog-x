import { env } from '$env/dynamic/private';
import http from 'node:http';
import https from 'node:https';
import { createLogger } from '$lib/logger';

const log = createLogger('TelegramApi');
const API_BASE = (env.TELEGRAM_API_BASE_URL?.trim() || 'https://api.telegram.org').replace(
	/\/$/,
	''
);
const TOKEN = env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
const TIMEOUT_MS = 15000;

export class TelegramApiError extends Error {
	status: number;
	description: string;
	retryAfter: number | null;
	migrateToChatId: number | null;

	constructor(
		status: number,
		description: string,
		retryAfter: number | null = null,
		migrateToChatId: number | null = null
	) {
		super(description);
		this.name = 'TelegramApiError';
		this.status = status;
		this.description = description;
		this.retryAfter = retryAfter;
		this.migrateToChatId = migrateToChatId;
	}
}

interface TelegramResponse<T> {
	ok: boolean;
	result?: T;
	description?: string;
	error_code?: number;
	parameters?: { retry_after?: number; migrate_to_chat_id?: number };
}

export interface TelegramUser {
	id: number;
	is_bot: boolean;
	first_name: string;
	username?: string;
}

export interface TelegramChat {
	id: number;
	type: 'private' | 'group' | 'supergroup' | 'channel';
	title?: string;
	username?: string;
}

export interface TelegramChatMember {
	status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
	user: TelegramUser;
	is_member?: boolean;
}

export interface TelegramWebhookInfo {
	url: string;
	has_custom_certificate: boolean;
	pending_update_count: number;
	last_error_date?: number;
	last_error_message?: string;
	allowed_updates?: string[];
}

export function telegramCall<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
	if (!TOKEN) return Promise.reject(new TelegramApiError(0, 'TELEGRAM_BOT_TOKEN не настроен'));

	const endpoint = new URL(`${API_BASE}/bot${TOKEN}/${method}`);
	const transport = endpoint.protocol === 'http:' ? http : https;
	const body = JSON.stringify(params);

	return new Promise<T>((resolve, reject) => {
		let settled = false;
		const fail = (error: TelegramApiError) => {
			if (settled) return;
			settled = true;
			reject(error);
		};
		const succeed = (value: T) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};

		const request = transport.request(
			{
				protocol: endpoint.protocol,
				hostname: endpoint.hostname,
				port: endpoint.port || undefined,
				path: endpoint.pathname + endpoint.search,
				method: 'POST',
				family: 4,
				headers: {
					'content-type': 'application/json',
					'content-length': Buffer.byteLength(body)
				}
			},
			(response) => {
				let raw = '';
				response.setEncoding('utf8');
				response.on('data', (chunk: string) => {
					raw += chunk;
				});
				response.on('end', () => {
					let data: TelegramResponse<T> | null;
					try {
						data = JSON.parse(raw) as TelegramResponse<T>;
					} catch {
						data = null;
					}
					const status = response.statusCode ?? 0;
					if (status < 200 || status >= 300 || !data?.ok) {
						fail(
							new TelegramApiError(
								data?.error_code ?? status,
								data?.description || `HTTP ${status}`,
								data?.parameters?.retry_after ?? null,
								data?.parameters?.migrate_to_chat_id ?? null
							)
						);
						return;
					}
					succeed(data.result as T);
				});
			}
		);

		request.setTimeout(TIMEOUT_MS, () => {
			request.destroy(new Error('timeout'));
		});
		request.on('error', (error) => {
			const message = error instanceof Error ? error.message : 'network error';
			log.warn(`${method}: request failed`, message);
			fail(new TelegramApiError(0, `Telegram недоступен: ${message}`));
		});
		request.end(body);
	});
}

export function getMe(): Promise<TelegramUser> {
	return telegramCall<TelegramUser>('getMe');
}

export function getChat(chatId: string): Promise<TelegramChat> {
	return telegramCall<TelegramChat>('getChat', { chat_id: chatId });
}

export function getChatMember(chatId: string, userId: string): Promise<TelegramChatMember> {
	return telegramCall<TelegramChatMember>('getChatMember', {
		chat_id: chatId,
		user_id: userId
	});
}

export function getWebhookInfo(): Promise<TelegramWebhookInfo> {
	return telegramCall<TelegramWebhookInfo>('getWebhookInfo');
}

export function setWebhook(params: {
	url: string;
	secretToken: string;
	allowedUpdates?: string[];
}): Promise<boolean> {
	return telegramCall<boolean>('setWebhook', {
		url: params.url,
		secret_token: params.secretToken,
		allowed_updates: params.allowedUpdates ?? ['chat_member', 'my_chat_member']
	});
}

export function isActiveMemberStatus(status: TelegramChatMember['status']): boolean {
	return status === 'creator' || status === 'administrator' || status === 'member';
}

export function isActiveMember(member: TelegramChatMember): boolean {
	if (isActiveMemberStatus(member.status)) return true;
	return member.status === 'restricted' && member.is_member === true;
}
