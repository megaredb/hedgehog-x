import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth?redirect=/admin');
	}

	const isAdmin = locals.user.role === 'admin';

	return {
		user: locals.user,
		isAdmin,
		isDev: dev
	};
};
