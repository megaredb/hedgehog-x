import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const LEGACY_TABS: Record<string, string> = {
	books: 'chapters',
	volumes: 'volume',
	chapters: 'chapters',
	versions: 'chapters',
	illustrations: 'illustrations'
};

export const load: PageServerLoad = async ({ params, url }) => {
	const tab = LEGACY_TABS[params.legacy];
	if (!tab) throw error(404, 'Страница не найдена');

	const target = new URL('/admin/content', url);
	target.searchParams.set('tab', tab);
	for (const key of ['book', 'volume', 'edit', 'chapter', 'new']) {
		const value = url.searchParams.get(key);
		if (value) target.searchParams.set(key, value);
	}
	const legacyVolumeId = url.searchParams.get('volumeId');
	if (legacyVolumeId && !target.searchParams.has('volume')) {
		target.searchParams.set('volume', legacyVolumeId);
	}
	throw redirect(303, target.pathname + target.search);
};
