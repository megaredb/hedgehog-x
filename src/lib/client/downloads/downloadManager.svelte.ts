import { db, type OfflineChapter, type OfflineDownload } from '$lib/client/db';
import { liveQuery } from 'dexie';
import { SvelteMap } from 'svelte/reactivity';
import { createLogger } from '$lib/logger';
import { resolveMediaUrl, getFallbackMediaUrl } from '$lib/utils/mirror';
import { parseContentLength, hasEnoughDownloadSpace, buildCorsUrl } from './downloadUtils';
import { audioVersionKey } from '$lib/audio-version';

const log = createLogger('Downloads');

function downloadKey(chapterId: string, versionId = 'default'): string {
	return audioVersionKey(chapterId, versionId);
}

function storageFileName(key: string): string {
	return key.replaceAll('::', '__');
}

export interface DownloadSource {
	chapterId: string;
	versionId?: string;
	title: string;
	audioUrl: string;
	durationSeconds: number;
	volumeId?: string;
}

export interface DownloadStats {
	percentage: number;
	downloadedBytes: number;
	totalBytes: number;
}

const activeDownloads = new SvelteMap<string, AbortController>();
let processingQueue = false;

let downloads = $state<OfflineDownload[]>([]);
let chapters = $state<OfflineChapter[]>([]);
const progressMap = $state<Record<string, DownloadStats>>({});

if (typeof window !== 'undefined') {
	liveQuery(async () => {
		const downloadsList = await db.downloads.toArray();
		const chaptersList = await db.chapters.toArray();
		return { downloadsList, chaptersList };
	}).subscribe({
		next: (data) => {
			downloads = data.downloadsList;
			chapters = data.chaptersList;

			if (!processingQueue && downloads.some((d) => d.status === 'queued')) {
				processQueue();
			}
		},
		error: (err) => {
			log.error('Downloads liveQuery subscription error:', err);
		}
	});
}

async function processQueue() {
	if (processingQueue) return;

	if (activeDownloads.size > 0 || downloads.some((d) => d.status === 'downloading')) {
		return;
	}

	const queuedItems = downloads.filter((d) => d.status === 'queued');
	if (queuedItems.length === 0) return;

	queuedItems.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
	const nextDownload = queuedItems[0];
	const baseChapterId = nextDownload.baseChapterId ?? nextDownload.chapterId;
	const chapterToDownload = chapters.find((c) => c.id === baseChapterId);

	if (!nextDownload.audioUrl && !chapterToDownload) {
		await db.downloads.delete(nextDownload.chapterId);
		processQueue();
		return;
	}

	processingQueue = true;
	try {
		await performDownload(nextDownload, chapterToDownload);
	} finally {
		processingQueue = false;
		processQueue();
	}
}

