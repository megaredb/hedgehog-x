import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { sitePages, translators } from '$lib/server/db/schema';
import {
	DEFAULT_BOOSTY_URL,
	DEFAULT_FEEDBACK_URL,
	DEFAULT_SUPPORT_SETTINGS,
	detectSocialType,
	formatCardNumber,
	CRYPTO_NETWORK_COINS,
	type SitePageData,
	type SitePerson,
	type SiteSocialLink,
	type SocialIconType
} from '$lib/types/site';

export const SITE_PAGE_KEYS = ['about', 'support', 'community'] as const;
export type SitePageKey = (typeof SITE_PAGE_KEYS)[number];

export interface SitePageSettings {
	key: SitePageKey;
	title: string;
	intro: string;
	content: string;
	data: SitePageData;
}

export type Translator = typeof translators.$inferSelect & { links: SiteSocialLink[] };

const DEFAULT_DEVELOPERS = [
	{
		enabled: true,
		userId: '',
		name: 'megared',
		role: 'Software Engineer',
		description:
			'Первоначальный разработчик сайта, который начал его развивать и продолжает это делать.',
		links: [{ enabled: true, type: 'github' as const, url: 'https://github.com/megaredb' }]
	},
	{
		enabled: true,
		userId: '',
		name: 'mk-rn',
		role: 'Software Engineer',
		description:
			'Разработчик сайта, подсоединившийся к разработке спустя короткое время после релиза первой версии. Активно помогает в разработке и наполняет сайт контентом.',
		links: [{ enabled: true, type: 'github' as const, url: 'https://github.com/mk-rn' }]
	}
];

const DEFAULT_COMMUNITY_LINKS = [
	{
		enabled: true,
		title: 'VKontakte',
		description: 'Официальная группа ВКонтакте',
		url: 'https://vk.com/hedgehoginc',
		icon: 'vk' as const
	},
	{
		enabled: true,
		title: 'Telegram — Overlord',
		description: 'Канал по аудиокниге Overlord (Владыка)',
		url: 'https://t.me/hedgehogincoverlord',
		icon: 'telegram' as const
	},
	{
		enabled: true,
		title: 'Telegram — Mushoku Tensei',
		description: 'Канал по аудиокниге Реинкарнация безработного',
		url: 'https://t.me/Mushoku_Tensei_AudioBook',
		icon: 'telegram' as const
	},
	{
		enabled: true,
		title: 'Discord',
		description: 'Сервер для живого общения и обсуждений',
		url: 'https://discord.gg/5dwmqrEwx',
		icon: 'discord' as const
	},
	{
		enabled: true,
		title: 'Boosty',
		description: 'Ранний доступ, эксклюзивы и поддержка автора',
		url: DEFAULT_BOOSTY_URL,
		icon: 'boosty' as const
	}
];

const DEFAULT_BENEFITS = [
	{
		enabled: true,
		title: 'Уведомления',
		description: 'Получайте уведомления о новых главах и обновлениях',
		icon: 'bell' as const
	},
	{
		enabled: true,
		title: 'Общение',
		description: 'Общайтесь с другими слушателями и делитесь мнениями',
		icon: 'message' as const
	},
	{
		enabled: true,
		title: 'Эксклюзивы',
		description: 'Доступ к эксклюзивному контенту и бонусам',
		icon: 'sparkles' as const
	}
];

const DEFAULT_SUPPORT = DEFAULT_SUPPORT_SETTINGS;

export const SITE_PAGE_DEFAULTS: Record<SitePageKey, SitePageSettings> = {
	about: {
		key: 'about',
		title: 'О сайте',
		intro:
			'Добро пожаловать на сайт HEDGEHOG.INC! Здесь вы можете послушать различные аудиокниги: Реинкарнация безработного, Повелитель.',
		content:
			'Автор всех аудиокниг на сайте, проводящий колоссальную работу по их озвучке и редактированию.',
		data: {
			feedbackUrl: DEFAULT_FEEDBACK_URL,
			authorEnabled: true,
			authorName: 'HEDGEHOG.INC',
			authorLogoUrl: '/logo-full.webp',
			developers: DEFAULT_DEVELOPERS
		}
	},
	support: {
		key: 'support',
		title: 'Поддержать автора',
		intro:
			'Ваша поддержка напрямую помогает выпускать новые главы быстрее, оплачивать студийное оборудование и развивать проект.',
		content: '',
		data: { support: DEFAULT_SUPPORT }
	},
	community: {
		key: 'community',
		title: 'Сообщество',
		intro:
			'Хотите узнать больше об авторе? Подпишитесь на социальные сети и будьте в курсе всех новостей!',
		content: '',
		data: { communityLinks: DEFAULT_COMMUNITY_LINKS, benefits: DEFAULT_BENEFITS }
	}
};

export function isSitePageKey(value: string): value is SitePageKey {
	return (SITE_PAGE_KEYS as readonly string[]).includes(value);
}

