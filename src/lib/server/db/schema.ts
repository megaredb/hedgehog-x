import {
	pgTable,
	integer,
	text,
	boolean,
	primaryKey,
	timestamp,
	varchar,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth.schema';

export const books = pgTable('books', {
	id: varchar('id', { length: 128 }).primaryKey(),
	title: varchar('title', { length: 255 }).notNull(),
	description: text('description'),
	coverUrl: varchar('cover_url', { length: 1024 }),
	blurhash: varchar('blurhash', { length: 100 }),
	themeColor: varchar('theme_color', { length: 6 }),
	status: varchar('status', { length: 50 }).default('ongoing'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const volumes = pgTable('volumes', {
	id: varchar('id', { length: 128 }).primaryKey(),
	bookId: varchar('book_id', { length: 128 })
		.references(() => books.id, { onDelete: 'cascade', onUpdate: 'cascade' })
		.notNull(),
	volumeNumber: integer('volume_number').notNull(),
	title: varchar('title', { length: 255 }).notNull(),
	description: text('description'),
	coverUrl: varchar('cover_url', { length: 1024 }),
	blurhash: varchar('blurhash', { length: 100 }),
	status: varchar('status', { length: 50 }).default('ongoing'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const chapters = pgTable('chapters', {
	id: varchar('id', { length: 128 }).primaryKey(),
	volumeId: varchar('volume_id', { length: 128 })
		.references(() => volumes.id, { onDelete: 'cascade', onUpdate: 'cascade' })
		.notNull(),
	chapterNumber: integer('chapter_number').notNull(),
	title: varchar('title', { length: 255 }).notNull(),
	audioUrl: varchar('audio_url', { length: 1024 }).notNull(),
	durationSeconds: integer('duration_seconds').notNull(),
	telegramPostUrl: varchar('telegram_post_url', { length: 1024 }),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const listeningProgress = pgTable(
	'listening_progress',
	{
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		chapterId: varchar('chapter_id', { length: 128 })
			.references(() => chapters.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		progressSeconds: integer('progress_seconds').notNull().default(0),
		isCompleted: boolean('is_completed').default(false),
		updatedAt: timestamp('updated_at').defaultNow()
	},
	(t) => [primaryKey({ columns: [t.userId, t.chapterId] })]
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
	(t) => [primaryKey({ columns: [t.userId, t.volumeId] })]
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
		createdAt: timestamp('created_at').defaultNow()
	},
	(t) => [primaryKey({ columns: [t.userId, t.chapterId] })]
);

export const bookmarks = pgTable('bookmarks', {
	id: varchar('id', { length: 36 }).primaryKey(),
	userId: text('user_id')
		.references(() => user.id, { onDelete: 'cascade' })
		.notNull(),
	chapterId: varchar('chapter_id', { length: 128 })
		.references(() => chapters.id, { onDelete: 'cascade', onUpdate: 'cascade' })
		.notNull(),
	timestampSeconds: integer('timestamp_seconds').notNull(),
	note: varchar('note', { length: 500 }),
	createdAt: timestamp('created_at').defaultNow()
});

export const illustrations = pgTable('illustrations', {
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
});

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

export const chaptersRelations = relations(chapters, ({ one }) => ({
	volume: one(volumes, {
		fields: [chapters.volumeId],
		references: [volumes.id]
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
			table.userId
		)
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
