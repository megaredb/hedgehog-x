import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	isAdmin: locals.user?.role === 'admin'
});
