import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq, sql } from 'drizzle-orm';
import {
	dailyListeningStats,
	listeningSessions,
	subscriptionEvents,
	subscriptionPriceChanges,
	subscriptionSettings,
	subscriptions,
	user
} from '$lib/server/db/schema';
import { session } from '$lib/server/db/auth.schema';
import { createLogger } from '$lib/logger';

const log = createLogger('API');

/** Same-origin check that also works behind the local Traefik HTTPS proxy. */
function isTrustedOrigin(request: Request, url: URL): boolean {
	const origin = request.headers.get('origin');
	const secFetchSite = request.headers.get('sec-fetch-site');
	if (!origin) return secFetchSite === 'same-origin';
	if (origin === url.origin) return true;
	if (secFetchSite === 'same-origin') return true;

	const rawForwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
	const forwardedHost = rawForwardedHost?.split(',')[0]?.trim();
	if (!forwardedHost) return false;
	const forwardedProto = (request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1))
		.split(',')[0]
		.trim();
	try {
		return new URL(origin).origin === `${forwardedProto}://${forwardedHost}`;
	} catch {
		return false;
	}
}

export const POST = async ({ request, locals, cookies, url }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!isTrustedOrigin(request, url)) {
		return json({ error: 'Invalid origin' }, { status: 403 });
	}

	try {
		const tableRows = await db.execute<{ exists: boolean }>(
			sql`select to_regclass('public.subscription_events') is not null as exists`
		);
		const hasSubscriptionTables = Boolean(tableRows[0]?.exists);

		await db.transaction(async (tx) => {
			// Keep admin audit references but remove the account and all personal data.
			// This also handles databases where older FK migrations used RESTRICT.
			if (hasSubscriptionTables) {
				await tx
					.update(subscriptionEvents)
					.set({ adminUserId: null })
					.where(eq(subscriptionEvents.adminUserId, currentUser.id));
				await tx
					.update(subscriptionPriceChanges)
					.set({ adminUserId: null })
					.where(eq(subscriptionPriceChanges.adminUserId, currentUser.id));
				await tx
					.update(subscriptionSettings)
					.set({ updatedBy: null })
					.where(eq(subscriptionSettings.updatedBy, currentUser.id));
				await tx
					.update(subscriptions)
					.set({ updatedBy: null })
					.where(eq(subscriptions.updatedBy, currentUser.id));
			}
			// Keep anonymized analytics, matching the donation ledger policy.
			await tx
				.update(listeningSessions)
				.set({ userId: null })
				.where(eq(listeningSessions.userId, currentUser.id));
			await tx
				.update(dailyListeningStats)
				.set({ userId: null })
				.where(eq(dailyListeningStats.userId, currentUser.id));
			await tx.delete(session).where(eq(session.userId, currentUser.id));
			await tx.delete(user).where(eq(user.id, currentUser.id));
		});
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
