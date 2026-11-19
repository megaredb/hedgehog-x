/** Returns an internal SvelteKit path, or fallback for external/protocol-relative URLs. */
export function safeInternalPath(raw: string | null | undefined, fallback = '/'): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
		return fallback;
	}

	try {
		const base = 'http://internal.invalid';
		const url = new URL(raw, base);
		if (url.origin !== base) return fallback;
		return url.pathname + url.search + url.hash;
	} catch {
		return fallback;
	}
}
