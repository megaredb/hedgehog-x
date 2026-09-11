import { db, type OfflineChapter, type OfflineDownload } from '$lib/client/db';
import { liveQuery } from 'dexie';
import { SvelteMap } from 'svelte/reactivity';
import { createLogger } from '$lib/logger';

const log = createLogger('Downloads');

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
			log.error('Ошибка подписки liveQuery для загрузок:', err);
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
	const chapterToDownload = chapters.find((c) => c.id === nextDownload.chapterId);

	if (!chapterToDownload) {
		await db.downloads.delete(nextDownload.chapterId);
		processQueue();
		return;
	}

	processingQueue = true;
	try {
		await performDownload(chapterToDownload);
	} finally {
		processingQueue = false;
		processQueue();
	}
}

async function performDownload(chapter: OfflineChapter) {
	if (activeDownloads.has(chapter.id)) return;

	const controller = new AbortController();
	activeDownloads.set(chapter.id, controller);

	progressMap[chapter.id] = { percentage: 0, downloadedBytes: 0, totalBytes: 0 };

	try {
		await db.downloads.put({
			chapterId: chapter.id,
			status: 'downloading',
			progress: 0,
			createdAt: Date.now()
		});

		const fetchUrl = new URL(chapter.audioUrl);
		fetchUrl.searchParams.set('_cors', '1');
		const response = await fetch(fetchUrl.toString(), { signal: controller.signal });
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const contentLength = response.headers.get('content-length');
		const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

		if (navigator.storage && navigator.storage.estimate && totalBytes > 0) {
			const estimate = await navigator.storage.estimate();
			if (estimate.quota && estimate.usage) {
				const availableBytes = estimate.quota - estimate.usage;
				if (availableBytes < totalBytes + 50 * 1024 * 1024) {
					throw new Error('Not enough storage space on device.');
				}
			}
		}

		const reader = response.body?.getReader();
		let receivedBytes = 0;

		if (!reader) throw new Error('Stream reading not supported');

		// Удаляем из старого кэша, если вдруг он там застрял
		try {
			const cache = await caches.open('audio-cache');
			await cache.delete(chapter.audioUrl);
		} catch {
			// ignore
		}

		const opfsRoot = await navigator.storage.getDirectory();
		const fileHandle = await opfsRoot.getFileHandle(chapter.id, { create: true });
		const writable = await fileHandle.createWritable();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				receivedBytes += value.length;
				const pct = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;

				progressMap[chapter.id] = { percentage: pct, downloadedBytes: receivedBytes, totalBytes };
				await writable.write(value);
			}
			await writable.close();
		} catch (e) {
			await writable.abort();
			reader.cancel();
			throw e;
		}

		await db.downloads.put({
			chapterId: chapter.id,
			status: 'downloaded',
			progress: 100,
			totalBytes,
			createdAt: Date.now()
		});

		progressMap[chapter.id] = { percentage: 100, downloadedBytes: totalBytes, totalBytes };
	} catch (err: unknown) {
		if (err instanceof Error && err.name === 'AbortError') {
			log.debug(`Загрузка главы ${chapter.id} отменена`);
		} else {
			log.error(`Ошибка загрузки главы ${chapter.id}:`, err);
			await db.downloads.put({
				chapterId: chapter.id,
				status: 'error',
				error: err instanceof Error ? err.message : String(err),
				createdAt: Date.now()
			});
		}
	} finally {
		activeDownloads.delete(chapter.id);
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
				const ch = chapters.find((c) => c.id === d.chapterId);
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
				const ch = chapters.find((c) => c.id === d.chapterId);
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
				const ch = chapters.find((c) => c.id === d.chapterId);
				return { download: d, chapter: ch };
			})
			.filter(
				(item): item is { download: OfflineDownload; chapter: OfflineChapter } =>
					item.chapter !== undefined
			)
	);

	async function enqueueDownload(chapter: OfflineChapter) {
		const rawChapter = $state.snapshot(chapter);
		await db.chapters.put(rawChapter);

		await db.downloads.put({
			chapterId: chapter.id,
			status: 'queued',
			progress: 0,
			createdAt: Date.now()
		});

		processQueue();
	}

	async function enqueueVolume(volumeId: string, volumeChapters: OfflineChapter[]) {
		const now = Date.now();
		const toEnqueue = volumeChapters.filter((ch) => !isDownloaded(ch.id));

		for (let i = 0; i < toEnqueue.length; i++) {
			const chapter = toEnqueue[i];
			await db.chapters.put($state.snapshot(chapter));
			await db.downloads.put({
				chapterId: chapter.id,
				status: 'queued',
				progress: 0,
				createdAt: now + i
			});
		}

		processQueue();
	}

	async function cancelDownload(chapterId: string, audioUrl?: string) {
		const controller = activeDownloads.get(chapterId);
		if (controller) {
			controller.abort();
			activeDownloads.delete(chapterId);
		}

		delete progressMap[chapterId];

		const targetAudioUrl =
			audioUrl ||
			chapters.find((c) => c.id === chapterId)?.audioUrl ||
			(await db.chapters.get(chapterId))?.audioUrl;

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
			await opfsRoot.removeEntry(chapterId);
		} catch (e) {
			log.error('Ошибка при удалении отменённого аудио из OPFS:', e);
		}

		await db.downloads.delete(chapterId);
		processQueue();
	}

	async function cancelVolumeQueue(volumeId: string) {
		const volumeChapterIds = chapters.filter((c) => c.volumeId === volumeId).map((c) => c.id);

		const toCancel = downloads.filter(
			(d) =>
				(d.status === 'queued' || d.status === 'downloading') &&
				volumeChapterIds.includes(d.chapterId)
		);

		for (const d of toCancel) {
			await cancelDownload(d.chapterId);
		}
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
		enqueueVolume,
		cancelDownload,
		deleteDownload,
		cancelVolumeQueue,
		cancelAllQueued,
		isDownloaded,
		isDownloading,
		isQueued,
		getProgress
	};
}
