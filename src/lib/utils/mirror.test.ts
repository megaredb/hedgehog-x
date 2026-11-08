import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	resolveMediaUrl,
	getFallbackMediaUrl,
	isRuHost,
	getMirrorPreference,
	setMirrorPreference,
	getActiveMirrorHost,
	MIRROR_STORAGE_KEY,
	PRIMARY_CDN_HOST,
	RU_CDN_HOST
} from './mirror';

describe('mirror resolver utility', () => {
	const originalWindow = globalThis.window;
	const originalLocalStorage = globalThis.localStorage;

	// In-memory localStorage mock for node environment
	class MockLocalStorage {
		private store: Record<string, string> = {};

		getItem(key: string): string | null {
			return this.store[key] ?? null;
		}

		setItem(key: string, value: string): void {
			this.store[key] = String(value);
		}

		removeItem(key: string): void {
			delete this.store[key];
		}

		clear(): void {
			this.store = {};
		}
	}

	beforeEach(() => {
		const mockStorage = new MockLocalStorage();
		// @ts-expect-error test mock
		globalThis.localStorage = mockStorage;
	});

	afterEach(() => {
		globalThis.window = originalWindow;
		globalThis.localStorage = originalLocalStorage;
	});

	describe('passthrough behavior for non-CDN or relative URLs', () => {
		it('returns empty string for null, undefined, or empty string', () => {
			assert.equal(resolveMediaUrl(null), '');
			assert.equal(resolveMediaUrl(undefined), '');
			assert.equal(resolveMediaUrl(''), '');
		});

		it('passes through relative URLs unmodified without throwing', () => {
			assert.equal(resolveMediaUrl('/audio/chapter1.mp3'), '/audio/chapter1.mp3');
			assert.equal(resolveMediaUrl('audio/chapter2.mp3'), 'audio/chapter2.mp3');
			assert.equal(resolveMediaUrl('/img/cover.webp'), '/img/cover.webp');
		});

		it('passes through third-party URLs unmodified', () => {
			const external = 'https://cdn.discordapp.com/attachments/123/track.mp3';
			assert.equal(resolveMediaUrl(external, 'primary'), external);
			assert.equal(resolveMediaUrl(external, 'ru'), external);
			assert.equal(resolveMediaUrl(external, 'auto'), external);

			const tg = 'https://t.me/hedgehog_inc/42';
			assert.equal(resolveMediaUrl(tg), tg);
		});
	});

	describe('preference handling (explicit primary & ru)', () => {
		const primaryUrl = `https://${PRIMARY_CDN_HOST}/books/mushoku/ch1.mp3`;
		const ruUrl = `https://${RU_CDN_HOST}/books/mushoku/ch1.mp3`;

		it('rewrites to RU CDN when preference is "ru"', () => {
			assert.equal(resolveMediaUrl(primaryUrl, 'ru'), ruUrl);
			assert.equal(resolveMediaUrl(ruUrl, 'ru'), ruUrl);
		});

		it('rewrites to primary CDN when preference is "primary"', () => {
			assert.equal(resolveMediaUrl(ruUrl, 'primary'), primaryUrl);
			assert.equal(resolveMediaUrl(primaryUrl, 'primary'), primaryUrl);
		});
	});

	describe('hostname detection (isRuHost) & auto mode', () => {
		const primaryUrl = `https://${PRIMARY_CDN_HOST}/books/overlord/ch1.mp3`;
		const ruUrl = `https://${RU_CDN_HOST}/books/overlord/ch1.mp3`;

		it('detects RU domain when hostname starts with ru.', () => {
			// @ts-expect-error test mock
			globalThis.window = { location: { hostname: 'ru.hedgehog-inc.one' } };
			assert.equal(isRuHost(), true);
			assert.equal(resolveMediaUrl(primaryUrl, 'auto'), ruUrl);
		});

		it('detects RU domain when hostname ends with .ru', () => {
			// @ts-expect-error test mock
			globalThis.window = { location: { hostname: 'audiobooks.hedgehog-inc.ru' } };
			assert.equal(isRuHost(), true);
			assert.equal(resolveMediaUrl(primaryUrl, 'auto'), ruUrl);
		});

		it('detects RU domain when hostname includes ru-files', () => {
			// @ts-expect-error test mock
			globalThis.window = { location: { hostname: 'ru-files.hedgehog-inc.one' } };
			assert.equal(isRuHost(), true);
			assert.equal(resolveMediaUrl(primaryUrl, 'auto'), ruUrl);
		});

		it('resolves to primary CDN when on non-RU domain in auto mode', () => {
			// @ts-expect-error test mock
			globalThis.window = { location: { hostname: 'hedgehog-inc.one' } };
			assert.equal(isRuHost(), false);
			assert.equal(resolveMediaUrl(ruUrl, 'auto'), primaryUrl);
			assert.equal(resolveMediaUrl(primaryUrl, 'auto'), primaryUrl);
		});

		it('returns false for isRuHost and defaults safely during SSR (window undefined)', () => {
			// @ts-expect-error simulate SSR
			globalThis.window = undefined;
			assert.equal(isRuHost(), false);
			assert.equal(resolveMediaUrl(ruUrl, 'auto'), primaryUrl);
		});
	});

	describe('preference persistence in localStorage', () => {
		it('defaults to "auto" when nothing is stored', () => {
			assert.equal(getMirrorPreference(), 'auto');
		});

		it('stores and retrieves preference correctly', () => {
			setMirrorPreference('ru');
			assert.equal(globalThis.localStorage.getItem(MIRROR_STORAGE_KEY), 'ru');
			assert.equal(getMirrorPreference(), 'ru');

			setMirrorPreference('primary');
			assert.equal(getMirrorPreference(), 'primary');

			setMirrorPreference('auto');
			assert.equal(getMirrorPreference(), 'auto');
		});

		it('uses stored preference when no preference argument is supplied to resolveMediaUrl', () => {
			// @ts-expect-error test mock
			globalThis.window = { location: { hostname: 'hedgehog-inc.one' } };
			const primaryUrl = `https://${PRIMARY_CDN_HOST}/audio/sample.mp3`;
			const ruUrl = `https://${RU_CDN_HOST}/audio/sample.mp3`;

			setMirrorPreference('ru');
			assert.equal(resolveMediaUrl(primaryUrl), ruUrl);

			setMirrorPreference('primary');
			assert.equal(resolveMediaUrl(ruUrl), primaryUrl);
		});
	});

	describe('getActiveMirrorHost', () => {
		it('returns RU CDN host when preference is explicitly "ru"', () => {
			assert.equal(getActiveMirrorHost('ru'), RU_CDN_HOST);
		});

		it('returns primary CDN host when preference is explicitly "primary"', () => {
			assert.equal(getActiveMirrorHost('primary'), PRIMARY_CDN_HOST);
		});

		it('respects auto mode with domain detection', () => {
			// @ts-expect-error test mock
			globalThis.window = { location: { hostname: 'ru.hedgehog-inc.one' } };
			assert.equal(getActiveMirrorHost('auto'), RU_CDN_HOST);

			// @ts-expect-error test mock
			globalThis.window = { location: { hostname: 'hedgehog-inc.one' } };
			assert.equal(getActiveMirrorHost('auto'), PRIMARY_CDN_HOST);
		});

		it('falls back to stored preference when no argument is supplied', () => {
			// @ts-expect-error test mock
			globalThis.window = { location: { hostname: 'hedgehog-inc.one' } };
			setMirrorPreference('ru');
			assert.equal(getActiveMirrorHost(), RU_CDN_HOST);

			setMirrorPreference('primary');
			assert.equal(getActiveMirrorHost(), PRIMARY_CDN_HOST);
		});
	});

	describe('getFallbackMediaUrl', () => {
		const primaryUrl = `https://${PRIMARY_CDN_HOST}/audio/track.mp3?token=abc`;
		const ruUrl = `https://${RU_CDN_HOST}/audio/track.mp3?token=abc`;

		it('returns RU mirror for primary CDN URL', () => {
			assert.equal(getFallbackMediaUrl(primaryUrl), ruUrl);
		});

		it('returns primary mirror for RU CDN URL', () => {
			assert.equal(getFallbackMediaUrl(ruUrl), primaryUrl);
		});

		it('returns null for empty, null, undefined, relative, or third-party URLs', () => {
			assert.equal(getFallbackMediaUrl(null), null);
			assert.equal(getFallbackMediaUrl(undefined), null);
			assert.equal(getFallbackMediaUrl(''), null);
			assert.equal(getFallbackMediaUrl('/audio/local.mp3'), null);
			assert.equal(getFallbackMediaUrl('https://example.com/audio.mp3'), null);
		});
	});
});
