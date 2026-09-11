import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	loadCachedSession,
	saveCachedSession,
	clearCachedSession,
	loadCachedAccounts,
	saveCachedAccounts,
	clearCachedAccounts,
	AUTH_SESSION_STORAGE_KEY,
	AUTH_ACCOUNTS_STORAGE_KEY,
	type SessionData
} from './auth-storage';
import type { LinkedAccount } from './accounts.svelte';

// Тестовый mock localStorage в Node окружении
class LocalStorageMock {
	private store = new Map<string, string>();

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}
}

describe('auth-storage (offline persistence)', () => {
	beforeEach(() => {
		const storage = new LocalStorageMock();
		// @ts-expect-error Mocking window and localStorage in Node test environment
		globalThis.window = globalThis;
		// @ts-expect-error Mocking localStorage
		globalThis.localStorage = storage;
	});

	const validSessionData: SessionData = {
		session: {
			id: 'sess_123',
			userId: 'user_456',
			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // +1 day
			token: 'tok_abc'
		},
		user: {
			id: 'user_456',
			name: 'Test User',
			email: 'test@example.com',
			telegramAvatar: 'https://example.com/avatar.jpg'
		}
	};

	it('сохраняет и загружает валидную сессию', () => {
		saveCachedSession(validSessionData);
		const loaded = loadCachedSession();

		assert.ok(loaded);
		assert.equal(loaded?.session?.id, 'sess_123');
		assert.equal(loaded?.user?.name, 'Test User');
		assert.ok(loaded?.session?.expiresAt instanceof Date);
	});

	it('аннулирует и удаляет кэш, если expiresAt истёк (строгий контроль)', () => {
		const expiredSession: SessionData = {
			...validSessionData,
			session: {
				...validSessionData.session!,
				expiresAt: new Date(Date.now() - 5000) // 5 seconds ago
			}
		};

		saveCachedSession(expiredSession);
		const loaded = loadCachedSession();

		assert.equal(loaded, null);
		assert.equal(localStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
	});

	it('безопасно обрабатывает повреждённый JSON в localStorage', () => {
		localStorage.setItem(AUTH_SESSION_STORAGE_KEY, 'invalid-json{{');
		const loaded = loadCachedSession();

		assert.equal(loaded, null);
		assert.equal(localStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
	});

	it('очищает сессию при вызове clearCachedSession', () => {
		saveCachedSession(validSessionData);
		clearCachedSession();

		assert.equal(loadCachedSession(), null);
		assert.equal(localStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
	});

	it('сохраняет, загружает и очищает список привязанных аккаунтов', () => {
		const accounts: LinkedAccount[] = [
			{
				id: 'acc_1',
				providerId: 'telegram',
				accountId: 'tg_123',
				userId: 'user_456',
				createdAt: new Date(),
				updatedAt: new Date()
			}
		];

		saveCachedAccounts(accounts);
		const loaded = loadCachedAccounts();

		assert.equal(loaded.length, 1);
		assert.equal(loaded[0].providerId, 'telegram');
		assert.ok(loaded[0].createdAt instanceof Date);

		clearCachedAccounts();
		assert.equal(loadCachedAccounts().length, 0);
		assert.equal(localStorage.getItem(AUTH_ACCOUNTS_STORAGE_KEY), null);
	});
});
