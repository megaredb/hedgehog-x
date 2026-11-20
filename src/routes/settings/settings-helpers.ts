import { db } from '$lib/client/db';
import { likeService } from '$lib/client/services/likeService';
import {
	getMirrorPreference,
	setMirrorPreference,
	getActiveMirrorHost,
	type MirrorPreference
} from '$lib/utils/mirror';

import {
	SEEK_STEP_STORAGE_KEY,
	AUTO_ADVANCE_STORAGE_KEY,
	PLAYBACK_RATE_STORAGE_KEY
} from '$lib/constants/settings';
import { parseSeekStep, parsePlaybackRate, parseAutoAdvance } from '$lib/settings/values';
import type { SeekStep, PlaybackRate } from '$lib/settings/values';
export { SEEK_STEP_STORAGE_KEY, AUTO_ADVANCE_STORAGE_KEY, PLAYBACK_RATE_STORAGE_KEY };

export {
	SEEK_STEPS,
	PLAYBACK_RATES,
	isValidSeekStep,
	isValidPlaybackRate,
	type SeekStep,
	type PlaybackRate
} from '$lib/settings/values';

export interface MirrorOption {
	value: MirrorPreference;
	label: string;
	description: string;
}

export const MIRROR_OPTIONS: MirrorOption[] = [
	{
		value: 'auto',
		label: 'Автоматически',
		description: 'Определение по домену + авто-fallback при сбоях'
	},
	{
		value: 'primary',
		label: 'Основной CDN',
		description: 'files.hedgehog-inc.one (глобальный Cloudflare R2)'
	},
	{
		value: 'ru',
		label: 'RU Прокси',
		description: 'ru-files.hedgehog-inc.one (прокси)'
	}
];

export function getStoredSeekStep(): SeekStep {
	if (typeof localStorage === 'undefined') return 10;
	try {
		const parsed = parseSeekStep(localStorage.getItem(SEEK_STEP_STORAGE_KEY));
		if (parsed !== null) return parsed;
	} catch {
		// Ignore storage errors
	}
	return 10;
}

export function setStoredSeekStep(step: SeekStep): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(SEEK_STEP_STORAGE_KEY, String(step));
	} catch {
		// Ignore storage errors
	}
}

export function getStoredPlaybackRate(): PlaybackRate {
	if (typeof localStorage === 'undefined') return 1;
	try {
		const parsed = parsePlaybackRate(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY));
		if (parsed !== null) return parsed;
	} catch {
		// Ignore storage errors
	}
	return 1;
}

export function setStoredPlaybackRate(rate: PlaybackRate): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(rate));
	} catch {
		// Ignore storage errors
	}
}

export function getStoredAutoAdvance(): boolean {
	if (typeof localStorage === 'undefined') return true;
	try {
		const parsed = parseAutoAdvance(localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY));
		if (parsed !== null) return parsed;
	} catch {
		// Ignore storage errors
	}
	return true;
}

export function setStoredAutoAdvance(val: boolean): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, String(val));
	} catch {
		// Ignore storage errors
	}
}

/**
 * Formats a byte count into a human-readable Russian string (Б, КБ, МБ, ГБ).
 */
export function formatBytes(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
		return '0 МБ';
	}
	const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}

	// For bytes, integer only; for others show 1 or 2 decimals
	const decimals = unitIndex === 0 ? 0 : unitIndex === 1 ? 0 : 2;
	return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export interface StorageEstimateInfo {
	usage: number;
	quota: number;
	formattedUsage: string;
	formattedQuota: string;
	percentage: number;
}

export function formatStorageEstimate(
	usage: number | undefined,
	quota: number | undefined
): { usedFormatted: string; quotaFormatted: string; percentage: number } {
	const validUsage = typeof usage === 'number' && !isNaN(usage) && usage > 0 ? usage : 0;
	const validQuota = typeof quota === 'number' && !isNaN(quota) && quota > 0 ? quota : 0;

	const percentage =
		validQuota > 0 ? Math.min(100, Math.max(0, (validUsage / validQuota) * 100)) : 0;

	return {
		usedFormatted: formatBytes(validUsage),
		quotaFormatted: formatBytes(validQuota),
		percentage: Math.round(percentage * 10) / 10
	};
}

