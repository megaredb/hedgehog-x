import Dexie, { type EntityTable } from 'dexie';

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

const db = new Dexie('HedgehogDB') as Dexie & {
	books: EntityTable<OfflineBook, 'id'>;
	volumes: EntityTable<OfflineVolume, 'id'>;
	chapters: EntityTable<OfflineChapter, 'id'>;
	illustrations: EntityTable<OfflineIllustration, 'id'>;

	progress: EntityTable<OfflineProgress, 'chapterId'>;
	volumeLikes: EntityTable<OfflineVolumeLike, 'volumeId'>;
	chapterLikes: EntityTable<OfflineChapterLike, 'chapterId'>;
	bookmarks: EntityTable<OfflineBookmark, 'id'>;

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

	syncQueue: '++id, action, timestamp'
});

export { db };
