import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin';
import { getIntegrationStatus } from '$lib/server/integrations/status';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireAdmin(locals);
	const status = await getIntegrationStatus(user.id);
	return json(status);
};