function string(value: unknown, maxLength = 4000): string {
	return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function sanitizeHttpUrl(
	raw: unknown,
	opts?: { allowTg?: boolean; allowRelative?: boolean }
): string {
	if (typeof raw !== 'string') return '';
	const value = raw.trim().slice(0, 1024);
	if (!value) return '';
	if (
		opts?.allowRelative &&
		value.startsWith('/') &&
		!value.startsWith('//') &&
		!value.startsWith('/\\')
	) {
		return value;
	}
	try {
		const parsed = new URL(value);
		if (
			parsed.protocol === 'http:' ||
			parsed.protocol === 'https:' ||
			(opts?.allowTg && parsed.protocol === 'tg:')
		) {
			return value;
		}
		return '';
	} catch {
		return '';
	}
}

export function normalizeSocialLinks(value: unknown, legacyUrl?: string | null): SiteSocialLink[] {
	const raw = Array.isArray(value) ? value : [];
	const links = raw.slice(0, 30).flatMap((item) => {
		const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
		const url = sanitizeHttpUrl(row.url);
		if (!url) return [];
		const type = string(row.type, 32);
		const allowed: SocialIconType[] = ['vk', 'telegram', 'discord', 'boosty', 'github', 'website'];
		return [
			{
				enabled: row.enabled !== false,
				type: allowed.includes(type as SocialIconType)
					? (type as SocialIconType)
					: detectSocialType(url),
				url
			}
		];
	});
	const safeLegacyUrl = sanitizeHttpUrl(legacyUrl);
	if (links.length === 0 && safeLegacyUrl) {
		return [{ enabled: true, type: detectSocialType(safeLegacyUrl), url: safeLegacyUrl }];
	}
	return links;
}

export function setDeveloperAccount(
	developers: SitePerson[],
	userId: string,
	name: string,
	remove = false
): SitePerson[] {
	const next = developers.map((developer) => ({ ...developer }));
	const linked = next.find((developer) => developer.userId === userId);
	if (remove) {
		if (linked) linked.userId = '';
		return next;
	}
	if (linked) return next;
	next.push({
		enabled: true,
		userId,
		name,
		role: 'Разработчик',
		description: '',
		links: []
	});
	return next;
}

function normalizePeople(value: unknown) {
	return (Array.isArray(value) ? value : []).slice(0, 50).map((item) => {
		const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
		return {
			enabled: row.enabled !== false,
			userId: string(row.userId, 255),
			name: string(row.name, 255),
			role: string(row.role, 120),
			description: string(row.description, 2000),
			links: normalizeSocialLinks(row.links, typeof row.url === 'string' ? row.url : null)
		};
	});
}

function normalizeLinks(value: unknown) {
	return (Array.isArray(value) ? value : []).slice(0, 50).map((item) => {
		const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
		const icon = string(row.icon, 32);
		return {
			enabled: row.enabled !== false,
			title: string(row.title, 255),
			description: string(row.description, 1000),
			url: sanitizeHttpUrl(row.url),
			icon: ['vk', 'telegram', 'discord', 'boosty', 'website'].includes(icon)
				? (icon as 'vk' | 'telegram' | 'discord' | 'boosty' | 'website')
				: 'website'
		};
	});
}

function normalizeBenefits(value: unknown) {
	return (Array.isArray(value) ? value : []).slice(0, 20).map((item) => {
		const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
		const icon = string(row.icon, 32);
		return {
			enabled: row.enabled !== false,
			title: string(row.title, 255),
			description: string(row.description, 1000),
			icon: ['bell', 'message', 'sparkles'].includes(icon)
				? (icon as 'bell' | 'message' | 'sparkles')
				: 'sparkles'
		};
	});
}

function normalizeBankCards(value: unknown) {
	return (Array.isArray(value) ? value : []).slice(0, 20).map((item) => {
		const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
		return {
			enabled: row.enabled !== false,
			brand: string(row.brand, 120) || 'HEDGEHOG.INC',
			label: string(row.label, 120),
			number: formatCardNumber(string(row.number, 64)),
			payUrl: sanitizeHttpUrl(row.payUrl),
			qrUrl: sanitizeHttpUrl(row.qrUrl, { allowRelative: true }),
			colorFrom: /^#[0-9a-fA-F]{6}$/.test(string(row.colorFrom, 7))
				? string(row.colorFrom, 7)
				: '#0f172a',
			colorTo: /^#[0-9a-fA-F]{6}$/.test(string(row.colorTo, 7)) ? string(row.colorTo, 7) : '#312e81'
		};
	});
}

function normalizeWallets(value: unknown, legacyAddress?: unknown, legacyQr?: unknown) {
	const source = Array.isArray(value) ? value : [];
	const wallets = source.slice(0, 20).flatMap((item) => {
		const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
		const address = string(row.address, 255);
		if (!address) return [];
		const rawNetwork = string(row.network, 24);
		const networkMap: Record<string, 'ton' | 'ethereum' | 'bitcoin' | 'tron'> = {
			ton: 'ton',
			ethereum: 'ethereum',
			bitcoin: 'bitcoin',
			tron: 'tron',
			eth: 'ethereum',
			btc: 'bitcoin',
			usdt: 'tron'
		};
		const network = networkMap[rawNetwork] ?? 'ton';
		const allowedCoins = CRYPTO_NETWORK_COINS[network];
		let coins = (Array.isArray(row.coins) ? row.coins : [])
			.map((coin) => string(coin, 16))
			.filter((coin) => (allowedCoins as readonly string[]).includes(coin));
		if (coins.length === 0) {
			coins = [rawNetwork === 'usdt' ? 'usdt' : allowedCoins[0]];
		}
		return [
			{
				enabled: row.enabled !== false,
				network,
				coins: [...new Set(coins)] as ('ton' | 'eth' | 'btc' | 'usdt' | 'trx' | 'xaut')[],
				address,
				qrUrl: sanitizeHttpUrl(row.qrUrl, { allowRelative: true })
			}
		];
	});
	if (wallets.length === 0 && typeof legacyAddress === 'string' && legacyAddress.trim()) {
		return [
			{
				enabled: true,
				network: 'ton' as const,
				coins: ['ton' as const],
				address: legacyAddress.trim().slice(0, 255),
				qrUrl: sanitizeHttpUrl(legacyQr, { allowRelative: true })
			}
		];
	}
	return wallets;
}

function normalizeSupport(value: unknown) {
	const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	const cards = Array.isArray(row.cards)
		? normalizeBankCards(row.cards)
		: row.cardNumber !== undefined
			? normalizeBankCards([
					{
						enabled: true,
						brand: 'HEDGEHOG.INC',
						label: 'Банковская карта',
						number: row.cardNumber,
						payUrl: row.cardUrl,
						qrUrl: row.cardQrUrl,
						colorFrom: '#0f172a',
						colorTo: '#312e81'
					}
				])
			: DEFAULT_SUPPORT_SETTINGS.cards;
	return {
		boostyEnabled: row.boostyEnabled !== false,
		boostyUrl: sanitizeHttpUrl(row.boostyUrl),
		boostyTitle: string(row.boostyTitle, 255),
		boostyDescription: string(row.boostyDescription, 1000),
		cards,
		wallets: normalizeWallets(row.wallets, row.tonAddress, row.tonQrUrl),
		telegramWalletEnabled: row.telegramWalletEnabled === true,
		telegramWalletAddress: string(row.telegramWalletAddress, 255)
	};
}

export function normalizeSitePageData(key: SitePageKey, input: unknown): SitePageData {
	const defaults = SITE_PAGE_DEFAULTS[key].data;
	const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
	if (key === 'about') {
		return {
			feedbackUrl: sanitizeHttpUrl(source.feedbackUrl, { allowTg: true }) || defaults.feedbackUrl,
			authorEnabled: source.authorEnabled !== false,
			authorName: string(source.authorName, 255) || defaults.authorName,
			authorLogoUrl:
				sanitizeHttpUrl(source.authorLogoUrl, { allowRelative: true }) || defaults.authorLogoUrl,
			developers:
				source.developers === undefined ? defaults.developers : normalizePeople(source.developers)
		};
	}
	if (key === 'support') {
		return {
			support: source.support === undefined ? defaults.support : normalizeSupport(source.support)
		};
	}
	return {
		communityLinks:
			source.communityLinks === undefined
				? defaults.communityLinks
				: normalizeLinks(source.communityLinks),
		benefits: source.benefits === undefined ? defaults.benefits : normalizeBenefits(source.benefits)
	};
}

export function defaultSitePage(key: SitePageKey): SitePageSettings {
	return structuredClone(SITE_PAGE_DEFAULTS[key]);
}

export async function loadSitePage(key: SitePageKey): Promise<SitePageSettings> {
	const [row] = await db.select().from(sitePages).where(eq(sitePages.key, key)).limit(1);
	if (!row) return defaultSitePage(key);
	return {
		key,
		title: row.title,
		intro: row.intro,
		content: row.content,
		data: normalizeSitePageData(key, row.data)
	};
}

export async function loadSitePages(): Promise<Record<SitePageKey, SitePageSettings>> {
	const rows = await db.select().from(sitePages);
	const byKey = new Map(rows.map((row) => [row.key, row]));
	return Object.fromEntries(
		SITE_PAGE_KEYS.map((key) => {
			const row = byKey.get(key);
			return [
				key,
				row
					? {
							key,
							title: row.title,
							intro: row.intro,
							content: row.content,
							data: normalizeSitePageData(key, row.data)
						}
					: defaultSitePage(key)
			];
		})
	) as Record<SitePageKey, SitePageSettings>;
}

export async function loadTranslators(): Promise<Translator[]> {
	const rows = await db
		.select()
		.from(translators)
		.orderBy(asc(translators.sortOrder), asc(translators.createdAt));
	return rows.map((row) => ({
		...row,
		links: normalizeSocialLinks(row.links, row.url)
	}));
}
