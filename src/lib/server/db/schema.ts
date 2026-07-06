import { pgTable, text, integer, timestamp, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth.schema';

export * from './auth.schema';

export const books = pgTable('books', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description'),
	coverUrl: text('cover_url'),
	status: text('status').default('ongoing').notNull(),
	themeColor: text('theme_color'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const volumes = pgTable('volumes', {
	id: text('id').primaryKey(),
	bookId: text('book_id')
		.references(() => books.id, { onDelete: 'cascade' })
		.notNull(),
	volumeNumber: integer('volume_number').notNull(),
	title: text('title').notNull(),
	coverUrl: text('cover_url'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const chapters = pgTable('chapters', {
	id: text('id').primaryKey(),
	volumeId: text('volume_id')
		.references(() => volumes.id, { onDelete: 'cascade' })
		.notNull(),
	chapterNumber: integer('chapter_number').notNull(),
	title: text('title').notNull(),
	audioUrl: text('audio_url').notNull(),
	durationSeconds: integer('duration_seconds').notNull(),
	telegramPostUrl: text('telegram_post_url'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const listeningProgress = pgTable(
	'listening_progress',
	{
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		chapterId: text('chapter_id')
			.references(() => chapters.id, { onDelete: 'cascade' })
			.notNull(),
		progressSeconds: integer('progress_seconds').notNull().default(0),
		isCompleted: boolean('is_completed').default(false).notNull(),
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
		volumeId: text('volume_id')
			.references(() => volumes.id, { onDelete: 'cascade' })
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
		chapterId: text('chapter_id')
			.references(() => chapters.id, { onDelete: 'cascade' })
			.notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.chapterId] })]
);

export const bookmarks = pgTable('bookmarks', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.references(() => user.id, { onDelete: 'cascade' })
		.notNull(),
	chapterId: text('chapter_id')
		.references(() => chapters.id, { onDelete: 'cascade' })
		.notNull(),
	timestampSeconds: integer('timestamp_seconds').notNull(),
	note: text('note'),
	createdAt: timestamp('created_at').defaultNow().notNull()
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
	likes: many(volumeLikes)
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
	volume: one(volumes, {
		fields: [chapters.volumeId],
		references: [volumes.id]
	}),
	listeningProgress: many(listeningProgress),
	likes: many(chapterLikes),
	bookmarks: many(bookmarks)
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
