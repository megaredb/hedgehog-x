import {
	pgTable,
	integer,
	bigint,
	jsonb,
	doublePrecision,
	text,
	boolean,
	primaryKey,
	timestamp,
	varchar,
	index,
	uniqueIndex,
	uuid,
	check
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from './auth.schema';
import type { SitePageData, SiteSocialLink } from '$lib/types/site';

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
		published: boolean('published').notNull().default(false),
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

export const chapterIllustrations = pgTable(
	'chapter_illustrations',
	{
		id: varchar('id', { length: 36 })
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		chapterId: varchar('chapter_id', { length: 128 })
			.references(() => chapters.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		illustrationId: varchar('illustration_id', { length: 128 })
			.references(() => illustrations.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		showAtSeconds: doublePrecision('show_at_seconds').notNull().default(0),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [
		index('chapter_illustrations_chapter_idx').on(t.chapterId),
		index('chapter_illustrations_illustration_idx').on(t.illustrationId),
		uniqueIndex('chapter_illustrations_chapter_illustration_unique').on(
			t.chapterId,
			t.illustrationId
		)
	]
);

export const sitePages = pgTable(
	'site_pages',
	{
		key: varchar('key', { length: 32 }).primaryKey(),
		title: varchar('title', { length: 255 }).notNull(),
		intro: text('intro').notNull().default(''),
		content: text('content').notNull().default(''),
		data: jsonb('data').$type<SitePageData>().notNull().default({}),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date())
	},
	(t) => [check('site_pages_key_check', sql`${t.key} in ('about', 'support', 'community')`)]
);

export const siteSettings = pgTable('site_settings', {
	key: varchar('key', { length: 64 }).primaryKey(),
	value: jsonb('value').$type<Record<string, unknown>>().notNull().default({}),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date())
});

export const translators = pgTable('translators', {
	id: varchar('id', { length: 36 })
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: varchar('name', { length: 255 }).notNull(),
	role: varchar('role', { length: 120 }),
	description: text('description'),
	url: varchar('url', { length: 1024 }),
	links: jsonb('links').$type<SiteSocialLink[]>().notNull().default([]),
	userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
	enabled: boolean('enabled').notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date())
});

export const broadcasts = pgTable(
	'broadcasts',
	{
		id: varchar('id', { length: 36 })
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		chapterId: varchar('chapter_id', { length: 128 })
			.references(() => chapters.id, { onDelete: 'cascade', onUpdate: 'cascade' })
			.notNull(),
		title: varchar('title', { length: 255 }).notNull(),
		description: text('description'),
		coverUrl: varchar('cover_url', { length: 1024 }),
		coverBlurhash: varchar('cover_blurhash', { length: 100 }),
		scheduledStartAt: timestamp('scheduled_start_at').notNull(),
		startedAt: timestamp('started_at'),
		endedAt: timestamp('ended_at'),
		saveRecording: boolean('save_recording').notNull().default(true),
		publishAfterEnd: boolean('publish_after_end').notNull().default(true),
		chatEnabled: boolean('chat_enabled').notNull().default(true),
		publishedAt: timestamp('published_at'),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date())
	},
	(t) => [
		index('broadcasts_chapter_idx').on(t.chapterId),
		index('broadcasts_start_idx').on(t.scheduledStartAt),
		index('broadcasts_published_idx').on(t.publishedAt)
	]
);

export const broadcastMessages = pgTable(
	'broadcast_messages',
	{
		id: varchar('id', { length: 36 })
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		broadcastId: varchar('broadcast_id', { length: 36 })
			.references(() => broadcasts.id, { onDelete: 'cascade' })
			.notNull(),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		body: text('body').notNull(),
		replyToId: varchar('reply_to_id', { length: 36 }),
		replyToName: varchar('reply_to_name', { length: 255 }),
		replyToBody: text('reply_to_body'),
		linkUrl: varchar('link_url', { length: 2048 }),
		linkTitle: varchar('link_title', { length: 255 }),
		linkDescription: text('link_description'),
		linkImage: varchar('link_image', { length: 2048 }),
		taggedIllustrationIds: jsonb('tagged_illustration_ids')
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [index('broadcast_messages_broadcast_time_idx').on(t.broadcastId, t.createdAt)]
);

export const broadcastListeners = pgTable(
	'broadcast_listeners',
	{
		broadcastId: varchar('broadcast_id', { length: 36 })
			.references(() => broadcasts.id, { onDelete: 'cascade' })
			.notNull(),
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		joinedAt: timestamp('joined_at').defaultNow().notNull(),
		lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
		leftAt: timestamp('left_at')
	},
	(t) => [
		primaryKey({ columns: [t.broadcastId, t.userId] }),
		index('broadcast_listeners_seen_idx').on(t.lastSeenAt),
		index('broadcast_listeners_broadcast_seen_idx').on(t.broadcastId, t.lastSeenAt)
	]
);

export const broadcastIllustrations = pgTable(
	'broadcast_illustrations',
	{
		id: varchar('id', { length: 36 })
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		broadcastId: varchar('broadcast_id', { length: 36 })
			.references(() => broadcasts.id, { onDelete: 'cascade' })
			.notNull(),
		illustrationId: varchar('illustration_id', { length: 128 })
			.references(() => illustrations.id, { onDelete: 'cascade' })
			.notNull(),
		showAtSeconds: integer('show_at_seconds').notNull().default(0),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [uniqueIndex('broadcast_illustration_unique').on(t.broadcastId, t.illustrationId)]
);

export const broadcastReactions = pgTable(
	'broadcast_reactions',
	{
		messageId: varchar('message_id', { length: 36 })
			.references(() => broadcastMessages.id, { onDelete: 'cascade' })
			.notNull(),
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		emoji: varchar('emoji', { length: 8 }).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })]
);

