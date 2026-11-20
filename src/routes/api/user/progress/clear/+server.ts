import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { listeningProgress } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	await db.delete(listeningProgress).where(eq(listeningProgress.userId, user.id));
	return json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
};
