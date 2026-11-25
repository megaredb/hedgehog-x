import { and, desc, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { broadcasts, chapters, volumes, books } from '$lib/server/db/schema';
import { activeListenerCount, broadcastKind, syncBroadcast } from '$lib/server/broadcasts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({
			id: broadcasts.id,
			title: broadcasts.title,
			description: broadcasts.description,
			coverUrl: broadcasts.coverUrl,
			scheduledStartAt: broadcasts.scheduledStartAt,
			startedAt: broadcasts.startedAt,
			endedAt: broadcasts.endedAt,
			durationSeconds: chapters.durationSeconds,
			publishedAt: broadcasts.publishedAt,
			chapterTitle: chapters.title,
			volumeTitle: volumes.title,
			bookTitle: books.title
		})
		.from(broadcasts)
		.innerJoin(chapters, eq(chapters.id, broadcasts.chapterId))
		.innerJoin(volumes, eq(volumes.id, chapters.volumeId))
		.innerJoin(books, eq(books.id, volumes.bookId))
		.where(
			or(
				and(isNotNull(broadcasts.publishedAt), eq(broadcasts.saveRecording, true)),
				isNull(broadcasts.endedAt)
			)
		)
		.orderBy(desc(broadcasts.publishedAt));
	const synced = await Promise.all(rows.map(async (row) => (await syncBroadcast(row.id)) ?? row));
	const visible = synced
		.map((row) => ({ ...row, kind: broadcastKind(row as never) }))
		.filter((row) => row.kind === 'live' || row.kind === 'published');
	const broadcastItems = await Promise.all(
		visible.map(async (row) => ({
			...row,
			listeners: row.kind === 'live' ? await activeListenerCount(row.id) : 0
		}))
	);
	return { broadcasts: broadcastItems };
};