export const broadcastViews = pgTable(
	'broadcast_views',
	{
		id: varchar('id', { length: 36 })
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		broadcastId: varchar('broadcast_id', { length: 36 })
			.references(() => broadcasts.id, { onDelete: 'cascade' })
			.notNull(),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		kind: varchar('kind', { length: 16 }).notNull().default('live'),
		startedAt: timestamp('started_at').defaultNow().notNull(),
		lastSeenAt: timestamp('last_seen_at').defaultNow().notNull()
	},
	(t) => [
		index('broadcast_views_broadcast_idx').on(t.broadcastId, t.startedAt),
		index('broadcast_views_broadcast_user_kind_idx').on(t.broadcastId, t.userId, t.kind)
	]
);

export const broadcastProgress = pgTable(
	'broadcast_progress',
	{
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		broadcastId: varchar('broadcast_id', { length: 36 })
			.references(() => broadcasts.id, { onDelete: 'cascade' })
			.notNull(),
		/** Last playback mode; live positions are stored for diagnostics, replay is resumable. */
		kind: varchar('kind', { length: 16 }).notNull().default('replay'),
		positionSeconds: integer('position_seconds').notNull().default(0),
		isCompleted: boolean('is_completed').notNull().default(false),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date())
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.broadcastId] }),
		index('broadcast_progress_broadcast_idx').on(table.broadcastId),
		index('broadcast_progress_updated_idx').on(table.updatedAt)
	]
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
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
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
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
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

export const subscriptions = pgTable(
	'subscriptions',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		manualExpiresAt: timestamp('manual_expires_at'),
		isLifetime: boolean('is_lifetime').notNull().default(false),
		revokedAt: timestamp('revoked_at'),
		revokedRemainingMs: bigint('revoked_remaining_ms', { mode: 'number' }),
		blockedAt: timestamp('blocked_at'),
		blockedReason: varchar('blocked_reason', { length: 500 }),
		blockedRemainingMs: bigint('blocked_remaining_ms', { mode: 'number' }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' })
	},
	(table) => [index('subscriptions_manual_expires_idx').on(table.manualExpiresAt)]
);

export const subscriptionSources = pgTable(
	'subscription_sources',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		provider: varchar('provider', { length: 16 }).notNull(),
		externalId: varchar('external_id', { length: 64 }).notNull(),
		active: boolean('active').notNull().default(false),
		checkedAt: timestamp('checked_at'),
		lastError: varchar('last_error', { length: 500 }),
		metadata: text('metadata'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date())
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.provider] }),
		index('subscription_sources_provider_external_idx').on(table.provider, table.externalId)
	]
);

export const subscriptionEvents = pgTable(
	'subscription_events',
	{
		id: varchar('id', { length: 36 })
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: varchar('type', { length: 32 }).notNull(),
		source: varchar('source', { length: 16 }).notNull(),
		days: integer('days'),
		amountRub: integer('amount_rub'),
		pricePerDay: integer('price_per_day'),
		beforeExpiresAt: timestamp('before_expires_at'),
		afterExpiresAt: timestamp('after_expires_at'),
		beforeLifetime: boolean('before_lifetime'),
		afterLifetime: boolean('after_lifetime'),
		provider: varchar('provider', { length: 16 }),
		externalId: varchar('external_id', { length: 64 }),
		adminUserId: text('admin_user_id').references(() => user.id, { onDelete: 'set null' }),
		note: varchar('note', { length: 500 }),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('subscription_events_user_created_idx').on(table.userId, table.createdAt),
		index('subscription_events_type_idx').on(table.type)
	]
);

export const donationLedger = pgTable(
	'donation_ledger',
	{
		id: uuid('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		donorKey: uuid('donor_key').notNull(),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		amountRub: integer('amount_rub').notNull(),
		pricePerDay: integer('price_per_day'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		source: varchar('source', { length: 16 }).notNull(),
		note: varchar('note', { length: 500 }),
		idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull().unique()
	},
	(table) => [
		index('donation_ledger_donor_key_idx').on(table.donorKey),
		index('donation_ledger_created_at_idx').on(table.createdAt),
		index('donation_ledger_user_id_idx').on(table.userId),
		check('donation_ledger_amount_check', sql`${table.amountRub} > 0`)
	]
);

export const subscriptionSettings = pgTable('subscription_settings', {
	id: varchar('id', { length: 16 }).primaryKey(),
	pricePerDay: integer('price_per_day').notNull().default(7),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
	updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' })
});

export const subscriptionPriceChanges = pgTable('subscription_price_changes', {
	id: varchar('id', { length: 36 })
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	oldPrice: integer('old_price').notNull(),
	newPrice: integer('new_price').notNull(),
	scope: varchar('scope', { length: 16 }).notNull(),
	adminUserId: text('admin_user_id').references(() => user.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const subscriptionPriceNotices = pgTable(
	'subscription_price_notices',
	{
		id: varchar('id', { length: 36 })
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		priceChangeId: varchar('price_change_id', { length: 36 })
			.notNull()
			.references(() => subscriptionPriceChanges.id, { onDelete: 'cascade' }),
		oldPrice: integer('old_price').notNull(),
		newPrice: integer('new_price').notNull(),
		scope: varchar('scope', { length: 16 }).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		dismissedAt: timestamp('dismissed_at'),
		dismissedReason: varchar('dismissed_reason', { length: 16 })
	},
	(table) => [
		index('subscription_price_notices_user_idx').on(table.userId, table.dismissedAt),
		uniqueIndex('subscription_price_notices_user_change_idx').on(table.userId, table.priceChangeId)
	]
);

export * from './auth.schema';
