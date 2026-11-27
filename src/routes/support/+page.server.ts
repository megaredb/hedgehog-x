import { loadSitePage } from '$lib/server/site-content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const page = await loadSitePage('support');
	return { page };
};
