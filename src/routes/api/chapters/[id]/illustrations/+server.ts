import { json } from '@sveltejs/kit';
import { getChapterIllustrations } from '$lib/server/broadcasts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const chapterId = params.id ?? '';
	if (!chapterId) return json({ illustrations: [] });
	const illustrations = await getChapterIllustrations(chapterId);
	return json({ illustrations }, { headers: { 'cache-control': 'no-store' } });
};
