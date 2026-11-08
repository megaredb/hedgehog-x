import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	formatBytes,
	formatStorageEstimate,
	isValidSeekStep,
	isValidPlaybackRate,
	getStoredSeekStep,
	setStoredSeekStep,
	getStoredPlaybackRate,
	setStoredPlaybackRate,
	getStoredAutoAdvance,
	setStoredAutoAdvance,
	SEEK_STEPS,
	PLAYBACK_RATES,
	MIRROR_OPTIONS,
	SEEK_STEP_STORAGE_KEY,
	AUTO_ADVANCE_STORAGE_KEY,
	PLAYBACK_RATE_STORAGE_KEY
} from './settings-helpers';
import {
	getMirrorPreference,
	setMirrorPreference,
	getActiveMirrorHost,
	MIRROR_STORAGE_KEY,
	PRIMARY_CDN_HOST,
	RU_CDN_HOST
} from '$lib/utils/mirror';

describe('Settings Center Utilities & Formatters', () => {
	const originalWindow = globalThis.window;
	const originalLocalStorage = globalThis.localStorage;

	// In-memory mock for localStorage in Node environment
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

	describe('formatBytes', () => {
		it('returns "0 МБ" for zero, negative, null, or undefined values', () => {
			assert.equal(formatBytes(0), '0 МБ');
			assert.equal(formatBytes(-100), '0 МБ');
			assert.equal(formatBytes(null), '0 МБ');
			assert.equal(formatBytes(undefined), '0 МБ');
			assert.equal(formatBytes(NaN), '0 МБ');
		});

		it('formats bytes under 1 KB without decimals', () => {
			assert.equal(formatBytes(512), '512 Б');
			assert.equal(formatBytes(100), '100 Б');
		});

		it('formats kilobytes without decimals', () => {
			assert.equal(formatBytes(1024), '1 КБ');
			assert.equal(formatBytes(2048), '2 КБ');
			assert.equal(formatBytes(10240), '10 КБ');
		});

		it('formats megabytes with two decimal places', () => {
			assert.equal(formatBytes(1048576), '1.00 МБ');
			assert.equal(formatBytes(1572864), '1.50 МБ');
			assert.equal(formatBytes(50 * 1024 * 1024), '50.00 МБ');
		});

		it('formats gigabytes with two decimal places', () => {
			assert.equal(formatBytes(1073741824), '1.00 ГБ');
			assert.equal(formatBytes(2.5 * 1024 * 1024 * 1024), '2.50 ГБ');
		});
	});

	describe('formatStorageEstimate', () => {
		it('handles undefined or 0 quota safely without division by zero', () => {
			const res = formatStorageEstimate(0, 0);
			assert.equal(res.usedFormatted, '0 МБ');
			assert.equal(res.quotaFormatted, '0 МБ');
			assert.equal(res.percentage, 0);
		});

		it('calculates used percentage accurately and rounds to 1 decimal place', () => {
			const usage = 250 * 1024 * 1024; // 250 MB
			const quota = 1000 * 1024 * 1024; // 1000 MB
			const res = formatStorageEstimate(usage, quota);

			assert.equal(res.usedFormatted, '250.00 МБ');
			assert.equal(res.quotaFormatted, '1000.00 МБ');
			assert.equal(res.percentage, 25);
		});

		it('clamps percentage between 0 and 100', () => {
			const res = formatStorageEstimate(2000, 1000);
			assert.equal(res.percentage, 100);

			const negativeRes = formatStorageEstimate(-50, 1000);
			assert.equal(negativeRes.percentage, 0);
		});
	});

	describe('Seek step validation and persistence', () => {
		it('validates only permitted seek steps (5, 10, 15, 30)', () => {
			assert.deepEqual(SEEK_STEPS, [5, 10, 15, 30]);
			assert.equal(isValidSeekStep(5), true);
			assert.equal(isValidSeekStep(10), true);
			assert.equal(isValidSeekStep(15), true);
			assert.equal(isValidSeekStep(30), true);

			assert.equal(isValidSeekStep(0), false);
			assert.equal(isValidSeekStep(7), false);
			assert.equal(isValidSeekStep(45), false);
			assert.equal(isValidSeekStep('10'), false);
			assert.equal(isValidSeekStep(null), false);
		});

		it('defaults to 10s when nothing is in storage', () => {
			assert.equal(getStoredSeekStep(), 10);
		});

		it('saves and reads valid seek step to localStorage', () => {
			setStoredSeekStep(15);
			assert.equal(globalThis.localStorage.getItem(SEEK_STEP_STORAGE_KEY), '15');
			assert.equal(getStoredSeekStep(), 15);

			setStoredSeekStep(30);
			assert.equal(getStoredSeekStep(), 30);
		});

		it('falls back to default 10s when stored value is invalid or corrupted', () => {
			globalThis.localStorage.setItem(SEEK_STEP_STORAGE_KEY, 'corrupted_value');
			assert.equal(getStoredSeekStep(), 10);

			globalThis.localStorage.setItem(SEEK_STEP_STORAGE_KEY, '99');
			assert.equal(getStoredSeekStep(), 10);
		});
	});

	describe('Playback rate validation and persistence', () => {
		it('validates standard playback rates (0.75, 1, 1.25, 1.5, 1.75, 2)', () => {
			assert.deepEqual(PLAYBACK_RATES, [0.75, 1, 1.25, 1.5, 1.75, 2]);
			assert.equal(isValidPlaybackRate(0.75), true);
			assert.equal(isValidPlaybackRate(1), true);
			assert.equal(isValidPlaybackRate(1.25), true);
			assert.equal(isValidPlaybackRate(1.5), true);
			assert.equal(isValidPlaybackRate(1.75), true);
			assert.equal(isValidPlaybackRate(2), true);

			assert.equal(isValidPlaybackRate(0.5), false);
			assert.equal(isValidPlaybackRate(3.0), false);
			assert.equal(isValidPlaybackRate('1.5'), false);
		});

		it('defaults to 1x when nothing is stored', () => {
			assert.equal(getStoredPlaybackRate(), 1);
		});

		it('persists and retrieves chosen playback rate', () => {
			setStoredPlaybackRate(1.5);
			assert.equal(globalThis.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY), '1.5');
			assert.equal(getStoredPlaybackRate(), 1.5);
		});

		it('falls back to 1x when stored value is invalid', () => {
			globalThis.localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, 'invalid');
			assert.equal(getStoredPlaybackRate(), 1);
		});
	});

	describe('Auto-advance toggle persistence', () => {
		it('defaults to true when nothing is in storage', () => {
			assert.equal(getStoredAutoAdvance(), true);
		});

		it('stores and reads boolean state', () => {
			setStoredAutoAdvance(false);
			assert.equal(globalThis.localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY), 'false');
			assert.equal(getStoredAutoAdvance(), false);

			setStoredAutoAdvance(true);
			assert.equal(globalThis.localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY), 'true');
			assert.equal(getStoredAutoAdvance(), true);
		});
	});

	describe('CDN Mirror preference & active host', () => {
		it('provides three mirror options: auto, primary, ru', () => {
			assert.equal(MIRROR_OPTIONS.length, 3);
			const values = MIRROR_OPTIONS.map((o) => o.value);
			assert.deepEqual(values, ['auto', 'primary', 'ru']);
		});

		it('saves and reads mirror preference', () => {
			assert.equal(getMirrorPreference(), 'auto');

			setMirrorPreference('ru');
			assert.equal(globalThis.localStorage.getItem(MIRROR_STORAGE_KEY), 'ru');
			assert.equal(getMirrorPreference(), 'ru');

			setMirrorPreference('primary');
			assert.equal(getMirrorPreference(), 'primary');
		});

		it('returns correct active mirror host for each preference', () => {
			// @ts-expect-error test mock
			globalThis.window = { location: { hostname: 'hedgehog-inc.one' } };

			assert.equal(getActiveMirrorHost('primary'), PRIMARY_CDN_HOST);
			assert.equal(getActiveMirrorHost('ru'), RU_CDN_HOST);
			assert.equal(getActiveMirrorHost('auto'), PRIMARY_CDN_HOST);

			// Under Russian domain
			// @ts-expect-error test mock
			globalThis.window = { location: { hostname: 'ru.hedgehog-inc.one' } };
			assert.equal(getActiveMirrorHost('auto'), RU_CDN_HOST);
		});
	});

	describe('Settings storage keys and persistence guarantees', () => {
		it('preserves settings storage keys correctly', () => {
			assert.equal(SEEK_STEP_STORAGE_KEY, 'hedgehog:seek_step');
			assert.equal(AUTO_ADVANCE_STORAGE_KEY, 'hedgehog:auto_advance');
			assert.equal(PLAYBACK_RATE_STORAGE_KEY, 'hedgehog:playback_rate');
			assert.equal(MIRROR_STORAGE_KEY, 'hedgehog:mirror_preference');
		});

		it('round-trips settings state without interference across keys', () => {
			setStoredSeekStep(15);
			setStoredPlaybackRate(1.75);
			setStoredAutoAdvance(false);
			setMirrorPreference('ru');

			assert.equal(getStoredSeekStep(), 15);
			assert.equal(getStoredPlaybackRate(), 1.75);
			assert.equal(getStoredAutoAdvance(), false);
			assert.equal(getMirrorPreference(), 'ru');

			// Check that mutating one does not affect others
			setStoredSeekStep(30);
			assert.equal(getStoredSeekStep(), 30);
			assert.equal(getStoredPlaybackRate(), 1.75);
			assert.equal(getStoredAutoAdvance(), false);
			assert.equal(getMirrorPreference(), 'ru');
		});
	});
});
