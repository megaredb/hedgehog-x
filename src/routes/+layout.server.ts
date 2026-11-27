import { isAdminRole } from '$lib/server/admin';
import { getSubscriptionSummary } from '$lib/server/subscriptions/entitlement';
import { loadMirrors } from '$lib/server/site-settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const [subscription, mirrors] = await Promise.all([
		locals.user ? getSubscriptionSummary(locals.user.id) : null,
		loadMirrors()
	]);
	return {
		mirrors,
		isAdmin: isAdminRole(locals.user?.role),
		subscriptionActive: Boolean(subscription?.active),
		subscriptionLifetime: Boolean(subscription?.isLifetime),
		subscriptionExpiresAt: subscription?.expiresAt?.toISOString() ?? null
	};
};
