import { inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { loadSitePage, loadTranslators } from '$lib/server/site-content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [page, translatorRows] = await Promise.all([loadSitePage('about'), loadTranslators()]);
	const userIds = [
		...(page.data.developers ?? []).map((developer) => developer.userId),
		...translatorRows.map((translator) => translator.userId)
	].filter((id): id is string => Boolean(id));
	const avatarRows = userIds.length
		? await db
				.select({
					id: user.id,
					image: user.image,
					telegramAvatar: user.telegramAvatar,
					discordAvatar: user.discordAvatar
				})
				.from(user)
				.where(inArray(user.id, [...new Set(userIds)]))
		: [];
	const avatars = Object.fromEntries(
		avatarRows
			.map((row) => [row.id, row.image || row.telegramAvatar || row.discordAvatar || ''] as const)
			.filter(([, src]) => Boolean(src))
	);
	return { page, translators: translatorRows, avatars };
};
