import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { listeningProgress } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { chapterId, currentTime, isCompleted } = body;

		if (!chapterId || typeof currentTime !== 'number' || typeof isCompleted !== 'boolean') {
			return json({ error: 'Invalid payload' }, { status: 400 });
		}

		// Check if record exists
		const existingProgress = await db.query.listeningProgress.findFirst({
			where: and(eq(listeningProgress.userId, user.id), eq(listeningProgress.chapterId, chapterId))
		});

		const progressSeconds = Math.round(currentTime);

		if (existingProgress) {
			await db
				.update(listeningProgress)
				.set({
					progressSeconds,
					isCompleted,
					updatedAt: new Date()
				})
				.where(
					and(eq(listeningProgress.userId, user.id), eq(listeningProgress.chapterId, chapterId))
				);
		} else {
			await db.insert(listeningProgress).values({
				userId: user.id,
				chapterId,
				progressSeconds,
				isCompleted,
				updatedAt: new Date()
			});
		}

		return json({ success: true });
	} catch (error) {
		console.error('Progress sync error:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
