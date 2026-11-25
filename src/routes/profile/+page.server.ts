import type { PageServerLoad } from './$types';
import { getSubscriptionSummary } from '$lib/server/subscriptions/entitlement';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { subscription: null };
	return { subscription: await getSubscriptionSummary(locals.user.id) };
};
