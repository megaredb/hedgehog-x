import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { ensureDefaultBooks } from '$lib/server/db/seed';

if (!building) {
	ensureDefaultBooks().catch((err) => {
		console.error('[hooks.server] Failed to run initial database seed:', err);
	});
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (!building && event.url.pathname.startsWith('/api/books')) {
		await ensureDefaultBooks().catch(() => {});
	}

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
