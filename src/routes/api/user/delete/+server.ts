import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { user } from '$lib/server/db/schema';
import { sessionCookieName } from '$lib/server/boosty/token-utils';

/**
 * Удаление аккаунта пользователя.
 * Требует авторизованной сессии. Удаляет самого пользователя — все связанные
 * данные (account, session, закладки, прогресс, лайки) удаляются каскадом
 * (FK с ON DELETE CASCADE).
 */
export const POST = async ({ locals, cookies, request }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		await db.delete(user).where(eq(user.id, currentUser.id));
		// Сессии удалены каскадом — дополнительно очищаем session-cookie
		// (истёкший срок maxAge=0), чтобы клиент сразу вышел.
		const isProduction = !dev;
		const isHttps = new URL(request.url).protocol === 'https:';
		cookies.set(sessionCookieName(isProduction), '', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: isProduction || isHttps,
			maxAge: 0
		});
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
