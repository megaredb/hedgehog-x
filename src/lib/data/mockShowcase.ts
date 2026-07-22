export interface ShowcaseBook {
	id: string;
	title: string;
	description: string;
	bgImage: string;
	bgVideo: string;
}

export const showcaseBooks: ShowcaseBook[] = [
	{
		id: 'mushoku_tensei',
		title: 'Реинкарнация безработного',
		description:
			'История о приключениях в другом мире японского неудачника, переродившегося в младенца с сохранением воспоминаний о прошлой жизни.',
		bgImage: '/img/mushoku_tensei.webp',
		bgVideo: '/video/mushoku_tensei.webm'
	},
	{
		id: 'overlord',
		title: 'Повелитель',
		description: 'История могущественного владыки Айнза Оал Гоуна в новом неизвестном мире.',
		bgImage: '/img/overlord.webp',
		bgVideo: '/video/overlord.webm'
	}
];