async function performDownload(download: OfflineDownload, chapter?: OfflineChapter) {
	const key = download.chapterId;
	if (activeDownloads.has(key)) return;

	const controller = new AbortController();
	activeDownloads.set(key, controller);

	const audioUrl = download.audioUrl ?? chapter?.audioUrl;
	if (!audioUrl) throw new Error('Audio URL is missing');

	progressMap[key] = { percentage: 0, downloadedBytes: 0, totalBytes: 0 };

	try {
		await db.downloads.put({
			...download,
			chapterId: key,
			status: 'downloading',
			progress: 0,
			createdAt: download.createdAt ?? Date.now()
		});

		const primaryUrl = resolveMediaUrl(audioUrl);
		const fallbackUrl = getFallbackMediaUrl(primaryUrl);

		const fetchWithCors = async (urlStr: string) => {
			const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
			return fetch(buildCorsUrl(urlStr, baseUrl), { signal: controller.signal });
		};

		let response: Response;
		try {
			response = await fetchWithCors(primaryUrl);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
		} catch (primaryErr) {
			if (controller.signal.aborted) throw primaryErr;
			if (fallbackUrl && fallbackUrl !== primaryUrl) {
				log.warn(
					`Download of chapter ${chapter?.id ?? key} from primary mirror failed, switching to fallback:`,
					primaryErr
				);
				response = await fetchWithCors(fallbackUrl);
				if (!response.ok) {
					throw new Error(`Fallback HTTP error! status: ${response.status}`, { cause: primaryErr });
				}
			} else {
				throw primaryErr;
			}
		}

		const totalBytes = parseContentLength(response.headers.get('content-length'));

		if (navigator.storage && navigator.storage.estimate && totalBytes > 0) {
			const estimate = await navigator.storage.estimate();
			if (estimate.quota && estimate.usage) {
				const availableBytes = estimate.quota - estimate.usage;
				if (!hasEnoughDownloadSpace(availableBytes, totalBytes)) {
					throw new Error('Not enough storage space on device.');
				}
			}
		}

		const reader = response.body?.getReader();
		let receivedBytes = 0;

		if (!reader) throw new Error('Stream reading not supported');

		// Clean previous cached copy if present
		try {
			const cache = await caches.open('audio-cache');
			await cache.delete(primaryUrl);
			if (fallbackUrl) await cache.delete(fallbackUrl);
			await cache.delete(audioUrl);
		} catch {
			// ignore
		}

		const opfsRoot = await navigator.storage.getDirectory();
		const fileHandle = await opfsRoot.getFileHandle(storageFileName(key), { create: true });
		const writable = await fileHandle.createWritable();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				receivedBytes += value.length;
				const pct = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;

				progressMap[key] = { percentage: pct, downloadedBytes: receivedBytes, totalBytes };
				await writable.write(value);
			}
			await writable.close();
			if (totalBytes > 0 && receivedBytes !== totalBytes) {
				throw new Error(`Incomplete download: ${receivedBytes}/${totalBytes} bytes`);
			}
		} catch (e) {
			await writable.abort().catch(() => {});
			await opfsRoot.removeEntry(storageFileName(key)).catch(() => {});
			await reader.cancel().catch(() => {});
			throw e;
		}

		await db.downloads.put({
			...download,
			chapterId: key,
			status: 'downloaded',
			progress: 100,
			totalBytes,
			createdAt: download.createdAt ?? Date.now()
		});

		progressMap[key] = { percentage: 100, downloadedBytes: totalBytes, totalBytes };
	} catch (err: unknown) {
		if (err instanceof Error && err.name === 'AbortError') {
			log.debug(`Download of chapter ${key} was aborted`);
		} else {
			log.error(`Error downloading chapter ${key}:`, err);
			await db.downloads.put({
				...download,
				chapterId: key,
				status: 'error',
				error: err instanceof Error ? err.message : String(err),
				createdAt: download.createdAt ?? Date.now()
			});
		}
	} finally {
		activeDownloads.delete(key);
	}
}

