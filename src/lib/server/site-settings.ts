import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { siteSettings } from '$lib/server/db/schema';
import { DEFAULT_SITE_MIRRORS, type MirrorAutoRole, type SiteMirror } from '$lib/types/site';

export interface MediaSettings {
	mediaProxyEnabled: boolean;
	mediaDirectBaseUrl: string;
}

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
	mediaProxyEnabled: true,
	mediaDirectBaseUrl: ''
};

const CACHE_TTL_MS = 15_000;
let cached: { value: MediaSettings; expiresAt: number } | null = null;

function cleanBaseUrl(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) return '';
	try {
		const url = new URL(value.trim());
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
		return url.toString().replace(/\/$/, '');
	} catch {
		return '';
	}
}

function cleanHost(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) return '';
	try {
		const url = new URL(value.trim().includes('://') ? value.trim() : `https://${value.trim()}`);
		return url.hostname.toLowerCase();
	} catch {
		return '';
	}
}

export function normalizeMediaSettings(value: unknown): MediaSettings {
	const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	return {
		mediaProxyEnabled: row.mediaProxyEnabled !== false,
		mediaDirectBaseUrl: cleanBaseUrl(row.mediaDirectBaseUrl)
	};
}

function normalizeAutoRole(value: unknown): MirrorAutoRole {
	return value === 'ru' || value === 'none' || value === 'default' ? value : 'none';
}

export function normalizeMirrors(value: unknown): SiteMirror[] {
	if (!Array.isArray(value)) return structuredClone(DEFAULT_SITE_MIRRORS);
	const seen = new Set<string>();
	const mirrors = value
		.slice(0, 30)
		.map((item, index) => {
			const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
			const host = cleanHost(row.host);
			if (!host) return null;
			let id = String(row.id ?? '')
				.trim()
				.slice(0, 64);
			if (!id || seen.has(id)) id = `mirror-${index + 1}`;
			seen.add(id);
			return {
				id,
				label:
					String(row.label ?? '')
						.trim()
						.slice(0, 120) || host,
				description: String(row.description ?? '')
					.trim()
					.slice(0, 500),
				host,
				enabled: row.enabled !== false,
				autoRole: normalizeAutoRole(row.autoRole)
			};
		})
		.filter((mirror): mirror is SiteMirror => Boolean(mirror));
	return mirrors.length ? mirrors : structuredClone(DEFAULT_SITE_MIRRORS);
}

export function deriveMediaDirectBase(mirrors: SiteMirror[]): string {
	const primary =
		mirrors.find((mirror) => mirror.enabled && mirror.autoRole === 'default') ??
		mirrors.find((mirror) => mirror.enabled);
	return primary ? `https://${primary.host}` : '';
}

export function directMediaUrl(settings: MediaSettings, key: string): string | null {
	if (settings.mediaProxyEnabled || !settings.mediaDirectBaseUrl) return null;
	const encodedKey = key.split('/').map(encodeURIComponent).join('/');
	return `${settings.mediaDirectBaseUrl}/${encodedKey}`;
}

export async function loadMediaSettings(force = false): Promise<MediaSettings> {
	if (!force && cached && cached.expiresAt > Date.now()) return cached.value;
	const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, 'media')).limit(1);
	const value = row ? normalizeMediaSettings(row.value) : DEFAULT_MEDIA_SETTINGS;
	cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
	return value;
}

export async function saveMediaSettings(input: MediaSettings): Promise<MediaSettings> {
	const value = normalizeMediaSettings(input);
	await db
		.insert(siteSettings)
		.values({ key: 'media', value: { ...value } })
		.onConflictDoUpdate({
			target: siteSettings.key,
			set: { value: { ...value }, updatedAt: new Date() }
		});
	cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
	return value;
}

export function invalidateMediaSettingsCache(): void {
	cached = null;
}

export async function loadMirrors(): Promise<SiteMirror[]> {
	const [row] = await db
		.select()
		.from(siteSettings)
		.where(eq(siteSettings.key, 'mirrors'))
		.limit(1);
	const raw = row?.value;
	const value = normalizeMirrors(
		raw && typeof raw === 'object' && 'mirrors' in raw
			? (raw as { mirrors?: unknown }).mirrors
			: raw
	);
	return value;
}

export async function saveMirrors(input: unknown): Promise<SiteMirror[]> {
	const value = normalizeMirrors(input);
	await db
		.insert(siteSettings)
		.values({ key: 'mirrors', value: { mirrors: value } })
		.onConflictDoUpdate({
			target: siteSettings.key,
			set: { value: { mirrors: value }, updatedAt: new Date() }
		});
	return value;
}
