import {
	pgTable,
	integer,
	doublePrecision,
	text,
	boolean,
	primaryKey,
	timestamp,
	varchar,
	index,
	uniqueIndex,
	check
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from './auth.schema';

export const books = pgTable(
	'books',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		title: varchar('title', { length: 255 }).notNull(),
		description: text('description'),
		coverUrl: varchar('cover_url', { length: 1024 }),
		coverWidth: integer('cover_width'),
		coverHeight: integer('cover_height'),
		blurhash: varchar('blurhash', { length: 100 }),
		themeColor: varchar('theme_color', { length: 6 }),
		/** Optional background image for the home showcase, independent of the cover. */
		homeImageUrl: varchar('home_image_url', { length: 2048 }),
		/** Optional background video for the home showcase (R2 URL; legacy column name). */
		homeVideoUrl: varchar('video_url', { length: 2048 }),
		/** Manual order used on the home page and in the public catalog. */
		sortOrder: integer('sort_order').notNull().default(0),
		status: varchar('status', { length: 50 }).default('ongoing'),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		check(
			'books_status_check',
			sql`${t.status} is null or ${t.status} in ('ongoing','completed','hiatus','dropped')`
		),
		check(
			'books_theme_color_check',
			sql`${t.themeColor} is null or ${t.themeColor} ~ '^[0-9a-fA-F]{6}$'`
		)
	]
);

export const volumes = pgTable(
	'volumes',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		bookId: varchar('book_id', { length: 128 })
			.references(() => books.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		volumeNumber: integer('volume_number').notNull(),
		title: varchar('title', { length: 255 }).notNull(),
		description: text('description'),
		coverUrl: varchar('cover_url', { length: 1024 }),
		coverWidth: integer('cover_width'),
		coverHeight: integer('cover_height'),
		blurhash: varchar('blurhash', { length: 100 }),
		status: varchar('status', { length: 50 }).default('ongoing'),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		index('volumes_book_id_idx').on(t.bookId),
		uniqueIndex('volumes_book_number_unique').on(t.bookId, t.volumeNumber),
		check(
			'volumes_status_check',
			sql`${t.status} is null or ${t.status} in ('ongoing','completed','hiatus','dropped')`
		)
	]
);

export const chapters = pgTable(
	'chapters',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		volumeId: varchar('volume_id', { length: 128 })
			.references(() => volumes.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		chapterNumber: integer('chapter_number').notNull(),
		title: varchar('title', { length: 255 }).notNull(),
		audioUrl: varchar('audio_url', { length: 2048 }).notNull(),
		durationSeconds: doublePrecision('duration_seconds').notNull(),
		telegramPostUrl: varchar('telegram_post_url', { length: 1024 }),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		index('chapters_volume_id_idx').on(t.volumeId),
		uniqueIndex('chapters_volume_number_unique').on(t.volumeId, t.chapterNumber)
	]
);

export const audioVersions = pgTable('audio_versions', {
	id: varchar('id', { length: 64 }).primaryKey(),
	label: varchar('label', { length: 120 }).notNull(),
	description: text('description'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at').defaultNow()
});

export const chapterAudioVersions = pgTable(
	'chapter_audio_versions',
	{
		id: varchar('id', { length: 200 }).primaryKey(),
		chapterId: varchar('chapter_id', { length: 128 })
			.references(() => chapters.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		versionId: varchar('version_id', { length: 64 })
			.references(() => audioVersions.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		title: varchar('title', { length: 255 }).notNull(),
		audioUrl: varchar('audio_url', { length: 2048 }).notNull(),
		durationSeconds: doublePrecision('duration_seconds').notNull(),
		chapterStart: integer('chapter_start').notNull(),
		chapterEnd: integer('chapter_end').notNull(),
		createdAt: timestamp('created_at').defaultNow()
	},
	(t) => [
		index('chapter_audio_versions_chapter_id_idx').on(t.chapterId),
		index('chapter_audio_versions_version_id_idx').on(t.versionId),
		uniqueIndex('chapter_audio_versions_chapter_version_unique').on(t.chapterId, t.versionId)
	]
);

export const listeningProgress = pgTable(
	'listening_progress',
	{
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		chapterId: varchar('chapter_id', { length: 128 })
			.references(() => chapters.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		versionId: varchar('version_id', { length: 64 }).notNull().default('default'),
		progressSeconds: integer('progress_seconds').notNull().default(0),
		isCompleted: boolean('is_completed').default(false),
		updatedAt: timestamp('updated_at').defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.chapterId, t.versionId] }),
		index('progress_chapter_idx').on(t.chapterId),
		index('progress_version_idx').on(t.versionId)
	]
);

export const volumeLikes = pgTable(
	'volume_likes',
	{
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		volumeId: varchar('volume_id', { length: 128 })
			.references(() => volumes.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		createdAt: timestamp('created_at').defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.volumeId] }),
		index('volume_likes_volume_idx').on(t.volumeId)
	]
);

export const chapterLikes = pgTable(
	'chapter_likes',
	{
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		chapterId: varchar('chapter_id', { length: 128 })
			.references(() => chapters.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		versionId: varchar('version_id', { length: 64 }).notNull().default('default'),
		createdAt: timestamp('created_at').defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.chapterId, t.versionId] }),
		index('chapter_likes_chapter_idx').on(t.chapterId),
		index('chapter_likes_version_idx').on(t.versionId)
	]
);

