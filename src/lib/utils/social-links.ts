import type { SiteSocialLink, SocialIconType } from '$lib/types/site';

/**
 * Icon click behavior for the admin social links editor:
 * - unselected: add an empty enabled link;
 * - selected with empty URL: remove it;
 * - selected with URL: toggle enabled/disabled.
 */
export function toggleSocialLink(links: SiteSocialLink[], type: SocialIconType): SiteSocialLink[] {
	const link = links.find((item) => item.type === type);
	if (!link) return [...links, { enabled: true, type, url: '' }];
	if (!link.url.trim()) return links.filter((item) => item.type !== type);
	return links.map((item) =>
		item.type === type ? { ...item, enabled: item.enabled === false } : item
	);
}
