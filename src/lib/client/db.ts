import Dexie, { type Table } from 'dexie';
import { browser } from '$app/environment';

export interface ListeningProgress {
	id?: number;
	bookId: string;
	volumeId: string;
	chapterId: string;
	currentTime: number;
	duration: number;
	updatedAt: number;
}

export interface OfflineChapter {
	chapterId: string;
	bookId: string;
	filePath: string; // Blob URL or cache storage key
	size: number;
	status: 'downloading' | 'completed' | 'failed';
	downloadedAt: number;
}

export interface BookCache {
	bookId: string;
	title: string;
	author: string;
	coverUrl: string | null;
	summary: string | null;
	volumeCount: number;
	updatedAt: number;
}

class HedgehogDatabase extends Dexie {
	progress!: Table<ListeningProgress>;
	offlineChapters!: Table<OfflineChapter>;
	books!: Table<BookCache>;

	constructor() {
		super('HedgehogDatabase');
		this.version(1).stores({
			progress: '++id, [bookId+volumeId+chapterId], updatedAt',
			offlineChapters: 'chapterId, bookId, status',
			books: 'bookId, updatedAt'
		});
	}
}

export const localDb = browser
	? new HedgehogDatabase()
	: (undefined as unknown as HedgehogDatabase);
