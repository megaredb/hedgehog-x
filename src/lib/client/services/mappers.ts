import type { OfflineBook, OfflineVolume, OfflineChapter } from '$lib/client/db';

type ServerBook = typeof import('$lib/server/db/schema').books.$inferSelect;
type ServerVolume = typeof import('$lib/server/db/schema').volumes.$inferSelect;
type ServerChapter = typeof import('$lib/server/db/schema').chapters.$inferSelect;

export function mapServerBookToOfflineBook(serverBook: ServerBook): OfflineBook {
	return {
		id: serverBook.id,
		title: serverBook.title,
		description: serverBook.description,
		coverUrl: serverBook.coverUrl || '',
		blurhash: serverBook.blurhash,
		themeColor: serverBook.themeColor,
		status: serverBook.status || 'ongoing'
	};
}

// Добавляем опциональное поле likesCount, так как Drizzle вернет его через extras или агрегацию
export function mapServerVolumeToOfflineVolume(
	serverVolume: ServerVolume & { likesCount?: number }
): OfflineVolume {
	return {
		id: serverVolume.id,
		bookId: serverVolume.bookId,
		volumeNumber: serverVolume.volumeNumber,
		title: serverVolume.title,
		description: serverVolume.description,
		coverUrl: serverVolume.coverUrl || '',
		blurhash: serverVolume.blurhash,
		likesCount: serverVolume.likesCount || 0
	};
}

export function mapServerChapterToOfflineChapter(
	serverChapter: ServerChapter & { likesCount?: number }
): OfflineChapter {
	return {
		id: serverChapter.id,
		volumeId: serverChapter.volumeId,
		chapterNumber: serverChapter.chapterNumber,
		title: serverChapter.title,
		audioUrl: serverChapter.audioUrl,
		durationSeconds: serverChapter.durationSeconds,
		telegramPostUrl: serverChapter.telegramPostUrl,
		likesCount: serverChapter.likesCount || 0
	};
}

type ServerIllustration = typeof import('$lib/server/db/schema').illustrations.$inferSelect;

export function mapServerIllustrationToOfflineIllustration(
	serverIllustration: ServerIllustration
): import('$lib/client/db').OfflineIllustration {
	return {
		id: serverIllustration.id,
		volumeId: serverIllustration.volumeId,
		imageUrl: serverIllustration.imageUrl,
		blurhash: serverIllustration.blurhash,
		caption: serverIllustration.caption,
		sortOrder: serverIllustration.sortOrder
	};
}
