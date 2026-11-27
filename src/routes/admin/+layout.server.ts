import { error, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { isAdminRole } from '$lib/server/admin';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/auth?from=/admin');
	}

	const isAdmin = isAdminRole(locals.user.role);

	// In dev the overview is still rendered so the existing self-promote card
	// works. Every other admin route and every production non-admin gets the
	// same explicit 403 instead of a mix of empty dashboards and raw errors.
	if (!isAdmin && !(dev && url.pathname === '/admin')) {
		throw error(403, 'Доступ только для администраторов');
	}

	return {
		user: locals.user,
		isAdmin,
		isDev: dev
	};
};
