import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { user } from '$lib/server/db/schema';
import { createLogger } from '$lib/logger';

const log = createLogger('API');

/**
 * User account deletion endpoint.
 * Requires authenticated session. Deletes user record and cascades associated data.
 */
export const POST = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		await db.delete(user).where(eq(user.id, currentUser.id));
		return json({ ok: true });
	} catch (e) {
		log.error('Failed to delete user:', e);
		return json({ error: 'Failed to delete account' }, { status: 500 });
	}
};

export const GET = async () => {
	return json({ error: 'Method not allowed' }, { status: 405 });
};
