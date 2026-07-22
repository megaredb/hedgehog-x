import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	// Мы просто прокидываем параметры из URL в $props() компонента.
	// Вся реальная загрузка данных УЖЕ произошла в +layout.ts на уровень выше!
	return {
		bookId: params.bookId,
		volumeId: params.volumeId
	};
};
