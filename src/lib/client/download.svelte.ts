import { localDb } from '$lib/client/db';
import { browser } from '$app/environment';

interface DownloadProgress {
	progress: number; // 0 to 100
	title: string;
}

class DownloadManager {
	// Reactive state using Svelte 5 Runes
	activeDownloads = $state<Record<string, DownloadProgress>>({});

	constructor() {
		// Clean up any stale "downloading" records on startup
		if (typeof window !== 'undefined') {
			this.cleanupStaleDownloads();
		}
	}

	private async cleanupStaleDownloads() {
		try {
			await localDb.offlineChapters.where('status').equals('downloading').modify({
				status: 'failed'
			});
		} catch (error) {
			console.error('Failed to clean up stale downloads:', error);
		}
	}

	async downloadChapter(
		chapter: { id: string; title: string; audioUrl: string; durationSeconds: number },
		bookId: string
	) {
		const cacheName = 'audio-cache';
		const chapterId = chapter.id;

		// Check if already downloading or completed
		if (this.activeDownloads[chapterId]) return;
		const existing = await localDb.offlineChapters.get(chapterId);
		if (existing && existing.status === 'completed') return;

		try {
			// Initialize progress
			this.activeDownloads[chapterId] = { progress: 0, title: chapter.title };

			// Save initial state to Dexie
			await localDb.offlineChapters.put({
				chapterId,
				bookId,
				filePath: chapter.audioUrl,
				size: 0,
				status: 'downloading',
				downloadedAt: Date.now()
			});

			let response: Response;
			try {
				response = await fetch(chapter.audioUrl);
			} catch {
				// Fallback: If CDN cached a non-CORS response (e.g. from an <audio> tag request),
				// fetch throws a TypeError. We retry with a cache-buster to bypass CDN cache
				// and hit R2 directly, which will return the correct CORS headers.
				const separator = chapter.audioUrl.includes('?') ? '&' : '?';
				response = await fetch(chapter.audioUrl + separator + 'nocache=' + Date.now());
			}

			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

			const contentLength = response.headers.get('content-length');
			const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

			const reader = response.body?.getReader();
			if (!reader) throw new Error('ReadableStream not supported');

			const chunks: Uint8Array[] = [];
			let receivedBytes = 0;

			// Read stream to calculate progress
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				if (value) {
					chunks.push(value);
					receivedBytes += value.length;

					if (totalBytes > 0) {
						const percent = Math.round((receivedBytes / totalBytes) * 100);
						this.activeDownloads[chapterId] = {
							progress: percent,
							title: chapter.title
						};
					} else {
						// Fallback for missing Content-Length (streaming/chunked)
						// Guess a total of 15MB to provide *some* feedback
						const fakeProgress = Math.min(
							99,
							Math.round((receivedBytes / (15 * 1024 * 1024)) * 100)
						);
						this.activeDownloads[chapterId] = {
							progress: fakeProgress,
							title: chapter.title
						};
					}
				}
			}

			// Concatenate chunks to create a new Response
			const audioBlob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
			const cacheResponse = new Response(audioBlob, {
				headers: {
					'Content-Type': 'audio/mpeg',
					'Content-Length': audioBlob.size.toString(),
					'Accept-Ranges': 'bytes'
				}
			});

			// Store in Cache API
			const cache = await caches.open(cacheName);
			await cache.put(chapter.audioUrl, cacheResponse);

			// Update status in Dexie
			await localDb.offlineChapters.update(chapterId, {
				status: 'completed',
				size: audioBlob.size
			});
		} catch (error) {
			console.error(`Failed to download chapter ${chapterId}:`, error);
			await localDb.offlineChapters.update(chapterId, {
				status: 'failed'
			});
		} finally {
			// Remove from active downloads
			const updated = { ...this.activeDownloads };
			delete updated[chapterId];
			this.activeDownloads = updated;
		}
	}

	async deleteChapter(chapterId: string, audioUrl: string) {
		try {
			const cacheName = 'audio-cache';
			const cache = await caches.open(cacheName);
			await cache.delete(audioUrl);

			await localDb.offlineChapters.delete(chapterId);
		} catch (error) {
			console.error(`Failed to delete cached chapter ${chapterId}:`, error);
		}
	}
}

export const downloadManager = browser
	? new DownloadManager()
	: (new Proxy(
			{},
			{
				get: (_, prop) => {
					if (prop === 'activeDownloads') return {};
					return () => {};
				}
			}
		) as unknown as DownloadManager);
