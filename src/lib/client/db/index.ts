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
	status?: string | null;
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

export interface OfflineMeta {
	key: string;
	userId: string | null;
	updatedAt: number;
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
		| 'REMOVE_BOOKMARK'
		| 'LISTEN_SESSION';
	payload: unknown;
	timestamp: number;
	/** Owner of the mutation. null/undefined = guest; never send under another account. */
	ownerUserId?: string | null;
}

export interface OfflineDownload {
	chapterId: string;
	status: 'queued' | 'downloading' | 'downloaded' | 'error';
	progress?: number;
	totalBytes?: number;
	error?: string;
	createdAt?: number;
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
	meta: EntityTable<OfflineMeta, 'key'>;

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

// v2: local sync ownership. Existing v1 data is preserved; the owner is
// inferred lazily from the cached auth session by syncState.getSyncOwner().
db.version(2).stores({
	meta: 'key'
});

// v3: every mutation records its owner. Legacy rows have no owner and are
// treated as guest data, never as the next logged-in account.
db.version(3).stores({
	syncQueue: '++id, action, timestamp, ownerUserId'
});

export { db };
