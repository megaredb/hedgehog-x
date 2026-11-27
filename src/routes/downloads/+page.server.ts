import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { broadcasts } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({ chapterId: broadcasts.chapterId, chatEnabled: broadcasts.chatEnabled })
		.from(broadcasts)
		.where(and(eq(broadcasts.saveRecording, true), isNotNull(broadcasts.publishedAt)))
		.limit(2000);
	return {
		replayChapterIds: [...new Set(rows.map((row) => row.chapterId))],
		replayChatChapterIds: [
			...new Set(rows.filter((row) => row.chatEnabled).map((row) => row.chapterId))
		]
	};
};
