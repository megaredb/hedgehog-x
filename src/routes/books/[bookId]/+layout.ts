import { browser } from '$app/environment';
import { syncService } from '$lib/client/services/syncService';
import { createLogger } from '$lib/logger';
import type { LayoutLoad } from './$types';

const log = createLogger('Sync');

export const load: LayoutLoad = async ({ params, fetch }) => {
	const { bookId } = params;

	// Этот лоадер выполняется ПЕРЕД рендером любой страницы внутри /books/[bookId]/*
	// Включая саму страницу книги, страницу тома или плеера.

	if (browser) {
		// Фоновая синхронизация всей структуры книги (тома + главы) в Dexie.
		// Запрашиваем с сервера, работает ETag, гидратируется Dexie.
		// Мы не ставим `await`, чтобы не блокировать мгновенный рендер
		// страницы данными из локального Dexie кэша.
		syncService
			.syncBookDetails(bookId, fetch)
			.catch((err) => log.error('Не удалось синхронизировать данные книги:', err));

		// Параллельно стягиваем приватные данные юзера (лайки, прогресс)
		// Эндпоинт сам поймет, если юзер не залогинен, и ничего не вернет.
		syncService
			.syncUserData(fetch)
			.catch((err) => log.error('Не удалось синхронизировать данные пользователя:', err));
	}

	// Отдаем bookId вниз, чтобы страницы знали, что они рендерят
	return {
		bookId
	};
};