export function useDownloads() {
	const queued = $derived(
		downloads
			.filter((d) => d.status === 'queued')
			.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
	);
	const downloading = $derived(downloads.filter((d) => d.status === 'downloading'));
	const downloaded = $derived(downloads.filter((d) => d.status === 'downloaded'));

	const downloadingChapters = $derived(
		downloading
			.map((d) => {
				const ch = chapters.find((c) => c.id === (d.baseChapterId ?? d.chapterId));
				return { download: d, chapter: ch };
			})
			.filter(
				(item): item is { download: OfflineDownload; chapter: OfflineChapter } =>
					item.chapter !== undefined
			)
	);

	const queuedChapters = $derived(
		queued
			.map((d) => {
				const ch = chapters.find((c) => c.id === (d.baseChapterId ?? d.chapterId));
				return { download: d, chapter: ch };
			})
			.filter(
				(item): item is { download: OfflineDownload; chapter: OfflineChapter } =>
					item.chapter !== undefined
			)
	);

	const downloadedChapters = $derived(
		downloaded
			.map((d) => {
				const ch = chapters.find((c) => c.id === (d.baseChapterId ?? d.chapterId));
				return { download: d, chapter: ch };
			})
			.filter(
				(item): item is { download: OfflineDownload; chapter: OfflineChapter } =>
					item.chapter !== undefined
			)
	);

	async function enqueueSource(source: DownloadSource) {
		const versionId = source.versionId ?? 'default';
		const key = downloadKey(source.chapterId, versionId);
		await db.downloads.put({
			chapterId: key,
			baseChapterId: source.chapterId,
			versionId,
			title: source.title,
			audioUrl: source.audioUrl,
			durationSeconds: source.durationSeconds,
			volumeId: source.volumeId,
			status: 'queued',
			progress: 0,
			createdAt: Date.now()
		});
		processQueue();
	}

	async function enqueueDownload(chapter: OfflineChapter) {
		const rawChapter = $state.snapshot(chapter);
		await db.chapters.put(rawChapter);
		await enqueueSource({
			chapterId: chapter.id,
			versionId: 'default',
			title: chapter.title,
			audioUrl: chapter.audioUrl,
			durationSeconds: chapter.durationSeconds,
			volumeId: chapter.volumeId
		});
	}

	async function enqueueVersionDownload(
		chapter: OfflineChapter,
		version: { versionId: string; title: string; audioUrl: string; durationSeconds: number }
	) {
		await db.chapters.put($state.snapshot(chapter));
		await enqueueSource({
			chapterId: chapter.id,
			versionId: version.versionId,
			title: version.title || chapter.title,
			audioUrl: version.audioUrl,
			durationSeconds: version.durationSeconds,
			volumeId: chapter.volumeId
		});
	}

	async function enqueueVolume(
		volumeId: string,
		volumeChapters: OfflineChapter[],
		versionId = 'default',
		versions: Array<{
			chapterId: string;
			versionId: string;
			title: string;
			audioUrl: string;
			durationSeconds: number;
		}> = []
	) {
		const now = Date.now();
		const versionMap = new SvelteMap(versions.map((version) => [version.chapterId, version]));

		for (let i = 0; i < volumeChapters.length; i++) {
			const chapter = volumeChapters[i];
			const version = versionId === 'default' ? null : versionMap.get(chapter.id);
			if (versionId !== 'default' && !version) continue;
			const key = downloadKey(chapter.id, versionId);
			if (isDownloaded(key) || isDownloading(key) || isQueued(key)) continue;
			await db.chapters.put($state.snapshot(chapter));
			await db.downloads.put({
				chapterId: key,
				baseChapterId: chapter.id,
				versionId,
				title: version?.title || chapter.title,
				audioUrl: version?.audioUrl || chapter.audioUrl,
				durationSeconds: version?.durationSeconds || chapter.durationSeconds,
				volumeId,
				status: 'queued',
				progress: 0,
				createdAt: now + i
			});
		}

		processQueue();
	}

	async function cancelDownload(key: string, audioUrl?: string) {
		const download = downloads.find((item) => item.chapterId === key);
		const baseChapterId = download?.baseChapterId ?? key;
		const controller = activeDownloads.get(key);
		if (controller) {
			controller.abort();
			activeDownloads.delete(key);
		}

		delete progressMap[key];

		const targetAudioUrl =
			audioUrl ||
			download?.audioUrl ||
			chapters.find((c) => c.id === baseChapterId)?.audioUrl ||
			(await db.chapters.get(baseChapterId))?.audioUrl;

		if (targetAudioUrl) {
			try {
				const cache = await caches.open('audio-cache');
				await cache.delete(targetAudioUrl);
			} catch {
				// ignore
			}
		}

		try {
			const opfsRoot = await navigator.storage.getDirectory();
			await opfsRoot.removeEntry(storageFileName(key));
		} catch (e: unknown) {
			if (e instanceof Error && e.name !== 'NotFoundError') {
				log.warn('Failed to remove audio file from OPFS:', e);
			}
		}

		await db.downloads.delete(key);
		processQueue();
	}

	async function cancelVolumeQueue(volumeId: string) {
		const volumeChapterIds = chapters.filter((c) => c.volumeId === volumeId).map((c) => c.id);

		const toCancel = downloads.filter(
			(d) =>
				(d.status === 'queued' || d.status === 'downloading') &&
				(d.volumeId === volumeId || volumeChapterIds.includes(d.baseChapterId ?? d.chapterId))
		);

		for (const d of toCancel) {
			await cancelDownload(d.chapterId);
		}
	}

	async function cancelVolumeVersion(volumeId: string, versionId: string) {
		const toCancel = downloads.filter(
			(d) =>
				(d.volumeId === volumeId ||
					chapters.find((c) => c.id === (d.baseChapterId ?? d.chapterId))?.volumeId === volumeId) &&
				(d.versionId ?? 'default') === versionId &&
				(d.status === 'queued' || d.status === 'downloading')
		);
		for (const item of toCancel) await cancelDownload(item.chapterId);
	}

	async function cancelAllQueued() {
		const queuedItems = downloads.filter((d) => d.status === 'queued');
		for (const item of queuedItems) {
			await db.downloads.delete(item.chapterId);
		}
	}

	async function deleteDownload(chapterId: string, audioUrl?: string) {
		await cancelDownload(chapterId, audioUrl);
	}

	async function deleteVolume(volumeId: string) {
		const ids = downloads
			.filter(
				(d) =>
					d.volumeId === volumeId ||
					chapters.find((c) => c.id === (d.baseChapterId ?? d.chapterId))?.volumeId === volumeId
			)
			.map((d) => d.chapterId);
		for (const id of ids) await cancelDownload(id);
	}

	async function deleteVolumeVersion(volumeId: string, versionId: string) {
		const ids = downloads
			.filter(
				(d) =>
					(d.volumeId === volumeId ||
						chapters.find((c) => c.id === (d.baseChapterId ?? d.chapterId))?.volumeId ===
							volumeId) &&
					(d.versionId ?? 'default') === versionId
			)
			.map((d) => d.chapterId);
		for (const id of ids) await cancelDownload(id);
	}

	function isDownloaded(chapterId: string): boolean {
		return downloads.some((d) => d.chapterId === chapterId && d.status === 'downloaded');
	}

	function isDownloading(chapterId: string): boolean {
		return downloads.some((d) => d.chapterId === chapterId && d.status === 'downloading');
	}

	function isQueued(chapterId: string): boolean {
		return downloads.some((d) => d.chapterId === chapterId && d.status === 'queued');
	}

	function getProgress(chapterId: string): DownloadStats {
		if (progressMap[chapterId] !== undefined) {
			return progressMap[chapterId];
		}
		const download = downloads.find((d) => d.chapterId === chapterId);

		const isDone = download?.status === 'downloaded';
		return {
			percentage: download?.progress ?? (isDone ? 100 : 0),
			downloadedBytes: isDone ? (download?.totalBytes ?? 0) : 0,
			totalBytes: download?.totalBytes ?? 0
		};
	}

	return {
		get downloads() {
			return downloads;
		},
		get downloading() {
			return downloading;
		},
		get downloaded() {
			return downloaded;
		},
		get queued() {
			return queued;
		},
		get downloadingChapters() {
			return downloadingChapters;
		},
		get downloadedChapters() {
			return downloadedChapters;
		},
		get queuedChapters() {
			return queuedChapters;
		},
		get progressMap() {
			return progressMap;
		},
		enqueueDownload,
		enqueueVersionDownload,
		enqueueVolume,
		cancelDownload,
		deleteDownload,
		deleteVolume,
		deleteVolumeVersion,
		cancelVolumeQueue,
		cancelVolumeVersion,
		cancelAllQueued,
		isDownloaded,
		isDownloading,
		isQueued,
		getProgress
	};
}
