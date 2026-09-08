import Dexie, { type EntityTable } from 'dexie';
import { HEDGEHOG_DB_NAME } from '$lib/constants';

export interface OfflineBook {
	id: string;
	title: string;
	description?: string | null;
	coverUrl: string;
	blurhash?: string | null;
	themeColor?: string | null;
	status: string;
}
export interface OfflineVolume {
	id: string;
	bookId: string;
	volumeNumber: number;
	title: string;
	description?: string | null;
	coverUrl: string;
	blurhash?: string | null;
	likesCount: number;
}
export interface OfflineChapter {
	id: string;
	volumeId: string;
	chapterNumber: number;
	title: string;
	audioUrl: string;
	durationSeconds: number;
	telegramPostUrl?: string | null;
	likesCount: number;
}
export interface OfflineIllustration {
	id: string;
	volumeId: string;
	imageUrl: string;
	blurhash?: string | null;
	caption?: string | null;
	sortOrder: number;
}

export interface OfflineProgress {
	chapterId: string;
	progressSeconds: number;
	isCompleted: boolean;
	updatedAt: number;
}
export interface OfflineVolumeLike {
	volumeId: string;
	createdAt: number;
}
export interface OfflineChapterLike {
	chapterId: string;
	createdAt: number;
}
export interface OfflineBookmark {
	id: string;
	chapterId: string;
	timestampSeconds: number;
	note: string;
	createdAt: number;
}

export interface SyncItem {
	id?: number;
	action:
		| 'UPDATE_PROGRESS'
		| 'LIKE_VOLUME'
		| 'UNLIKE_VOLUME'
		| 'LIKE_CHAPTER'
		| 'UNLIKE_CHAPTER'
		| 'ADD_BOOKMARK'
		| 'REMOVE_BOOKMARK';
	payload: unknown;
	timestamp: number;
}

export interface OfflineDownload {
	chapterId: string;
	status: 'queued' | 'downloading' | 'downloaded' | 'error';
	progress?: number;
	totalBytes?: number;
	error?: string;
	createdAt?: number;
}

const db = new Dexie(HEDGEHOG_DB_NAME) as Dexie & {
	books: EntityTable<OfflineBook, 'id'>;
	volumes: EntityTable<OfflineVolume, 'id'>;
	chapters: EntityTable<OfflineChapter, 'id'>;
	illustrations: EntityTable<OfflineIllustration, 'id'>;

	progress: EntityTable<OfflineProgress, 'chapterId'>;
	volumeLikes: EntityTable<OfflineVolumeLike, 'volumeId'>;
	chapterLikes: EntityTable<OfflineChapterLike, 'chapterId'>;
	bookmarks: EntityTable<OfflineBookmark, 'id'>;

	downloads: EntityTable<OfflineDownload, 'chapterId'>;

	syncQueue: EntityTable<SyncItem, 'id'>;
};

db.version(1).stores({
	books: 'id',
	volumes: 'id, bookId',
	chapters: 'id, volumeId',
	illustrations: 'id, volumeId',

	progress: 'chapterId',
	volumeLikes: 'volumeId',
	chapterLikes: 'chapterId',
	bookmarks: 'id, chapterId',

	downloads: 'chapterId, status',

	syncQueue: '++id, action, timestamp'
});

export { db };
