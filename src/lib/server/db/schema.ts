import {
	pgTable,
	pgEnum,
	check,
	index,
	integer,
	text,
	boolean,
	primaryKey,
	timestamp,
	varchar
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from './auth.schema';

export const bookStatus = pgEnum('book_status', ['ongoing', 'completed', 'paused']);

export const books = pgTable(
	'books',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		title: varchar('title', { length: 255 }).notNull(),
		description: text('description'),
		coverUrl: varchar('cover_url', { length: 255 }),
		blurhash: varchar('blurhash', { length: 100 }),
		themeColor: varchar('theme_color', { length: 6 }),
		status: bookStatus('status').notNull().default('ongoing'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		check(
			'books_theme_color_hex_check',
			sql`${table.themeColor} IS NULL OR ${table.themeColor} ~ '^[0-9a-fA-F]{6}$'`
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
		coverUrl: varchar('cover_url', { length: 255 }),
		blurhash: varchar('blurhash', { length: 100 }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('volumes_book_id_idx').on(table.bookId)]
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
		audioUrl: varchar('audio_url', { length: 512 }).notNull(),
		durationSeconds: integer('duration_seconds').notNull(),
		telegramPostUrl: varchar('telegram_post_url', { length: 255 }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('chapters_volume_id_idx').on(table.volumeId)]
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
		progressSeconds: integer('progress_seconds').notNull().default(0),
		isCompleted: boolean('is_completed').default(false),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
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
		createdAt: timestamp('created_at').defaultNow().notNull()
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
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.chapterId] })]
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
		timestampSeconds: integer('timestamp_seconds').notNull(),
		note: varchar('note', { length: 500 }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('bookmarks_user_id_idx').on(table.userId)]
);

export const illustrations = pgTable(
	'illustrations',
	{
		id: varchar('id', { length: 128 }).primaryKey(),
		volumeId: varchar('volume_id', { length: 128 })
			.references(() => volumes.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		imageUrl: varchar('image_url', { length: 512 }).notNull(),
		blurhash: varchar('blurhash', { length: 100 }),
		caption: varchar('caption', { length: 255 }),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('illustrations_volume_id_idx').on(table.volumeId)]
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
	illustrations: many(illustrations),
	volumeLikes: many(volumeLikes)
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
	volume: one(volumes, {
		fields: [chapters.volumeId],
		references: [volumes.id]
	}),
	listeningProgress: many(listeningProgress),
	chapterLikes: many(chapterLikes),
	bookmarks: many(bookmarks)
}));

export const illustrationsRelations = relations(illustrations, ({ one }) => ({
	volume: one(volumes, {
		fields: [illustrations.volumeId],
		references: [volumes.id]
	})
}));

export const listeningProgressRelations = relations(listeningProgress, ({ one }) => ({
	user: one(user, {
		fields: [listeningProgress.userId],
		references: [user.id]
	}),
	chapter: one(chapters, {
		fields: [listeningProgress.chapterId],
		references: [chapters.id]
	})
}));

export const volumeLikesRelations = relations(volumeLikes, ({ one }) => ({
	user: one(user, {
		fields: [volumeLikes.userId],
		references: [user.id]
	}),
	volume: one(volumes, {
		fields: [volumeLikes.volumeId],
		references: [volumes.id]
	})
}));

export const chapterLikesRelations = relations(chapterLikes, ({ one }) => ({
	user: one(user, {
		fields: [chapterLikes.userId],
		references: [user.id]
	}),
	chapter: one(chapters, {
		fields: [chapterLikes.chapterId],
		references: [chapters.id]
	})
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
	user: one(user, {
		fields: [bookmarks.userId],
		references: [user.id]
	}),
	chapter: one(chapters, {
		fields: [bookmarks.chapterId],
		references: [chapters.id]
	})
}));

export const userDomainRelations = relations(user, ({ many }) => ({
	listeningProgress: many(listeningProgress),
	volumeLikes: many(volumeLikes),
	chapterLikes: many(chapterLikes),
	bookmarks: many(bookmarks)
}));

export * from './auth.schema';
