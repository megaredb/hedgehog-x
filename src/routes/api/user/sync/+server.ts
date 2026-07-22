import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { chapterLikes, volumeLikes, listeningProgress, bookmarks } from '$lib/server/db/schema';

export const GET = async ({ locals }) => {
	// Проверяем авторизацию
	const user = locals.user;
	if (!user) {
		// Если юзер не залогинен, возвращаем пустые массивы
		return json({
			chapterLikes: [],
			volumeLikes: [],
			listeningProgress: [],
			bookmarks: []
		});
	}

	// Делаем 4 параллельных запроса для получения личных данных
	const [userChapterLikes, userVolumeLikes, userProgress, userBookmarks] = await Promise.all([
		db.select().from(chapterLikes).where(eq(chapterLikes.userId, user.id)),
		db.select().from(volumeLikes).where(eq(volumeLikes.userId, user.id)),
		db.select().from(listeningProgress).where(eq(listeningProgress.userId, user.id)),
		db.select().from(bookmarks).where(eq(bookmarks.userId, user.id))
	]);

	// Отправляем на клиент
	return json({
		chapterLikes: userChapterLikes.map((l) => ({
			chapterId: l.chapterId,
			createdAt: l.createdAt?.getTime() || 0
		})),
		volumeLikes: userVolumeLikes.map((l) => ({
			volumeId: l.volumeId,
			createdAt: l.createdAt?.getTime() || 0
		})),
		listeningProgress: userProgress.map((p) => ({
			chapterId: p.chapterId,
			progressSeconds: p.progressSeconds,
			isCompleted: p.isCompleted || false,
			updatedAt: p.updatedAt?.getTime() || 0
		})),
		bookmarks: userBookmarks.map((b) => ({
			id: b.id,
			chapterId: b.chapterId,
			timestampSeconds: b.timestampSeconds,
			note: b.note || '',
			createdAt: b.createdAt?.getTime() || 0
		}))
	});
};
