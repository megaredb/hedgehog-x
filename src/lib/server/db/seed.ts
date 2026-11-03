import { db } from './index';
import { books, volumes, chapters, illustrations } from './schema';
import { createLogger } from '../../logger';

const log = createLogger('DB:Seed');

export interface SeedChapter {
	id: string;
	volumeId: string;
	chapterNumber: number;
	title: string;
	audioUrl: string;
	durationSeconds: number;
	telegramPostUrl?: string;
}

export interface SeedIllustration {
	id: string;
	volumeId: string;
	imageUrl: string;
	blurhash?: string;
	caption?: string;
	sortOrder: number;
}

export interface SeedVolume {
	id: string;
	bookId: string;
	volumeNumber: number;
	title: string;
	description?: string;
	coverUrl?: string;
	blurhash?: string;
	status: 'ongoing' | 'completed';
	chapters: SeedChapter[];
	illustrations: SeedIllustration[];
}

export interface SeedBook {
	id: string;
	title: string;
	description: string;
	coverUrl: string;
	blurhash: string;
	themeColor: string;
	status: 'ongoing' | 'completed';
	volumes: SeedVolume[];
}

export const DEFAULT_BOOKS: SeedBook[] = [
	{
		id: 'mushoku_tensei',
		title: 'Реинкарнация безработного',
		description:
			'История о приключениях в другом мире японского неудачника, переродившегося в младенца с сохранением воспоминаний о прошлой жизни.',
		coverUrl: '/img/mushoku_tensei.webp',
		blurhash: 'LgOekX?FD+rr~px@RQVt?bozaLxY',
		themeColor: 'f8d8b8',
		status: 'ongoing',
		volumes: [
			{
				id: 'mushoku_tensei_vol_1',
				bookId: 'mushoku_tensei',
				volumeNumber: 1,
				title: 'Том 1: Младенчество',
				description: 'Перерождение в новом мире магии и меча, первые шаги Рудеуса Грейрата.',
				coverUrl: '/img/mushoku_tensei.webp',
				blurhash: 'LgOekX?FD+rr~px@RQVt?bozaLxY',
				status: 'completed',
				chapters: [
					{
						id: 'mushoku_tensei_v1_c1',
						volumeId: 'mushoku_tensei_vol_1',
						chapterNumber: 1,
						title: 'Глава 1: Перерождение',
						audioUrl: '/audio/sample.mp3',
						durationSeconds: 1240,
						telegramPostUrl: 'https://t.me/Mushoku_Tensei_AudioBook/1'
					},
					{
						id: 'mushoku_tensei_v1_c2',
						volumeId: 'mushoku_tensei_vol_1',
						chapterNumber: 2,
						title: 'Глава 2: Домашний учитель',
						audioUrl: '/audio/sample.mp3',
						durationSeconds: 1380,
						telegramPostUrl: 'https://t.me/Mushoku_Tensei_AudioBook/2'
					},
					{
						id: 'mushoku_tensei_v1_c3',
						volumeId: 'mushoku_tensei_vol_1',
						chapterNumber: 3,
						title: 'Глава 3: Первая дуэль',
						audioUrl: '/audio/sample.mp3',
						durationSeconds: 1510,
						telegramPostUrl: 'https://t.me/Mushoku_Tensei_AudioBook/3'
					}
				],
				illustrations: [
					{
						id: 'mushoku_tensei_v1_ill_1',
						volumeId: 'mushoku_tensei_vol_1',
						imageUrl: '/img/mushoku_tensei.webp',
						blurhash: 'LgOekX?FD+rr~px@RQVt?bozaLxY',
						caption: 'Цветная иллюстрация: Рудеус и семья Грейрат',
						sortOrder: 1
					}
				]
			},
			{
				id: 'mushoku_tensei_vol_2',
				bookId: 'mushoku_tensei',
				volumeNumber: 2,
				title: 'Том 2: Детство — домашний учитель',
				description: 'Обучение юной Эрис Бореас Грейрат в городе Роа.',
				coverUrl: '/img/mushoku_tensei.webp',
				blurhash: 'LgOekX?FD+rr~px@RQVt?bozaLxY',
				status: 'ongoing',
				chapters: [
					{
						id: 'mushoku_tensei_v2_c1',
						volumeId: 'mushoku_tensei_vol_2',
						chapterNumber: 1,
						title: 'Глава 1: Знакомство с госпожой',
						audioUrl: '/audio/sample.mp3',
						durationSeconds: 1420,
						telegramPostUrl: 'https://t.me/Mushoku_Tensei_AudioBook/4'
					},
					{
						id: 'mushoku_tensei_v2_c2',
						volumeId: 'mushoku_tensei_vol_2',
						chapterNumber: 2,
						title: 'Глава 2: Похищение',
						audioUrl: '/audio/sample.mp3',
						durationSeconds: 1640,
						telegramPostUrl: 'https://t.me/Mushoku_Tensei_AudioBook/5'
					}
				],
				illustrations: [
					{
						id: 'mushoku_tensei_v2_ill_1',
						volumeId: 'mushoku_tensei_vol_2',
						imageUrl: '/img/mushoku_tensei.webp',
						blurhash: 'LgOekX?FD+rr~px@RQVt?bozaLxY',
						caption: 'Эрис Бореас Грейрат',
						sortOrder: 1
					}
				]
			}
		]
	},
	{
		id: 'overlord',
		title: 'Повелитель',
		description: 'История могущественного владыки Айнза Оал Гоуна в новом неизвестном мире.',
		coverUrl: '/img/overlord.webp',
		blurhash: 'LA8gW}D%R%M{~WD%ozNHX9IU%2S4',
		themeColor: '080808',
		status: 'ongoing',
		volumes: [
			{
				id: 'overlord_vol_1',
				bookId: 'overlord',
				volumeNumber: 1,
				title: 'Том 1: Король-нежить',
				description:
					'Великая Гробница Назарик перемещается в неизвестный мир после закрытия DMMO-RPG Иггдрасиль.',
				coverUrl: '/img/overlord.webp',
				blurhash: 'LA8gW}D%R%M{~WD%ozNHX9IU%2S4',
				status: 'completed',
				chapters: [
					{
						id: 'overlord_v1_c1',
						volumeId: 'overlord_vol_1',
						chapterNumber: 1,
						title: 'Глава 1: Конец и начало',
						audioUrl: '/audio/sample.mp3',
						durationSeconds: 1620,
						telegramPostUrl: 'https://t.me/hedgehogincoverlord/1'
					},
					{
						id: 'overlord_v1_c2',
						volumeId: 'overlord_vol_1',
						chapterNumber: 2,
						title: 'Глава 2: Стражи этажей',
						audioUrl: '/audio/sample.mp3',
						durationSeconds: 1750,
						telegramPostUrl: 'https://t.me/hedgehogincoverlord/2'
					},
					{
						id: 'overlord_v1_c3',
						volumeId: 'overlord_vol_1',
						chapterNumber: 3,
						title: 'Глава 3: Битва за деревню Карн',
						audioUrl: '/audio/sample.mp3',
						durationSeconds: 1890,
						telegramPostUrl: 'https://t.me/hedgehogincoverlord/3'
					}
				],
				illustrations: [
					{
						id: 'overlord_v1_ill_1',
						volumeId: 'overlord_vol_1',
						imageUrl: '/img/overlord.webp',
						blurhash: 'LA8gW}D%R%M{~WD%ozNHX9IU%2S4',
						caption: 'Айнз Оал Гоун и стражи Назарика',
						sortOrder: 1
					}
				]
			},
			{
				id: 'overlord_vol_2',
				bookId: 'overlord',
				volumeNumber: 2,
				title: 'Том 2: Тёмный воин',
				description: 'Айнз Оал Гоун принимает облик воина-авантюриста Момона.',
				coverUrl: '/img/overlord.webp',
				blurhash: 'LA8gW}D%R%M{~WD%ozNHX9IU%2S4',
				status: 'ongoing',
				chapters: [
					{
						id: 'overlord_v2_c1',
						volumeId: 'overlord_vol_2',
						chapterNumber: 1,
						title: 'Глава 1: Два искателя приключений',
						audioUrl: '/audio/sample.mp3',
						durationSeconds: 1590,
						telegramPostUrl: 'https://t.me/hedgehogincoverlord/4'
					},
					{
						id: 'overlord_v2_c2',
						volumeId: 'overlord_vol_2',
						chapterNumber: 2,
						title: 'Глава 2: Путешествие',
						audioUrl: '/audio/sample.mp3',
						durationSeconds: 1710,
						telegramPostUrl: 'https://t.me/hedgehogincoverlord/5'
					}
				],
				illustrations: [
					{
						id: 'overlord_v2_ill_1',
						volumeId: 'overlord_vol_2',
						imageUrl: '/img/overlord.webp',
						blurhash: 'LA8gW}D%R%M{~WD%ozNHX9IU%2S4',
						caption: 'Момон и Набе',
						sortOrder: 1
					}
				]
			}
		]
	}
];

