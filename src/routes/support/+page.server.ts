import { env } from '$env/dynamic/public';
import { loadSitePage } from '$lib/server/site-content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const page = await loadSitePage('support');
	return {
		page,
		tonConnectManifestUrl: env.PUBLIC_TONCONNECT_MANIFEST_URL?.trim() ?? ''
	};
};
