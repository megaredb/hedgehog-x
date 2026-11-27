export type MirrorAutoRole = 'default' | 'ru' | 'none';

export interface SiteMirror {
	id: string;
	label: string;
	description: string;
	host: string;
	enabled: boolean;
	autoRole: MirrorAutoRole;
}

export const DEFAULT_SITE_MIRRORS: SiteMirror[] = [
	{
		id: 'primary',
		label: 'Основной CDN',
		description: 'files.hedgehog-inc.one (глобальный Cloudflare R2)',
		host: 'files.hedgehog-inc.one',
		enabled: true,
		autoRole: 'default'
	},
	{
		id: 'ru',
		label: 'RU Прокси',
		description: 'ru-files.hedgehog-inc.one (прокси)',
		host: 'ru-files.hedgehog-inc.one',
		enabled: true,
		autoRole: 'ru'
	}
];

export type SocialIconType = 'vk' | 'telegram' | 'discord' | 'boosty' | 'github' | 'website';
export type SiteLinkIcon = Exclude<SocialIconType, 'github'>;

export interface SiteSocialLink {
	enabled: boolean;
	type: SocialIconType;
	url: string;
}

export interface SiteLink {
	enabled: boolean;
	title: string;
	description: string;
	url: string;
	icon: SiteLinkIcon;
}

export type SiteBenefitIcon = 'bell' | 'message' | 'sparkles';

export interface SiteBenefit {
	enabled: boolean;
	title: string;
	description: string;
	icon: SiteBenefitIcon;
}

export interface SitePerson {
	enabled: boolean;
	userId: string;
	name: string;
	role: string;
	description: string;
	links: SiteSocialLink[];
}

export interface SiteBankCard {
	enabled: boolean;
	brand: string;
	label: string;
	number: string;
	payUrl: string;
	qrUrl: string;
	colorFrom: string;
	colorTo: string;
}

export type CryptoNetwork = 'ton' | 'ethereum' | 'bitcoin' | 'tron';
export type CryptoCoin = 'ton' | 'eth' | 'btc' | 'usdt' | 'trx' | 'xaut';

export interface SiteCryptoWallet {
	enabled: boolean;
	network: CryptoNetwork;
	coins: CryptoCoin[];
	address: string;
	qrUrl: string;
}

export interface SiteSupportSettings {
	boostyEnabled: boolean;
	boostyUrl: string;
	boostyTitle: string;
	boostyDescription: string;
	cards: SiteBankCard[];
	wallets: SiteCryptoWallet[];
	telegramWalletEnabled: boolean;
	telegramWalletAddress: string;
}

export interface SitePageData {
	feedbackUrl?: string;
	authorEnabled?: boolean;
	authorName?: string;
	authorLogoUrl?: string;
	developers?: SitePerson[];
	communityLinks?: SiteLink[];
	benefits?: SiteBenefit[];
	support?: SiteSupportSettings;
}

export const DEFAULT_BOOSTY_URL = 'https://boosty.to/hedgehoginc';
export const DEFAULT_FEEDBACK_URL = 'https://t.me/hedgehoginc';

export const DEFAULT_SUPPORT_SETTINGS: SiteSupportSettings = {
	boostyEnabled: true,
	boostyUrl: DEFAULT_BOOSTY_URL,
	boostyTitle: 'Boosty',
	boostyDescription: 'Ежемесячная подписка и донаты',
	cards: [
		{
			enabled: true,
			brand: 'HEDGEHOG.INC',
			label: 'Сбербанк',
			number: '4817 7603 3434 7832',
			payUrl: 'https://messenger.online.sberbank.ru/sl/2zRK0Js6nn0sbAhuy',
			qrUrl: '/qr/bank-qr.svg',
			colorFrom: '#0f172a',
			colorTo: '#312e81'
		}
	],
	wallets: [
		{
			enabled: true,
			network: 'ton',
			coins: ['ton'],
			address: 'UQDoqpcudSDCZGqKWCoLDT008_BNhSKBUao_G5MZR9jcpf-i',
			qrUrl: '/qr/ton-qr.svg'
		}
	],
	telegramWalletEnabled: false,
	telegramWalletAddress: ''
};

export function detectSocialType(url: string): SocialIconType {
	const value = url.toLowerCase();
	if (value.includes('github.com')) return 'github';
	if (value.includes('vk.com')) return 'vk';
	if (value.includes('t.me') || value.includes('telegram')) return 'telegram';
	if (value.includes('discord')) return 'discord';
	if (value.includes('boosty.to')) return 'boosty';
	return 'website';
}
export const CRYPTO_NETWORK_COINS: Record<CryptoNetwork, CryptoCoin[]> = {
	ton: ['ton', 'usdt', 'xaut'],
	ethereum: ['eth', 'usdt', 'xaut'],
	bitcoin: ['btc'],
	tron: ['trx', 'usdt', 'xaut']
};

export const CRYPTO_NETWORK_LABELS: Record<CryptoNetwork, string> = {
	ton: 'TON',
	ethereum: 'Ethereum',
	bitcoin: 'Bitcoin',
	tron: 'Tron'
};

export const CRYPTO_COIN_LABELS: Record<CryptoCoin, string> = {
	ton: 'GRAM',
	eth: 'ETH',
	btc: 'BTC',
	usdt: 'USDT',
	trx: 'TRX',
	xaut: 'XAUT'
};

export function formatCardNumber(value: string): string {
	const digits = value.replace(/\D/g, '').slice(0, 19);
	return digits.replace(/(.{4})/g, '$1 ').trim();
}
export const CRYPTO_NETWORK_COLORS: Record<
	CryptoNetwork,
	{ from: string; to: string; accent: string; card: string }
> = {
	ton: { from: '#0098EA', to: '#0066B3', accent: '#66D9FF', card: '#DCEEEB' },
	ethereum: { from: '#627EEA', to: '#3B4DB3', accent: '#AAB8FF', card: '#E8E1F2' },
	bitcoin: { from: '#F7931A', to: '#B35F00', accent: '#FFD18A', card: '#F5E9D6' },
	tron: { from: '#FF060A', to: '#B30003', accent: '#FF9A9C', card: '#F3DFDF' }
};
