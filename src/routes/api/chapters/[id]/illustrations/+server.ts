import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { chapters } from '$lib/server/db/schema';
import { isAdminRole } from '$lib/server/admin';
import { getChapterIllustrations } from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const chapterId = params.id ?? '';
	if (!chapterId) {
		return json({ illustrations: [] }, { status: 404, headers: { 'cache-control': 'no-store' } });
	}
	const [chapter] = await db
		.select({ published: chapters.published })
		.from(chapters)
		.where(eq(chapters.id, chapterId))
		.limit(1);
	if (!chapter || (!chapter.published && !isAdminRole(locals.user?.role))) {
		return json({ illustrations: [] }, { status: 404, headers: { 'cache-control': 'no-store' } });
	}
	const illustrations = await getChapterIllustrations(chapterId);
	return json({ illustrations }, { headers: { 'cache-control': 'no-store' } });
};
