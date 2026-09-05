import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { user } from '$lib/server/db/schema';

/**
 * Удаление аккаунта пользователя.
 * Требует авторизованной сессии. Удаляет самого пользователя — все связанные
 * данные (account, session, закладки, прогресс, лайки) удаляются каскадом
 * (FK с ON DELETE CASCADE).
 */
export const POST = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		await db.delete(user).where(eq(user.id, currentUser.id));
		// После удаления пользователя все его сессии исчезли каскадом.
		return json({ ok: true });
	} catch (e) {
		console.error('[api/user/delete] failed to delete user', e);
		return json({ error: 'Failed to delete account' }, { status: 500 });
	}
};

/** GET не поддерживается — только POST. */
export const GET = async () => {
	return json({ error: 'Method not allowed' }, { status: 405 });
};