export async function fetchStorageEstimate(): Promise<StorageEstimateInfo> {
	if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
		try {
			const est = await navigator.storage.estimate();
			const usage = est.usage ?? 0;
			const quota = est.quota ?? 0;
			const formatted = formatStorageEstimate(usage, quota);
			return {
				usage,
				quota,
				formattedUsage: formatted.usedFormatted,
				formattedQuota: formatted.quotaFormatted,
				percentage: formatted.percentage
			};
		} catch {
			// fallback
		}
	}
	return {
		usage: 0,
		quota: 0,
		formattedUsage: '0 МБ',
		formattedQuota: '0 МБ',
		percentage: 0
	};
}

export interface ClearCacheResult {
	success: boolean;
	clearedCaches: string[];
	clearedDownloadsCount: number;
	error?: string;
}

/**
 * Clears CacheStorage caches (pages-cache, audio-cache, etc.), OPFS entries, and Dexie downloads.
 */
export async function clearAppCache(
	options: { clearDownloads?: boolean } = { clearDownloads: true }
): Promise<ClearCacheResult> {
	const clearedCaches: string[] = [];
	let clearedDownloadsCount = 0;

	try {
		// 1. Clear CacheStorage
		if (typeof caches !== 'undefined') {
			const keys = await caches.keys();
			for (const key of keys) {
				const deleted = await caches.delete(key);
				if (deleted) {
					clearedCaches.push(key);
				}
			}
		}

		// 2. Clear downloads from Dexie & OPFS if requested
		if (options.clearDownloads) {
			try {
				clearedDownloadsCount = await db.downloads.count();
				await db.downloads.clear();
			} catch {
				// Ignore if Dexie table error
			}

			// Clear OPFS audio files
			if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
				try {
					const opfsRoot = await navigator.storage.getDirectory();
					// Iterate entries if available safely using type-safe async iterable
					const rootIter = opfsRoot as unknown as {
						keys?: () => AsyncIterable<string>;
						entries?: () => AsyncIterable<[string, FileSystemHandle]>;
					};
					if (typeof rootIter.keys === 'function') {
						for await (const name of rootIter.keys()) {
							await opfsRoot.removeEntry(name, { recursive: true });
						}
					} else if (typeof rootIter.entries === 'function') {
						for await (const [name] of rootIter.entries()) {
							await opfsRoot.removeEntry(name, { recursive: true });
						}
					}
				} catch {
					// Ignore OPFS deletion errors
				}
			}
		}

		return {
			success: true,
			clearedCaches,
			clearedDownloadsCount
		};
	} catch (err) {
		return {
			success: false,
			clearedCaches,
			clearedDownloadsCount,
			error: err instanceof Error ? err.message : String(err)
		};
	}
}

export interface ManualSyncResult {
	success: boolean;
	syncedLikes: number;
	syncedBookmarks: number;
	error?: string;
}

/**
 * Performs manual synchronization of pending mutations in syncQueue
 * (likes, progress, bookmarks).
 */
export async function performManualSync(fetchFn: typeof fetch = fetch): Promise<ManualSyncResult> {
	try {
		const likeRes = await likeService.syncLikesQueue(fetchFn);
		let syncedBookmarks = 0;

		if (typeof window !== 'undefined') {
			try {
				const { progressSync } = await import('$lib/client/services/progressSync.svelte.js');
				await progressSync.flushOfflineQueue();
			} catch {
				// Ignore progressSync error
			}

			try {
				const { flushBookmarkQueue } = await import('$lib/client/services/bookmarkSync');
				syncedBookmarks = await flushBookmarkQueue(fetchFn);
			} catch {
				// Ignore bookmarkSync error; queue stays for the next retry
			}

			try {
				const { listeningTracker } = await import('$lib/client/services/listeningTracker.svelte');
				listeningTracker.flush();
				await listeningTracker.flushOfflineQueue();
			} catch {
				// Listening stats will retry later; do not fail the whole manual sync.
			}
		}

		return {
			success: true,
			syncedLikes: likeRes.synced,
			syncedBookmarks
		};
	} catch (err) {
		return {
			success: false,
			syncedLikes: 0,
			syncedBookmarks: 0,
			error: err instanceof Error ? err.message : String(err)
		};
	}
}

export { getMirrorPreference, setMirrorPreference, getActiveMirrorHost, type MirrorPreference };
