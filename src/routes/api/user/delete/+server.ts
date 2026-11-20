import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { user } from '$lib/server/db/schema';
import { createLogger } from '$lib/logger';

const log = createLogger('API');

export const POST = async ({ request, locals, cookies, url }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		return json({ error: 'Invalid origin' }, { status: 403 });
	}

	try {
		await db.delete(user).where(eq(user.id, currentUser.id));
		for (const name of ['better-auth.session_token', '__Secure-better-auth.session_token']) {
			cookies.delete(name, { path: '/' });
		}
		return json({ ok: true });
	} catch (e) {
		log.error('Failed to delete user:', e);
		return json({ error: 'Failed to delete account' }, { status: 500 });
	}
};

export const GET = async () => {
	return json({ error: 'Method not allowed' }, { status: 405 });
};
