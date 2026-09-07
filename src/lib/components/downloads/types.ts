import type { OfflineChapter, OfflineDownload, OfflineVolume } from '$lib/client/db';

export interface DownloadGroupItem {
	download: OfflineDownload;
	chapter: OfflineChapter;
}

export interface DownloadGroup {
	volumeId: string;
	volume: OfflineVolume | undefined;
	items: DownloadGroupItem[];
}

export type DownloadGroupMode = 'active' | 'downloaded';