let isSeeding = false;
let seedPromise: Promise<void> | null = null;

/**
 * Idempotently seeds default books, volumes, chapters, and illustrations into the database.
 * Uses onConflictDoNothing to avoid overwriting user edits or duplicate key errors.
 */
export async function ensureDefaultBooks(database: typeof db = db): Promise<void> {
	if (isSeeding) return seedPromise ?? Promise.resolve();

	isSeeding = true;
	seedPromise = (async () => {
		try {
			log.info('Checking default books initialization (mushoku_tensei, overlord)...');

			for (const book of DEFAULT_BOOKS) {
				await database
					.insert(books)
					.values({
						id: book.id,
						title: book.title,
						description: book.description,
						coverUrl: book.coverUrl,
						blurhash: book.blurhash,
						themeColor: book.themeColor,
						status: book.status
					})
					.onConflictDoNothing({ target: books.id });

				for (const volume of book.volumes) {
					await database
						.insert(volumes)
						.values({
							id: volume.id,
							bookId: volume.bookId,
							volumeNumber: volume.volumeNumber,
							title: volume.title,
							description: volume.description,
							coverUrl: volume.coverUrl,
							blurhash: volume.blurhash,
							status: volume.status
						})
						.onConflictDoNothing({ target: volumes.id });

					for (const chapter of volume.chapters) {
						await database
							.insert(chapters)
							.values({
								id: chapter.id,
								volumeId: chapter.volumeId,
								chapterNumber: chapter.chapterNumber,
								title: chapter.title,
								audioUrl: chapter.audioUrl,
								durationSeconds: chapter.durationSeconds,
								telegramPostUrl: chapter.telegramPostUrl
							})
							.onConflictDoNothing({ target: chapters.id });
					}

					for (const illustration of volume.illustrations) {
						await database
							.insert(illustrations)
							.values({
								id: illustration.id,
								volumeId: illustration.volumeId,
								imageUrl: illustration.imageUrl,
								blurhash: illustration.blurhash,
								caption: illustration.caption,
								sortOrder: illustration.sortOrder
							})
							.onConflictDoNothing({ target: illustrations.id });
					}
				}
			}

			log.info('Default books initialization finished successfully.');
		} catch (error) {
			log.error('Failed to initialize default books:', error);
			seedPromise = null;
			isSeeding = false;
			throw error;
		}
	})();

	return seedPromise;
}

// Allow direct execution via: node --import tsx src/lib/server/db/seed.ts
if (process.argv[1]?.endsWith('seed.ts')) {
	ensureDefaultBooks()
		.then(() => {
			console.log('Seed completed successfully.');
			process.exit(0);
		})
		.catch((err) => {
			console.error('Seed failed:', err);
			process.exit(1);
		});
}
