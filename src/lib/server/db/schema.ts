import {
	pgTable,
	integer,
	text,
	boolean,
	primaryKey,
	timestamp,
	varchar
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth.schema';

export const books = pgTable('books', {
	id: varchar('id', { length: 128 }).primaryKey(),
	title: varchar('title', { length: 255 }).notNull(),
	description: text('description'),
	coverUrl: varchar('cover_url', { length: 255 }),
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
	coverUrl: varchar('cover_url', { length: 255 }),
	blurhash: varchar('blurhash', { length: 100 }),
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
	audioUrl: varchar('audio_url', { length: 512 }).notNull(),
	durationSeconds: integer('duration_seconds').notNull(),
	telegramPostUrl: varchar('telegram_post_url', { length: 255 }),
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
	imageUrl: varchar('image_url', { length: 512 }).notNull(),
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

export * from './auth.schema';
