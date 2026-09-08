import { browser } from '$app/environment';
import { syncService } from '$lib/client/services/syncService';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ params, fetch }) => {
	const { bookId } = params;

	// Этот лоадер выполняется ПЕРЕД рендером любой страницы внутри /books/[bookId]/*
	// Включая саму страницу книги, страницу тома или плеера.

	if (browser) {
		// Фоновая синхронизация всей структуры книги (тома + главы) в Dexie.
		// Запрашиваем с сервера, работает ETag, гидратируется Dexie.
		// Мы не ставим `await`, чтобы не блокировать мгновенный рендер
		// страницы данными из локального Dexie кэша.
		syncService.syncBookDetails(bookId, fetch).catch(console.error);

		// Приватные данные юзера (лайки, прогресс, закладки) синхронизируем ТОЛЬКО
		// для авторизованного пользователя: для анонима /api/user/sync возвращает
		// пустые массивы, и hydrate(..., 'all') стёр бы локальный прогресс.
		import('$lib/client/authClient')
			.then(({ authClient }) => authClient.getSession())
			.then(({ data }) => {
				if (data?.user) {
					return syncService.syncUserData(fetch);
				}
			})
			.catch(console.error);
	}

	// Отдаем bookId вниз, чтобы страницы знали, что они рендерят
	return {
		bookId
	};
};
