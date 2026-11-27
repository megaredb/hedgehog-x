export const PAGE_CACHE_DENYLIST: readonly RegExp[] = [
	/^\/admin(?:\/|$)/,
	/^\/auth(?:\/|$)/,
	/^\/bookmarks(?:\/|$)/,
	/^\/history(?:\/|$)/,
	/^\/profile(?:\/|$)/,
	/^\/settings(?:\/|$)/,
	/^\/subscription(?:\/|$)/,
	/^\/broadcasts(?:\/|$)/,
	/^\/feedback(?:\/|$)/,
	/^\/api(?:\/|$)/
];

export function isPageCacheDenied(pathname: string): boolean {
	return PAGE_CACHE_DENYLIST.some((pattern) => pattern.test(pathname));
}
