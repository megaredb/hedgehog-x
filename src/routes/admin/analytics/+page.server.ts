import { redirect } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import {
	dailyListeningStats,
	listeningSessions,
	books,
	volumes,
	chapters
} from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import { sum, count, desc, eq, sql } from 'drizzle-orm';
import { formatListeningDuration } from '$lib/analytics/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth?redirect=/admin/analytics');
	}

	if (locals.user.role !== 'admin') {
		return {
			notAdmin: true,
			summary: {
				totalHours: 0,
				totalSeconds: 0,
				totalSessions: 0,
				uniqueListeners: 0,
				formattedTotalTime: '0 мин'
			},
			dailyBreakdown: [],
			topBooks: [],
			topChapters: [],
			recentSessions: [],
			isUmamiConfigured: false,
			umamiHost: ''
		};
	}

	// 1. Overall Aggregates
	const [totals] = await db
		.select({
			totalSeconds: sum(dailyListeningStats.totalSeconds),
			totalSessions: sum(dailyListeningStats.sessionsCount)
		})
		.from(dailyListeningStats);

	const [uniqueListenersCount] = await db
		.select({
			count: count(sql`DISTINCT ${listeningSessions.userId}`)
		})
		.from(listeningSessions)
		.where(sql`${listeningSessions.userId} IS NOT NULL`);

	const totalSeconds = Number(totals?.totalSeconds) || 0;
	const totalSessions = Number(totals?.totalSessions) || 0;
	const totalHours = Number((totalSeconds / 3600).toFixed(1));
	const uniqueListeners = Number(uniqueListenersCount?.count) || 0;
	const formattedTotalTime = formatListeningDuration(totalSeconds).formatted;

	// 2. Daily breakdown for past 14-30 days
	const dailyRows = await db
		.select({
			date: dailyListeningStats.date,
			totalSeconds: sum(dailyListeningStats.totalSeconds),
			sessionsCount: sum(dailyListeningStats.sessionsCount)
		})
		.from(dailyListeningStats)
		.groupBy(dailyListeningStats.date)
		.orderBy(desc(dailyListeningStats.date))
		.limit(30);

	const dailyBreakdown = dailyRows
		.map((row) => {
			const secs = Number(row.totalSeconds) || 0;
			return {
				date: row.date,
				totalSeconds: secs,
				sessionsCount: Number(row.sessionsCount) || 0,
				hours: Number((secs / 3600).toFixed(1)),
				minutes: Math.round(secs / 60)
			};
		})
		.reverse();

	// 3. Top Books
	const topBooksRows = await db
		.select({
			bookId: books.id,
			title: books.title,
			coverUrl: books.coverUrl,
			totalSeconds: sum(dailyListeningStats.totalSeconds),
			sessionsCount: sum(dailyListeningStats.sessionsCount)
		})
		.from(dailyListeningStats)
		.innerJoin(books, eq(dailyListeningStats.bookId, books.id))
		.groupBy(books.id, books.title, books.coverUrl)
		.orderBy(desc(sum(dailyListeningStats.totalSeconds)))
		.limit(5);

	const topBooks = topBooksRows.map((b) => {
		const secs = Number(b.totalSeconds) || 0;
		return {
			bookId: b.bookId,
			title: b.title,
			coverUrl: b.coverUrl,
			totalSeconds: secs,
			sessionsCount: Number(b.sessionsCount) || 0,
			hours: Number((secs / 3600).toFixed(1)),
			formattedDuration: formatListeningDuration(secs).formatted
		};
	});

	// 4. Top Chapters
	const topChaptersRows = await db
		.select({
			chapterId: chapters.id,
			chapterTitle: chapters.title,
			chapterNumber: chapters.chapterNumber,
			volumeTitle: volumes.title,
			bookTitle: books.title,
			totalSeconds: sum(dailyListeningStats.totalSeconds),
			sessionsCount: sum(dailyListeningStats.sessionsCount)
		})
		.from(dailyListeningStats)
		.innerJoin(chapters, eq(dailyListeningStats.chapterId, chapters.id))
		.leftJoin(volumes, eq(chapters.volumeId, volumes.id))
		.leftJoin(books, eq(volumes.bookId, books.id))
		.groupBy(chapters.id, chapters.title, chapters.chapterNumber, volumes.title, books.title)
		.orderBy(desc(sum(dailyListeningStats.totalSeconds)))
		.limit(5);

	const topChapters = topChaptersRows.map((ch) => {
		const secs = Number(ch.totalSeconds) || 0;
		return {
			chapterId: ch.chapterId,
			chapterTitle: ch.chapterTitle,
			chapterNumber: ch.chapterNumber,
			volumeTitle: ch.volumeTitle,
			bookTitle: ch.bookTitle,
			totalSeconds: secs,
			sessionsCount: Number(ch.sessionsCount) || 0,
			formattedDuration: formatListeningDuration(secs).formatted
		};
	});

	// 5. Recent Sessions
	const recentSessionRows = await db
		.select({
			id: listeningSessions.id,
			listenedSeconds: listeningSessions.listenedSeconds,
			startedAt: listeningSessions.startedAt,
			chapterTitle: chapters.title,
			bookTitle: books.title,
			userName: userTable.name,
			userEmail: userTable.email
		})
		.from(listeningSessions)
		.leftJoin(chapters, eq(listeningSessions.chapterId, chapters.id))
		.leftJoin(books, eq(listeningSessions.bookId, books.id))
		.leftJoin(userTable, eq(listeningSessions.userId, userTable.id))
		.orderBy(desc(listeningSessions.startedAt))
		.limit(10);

	const recentSessions = recentSessionRows.map((s) => ({
		id: s.id,
		listenedSeconds: s.listenedSeconds,
		formattedDuration: formatListeningDuration(s.listenedSeconds).formatted,
		startedAt: s.startedAt?.toISOString() ?? new Date().toISOString(),
		chapterTitle: s.chapterTitle ?? 'Неизвестная глава',
		bookTitle: s.bookTitle ?? 'Неизвестная книга',
		user: s.userName || s.userEmail || 'Гость'
	}));

	const isUmamiConfigured = Boolean(
		publicEnv.PUBLIC_UMAMI_WEBSITE_ID ||
		privateEnv.UMAMI_WEBSITE_ID ||
		process.env.PUBLIC_UMAMI_WEBSITE_ID ||
		process.env.UMAMI_WEBSITE_ID
	);

	const umamiHost =
		publicEnv.PUBLIC_UMAMI_HOST ||
		privateEnv.UMAMI_HOST ||
		process.env.PUBLIC_UMAMI_HOST ||
		'https://cloud.umami.is';

	return {
		notAdmin: false,
		summary: {
			totalHours,
			totalSeconds,
			totalSessions,
			uniqueListeners,
			formattedTotalTime
		},
		dailyBreakdown,
		topBooks,
		topChapters,
		recentSessions,
		isUmamiConfigured,
		umamiHost
	};
};
