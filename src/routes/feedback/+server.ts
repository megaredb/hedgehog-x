import { redirect } from '@sveltejs/kit';
import { loadSitePage } from '$lib/server/site-content';
import { safeFeedbackTarget } from '$lib/server/feedback';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const about = await loadSitePage('about');
	throw redirect(302, safeFeedbackTarget(about.data.feedbackUrl));
};