export const bookmarks = pgTable(
	'bookmarks',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		chapterId: varchar('chapter_id', { length: 128 })
			.references(() => chapters.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		versionId: varchar('version_id', { length: 64 }).notNull().default('default'),
		timestampSeconds: integer('timestamp_seconds').notNull(),
		endTimestampSeconds: integer('end_timestamp_seconds'),
		note: varchar('note', { length: 500 }),
		createdAt: timestamp('created_at').defaultNow()
	},
	(t) => [
		index('bookmarks_user_idx').on(t.userId),
		index('bookmarks_chapter_idx').on(t.chapterId),
		index('bookmarks_version_idx').on(t.versionId)
	]
);

export const illustrations = pgTable(
	'illustrations',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		volumeId: varchar('volume_id', { length: 128 })
			.references(() => volumes.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		imageUrl: varchar('image_url', { length: 1024 }).notNull(),
		blurhash: varchar('blurhash', { length: 100 }),
		caption: varchar('caption', { length: 255 }),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [index('illustrations_volume_id_idx').on(t.volumeId)]
);

export const booksRelations = relations(books, ({ many }) => ({
	volumes: many(volumes)
}));

export const volumesRelations = relations(volumes, ({ one, many }) => ({
	book: one(books, {
		fields: [volumes.bookId],
		references: [books.id]
	}),
	chapters: many(chapters),
	illustrations: many(illustrations)
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
	volume: one(volumes, {
		fields: [chapters.volumeId],
		references: [volumes.id]
	}),
	audioVersions: many(chapterAudioVersions)
}));

export const audioVersionsRelations = relations(audioVersions, ({ many }) => ({
	chapterTracks: many(chapterAudioVersions)
}));

export const chapterAudioVersionsRelations = relations(chapterAudioVersions, ({ one }) => ({
	chapter: one(chapters, {
		fields: [chapterAudioVersions.chapterId],
		references: [chapters.id]
	}),
	version: one(audioVersions, {
		fields: [chapterAudioVersions.versionId],
		references: [audioVersions.id]
	})
}));

export const illustrationsRelations = relations(illustrations, ({ one }) => ({
	volume: one(volumes, {
		fields: [illustrations.volumeId],
		references: [volumes.id]
	})
}));

export const listeningSessions = pgTable(
	'listening_sessions',
	{
		id: varchar('id', { length: 36 })
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		bookId: varchar('book_id', { length: 128 }).references(() => books.id, { onDelete: 'cascade' }),
		volumeId: varchar('volume_id', { length: 128 }).references(() => volumes.id, {
			onDelete: 'cascade'
		}),
		chapterId: varchar('chapter_id', { length: 128 })
			.references(() => chapters.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		versionId: varchar('version_id', { length: 64 }).notNull().default('default'),
		listenedSeconds: integer('listened_seconds').notNull(),
		startedAt: timestamp('started_at').defaultNow().notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('listening_sessions_user_idx').on(table.userId),
		index('listening_sessions_chapter_idx').on(table.chapterId),
		index('listening_sessions_started_at_idx').on(table.startedAt)
	]
);

export const dailyListeningStats = pgTable(
	'daily_listening_stats',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		date: varchar('date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		bookId: varchar('book_id', { length: 128 }).references(() => books.id, { onDelete: 'cascade' }),
		chapterId: varchar('chapter_id', { length: 128 }).references(() => chapters.id, {
			onDelete: 'cascade'
		}),
		versionId: varchar('version_id', { length: 64 }).notNull().default('default'),
		totalSeconds: integer('total_seconds').notNull().default(0),
		sessionsCount: integer('sessions_count').notNull().default(1),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date())
	},
	(table) => [
		index('daily_stats_date_idx').on(table.date),
		index('daily_stats_book_idx').on(table.bookId),
		index('daily_stats_user_idx').on(table.userId),
		uniqueIndex('daily_stats_unique_entry').on(
			table.date,
			table.bookId,
			table.chapterId,
			table.versionId,
			table.userId
		),
		index('daily_stats_version_idx').on(table.versionId)
	]
);

export const listeningSessionsRelations = relations(listeningSessions, ({ one }) => ({
	user: one(user, {
		fields: [listeningSessions.userId],
		references: [user.id]
	}),
	book: one(books, {
		fields: [listeningSessions.bookId],
		references: [books.id]
	}),
	volume: one(volumes, {
		fields: [listeningSessions.volumeId],
		references: [volumes.id]
	}),
	chapter: one(chapters, {
		fields: [listeningSessions.chapterId],
		references: [chapters.id]
	})
}));

export const dailyListeningStatsRelations = relations(dailyListeningStats, ({ one }) => ({
	user: one(user, {
		fields: [dailyListeningStats.userId],
		references: [user.id]
	}),
	book: one(books, {
		fields: [dailyListeningStats.bookId],
		references: [books.id]
	}),
	chapter: one(chapters, {
		fields: [dailyListeningStats.chapterId],
		references: [chapters.id]
	})
}));

export * from './auth.schema';
