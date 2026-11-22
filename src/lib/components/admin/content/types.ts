export type ContentStatus = 'ongoing' | 'completed' | 'hiatus' | 'dropped';
export type ContentTab = 'chapters' | 'illustrations' | 'volume';
export type ContentIntent = 'book' | 'volume' | 'chapter' | 'illustration';

export interface AdminBook {
	id: string;
	title: string;
	description: string | null;
	coverUrl: string | null;
	coverWidth: number | null;
	coverHeight: number | null;
	blurhash: string | null;
	themeColor: string | null;
	status: string | null;
	createdAt: Date | string | null;
	updatedAt: Date | string | null;
	volumeCount: number;
}

export interface AdminVolume {
	id: string;
	bookId: string;
	bookTitle: string;
	volumeNumber: number;
	title: string;
	description: string | null;
	coverUrl: string | null;
	coverWidth: number | null;
	coverHeight: number | null;
	blurhash: string | null;
	status: string | null;
	createdAt: Date | string | null;
	updatedAt: Date | string | null;
	chapterCount: number;
	illustrationCount: number;
	archiveCount: number;
}

export interface AdminChapter {
	id: string;
	volumeId: string;
	chapterNumber: number;
	title: string;
	audioUrl: string;
	durationSeconds: number;
	telegramPostUrl: string | null;
	createdAt: Date | string | null;
	updatedAt: Date | string | null;
}

export interface AdminArchiveTrack {
	id: string;
	chapterId: string;
	versionId: string;
	title: string;
	audioUrl: string;
	durationSeconds: number;
	chapterStart: number;
	chapterEnd: number;
	createdAt: Date | string | null;
	chapterNumber: number;
	chapterTitle: string;
	chapterAudioUrl: string;
}

export interface AdminIllustration {
	id: string;
	volumeId: string;
	imageUrl: string;
	blurhash: string | null;
	caption: string | null;
	sortOrder: number;
	createdAt: Date | string | null;
	updatedAt: Date | string | null;
}

export interface AdminAudioVersion {
	id: string;
	label: string;
	description: string | null;
	sortOrder: number;
}
