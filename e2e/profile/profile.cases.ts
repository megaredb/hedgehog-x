/**
 * Data-driven кейсы для тестов профиля.
 *
 * Массивы — это ДАННЫЕ (пользователь/аккаунты/тело подписки + ожидания), а не
 * логика. Тесты в profile.e2e.ts прокручивают их циклом `for (const c of cases)
 * test(...)` и подставляют данные в тело (pytest-стиль параметризации).
 *
 * Базовый юзер/аккаунты берутся из e2e/fixtures/data.ts, чтобы не дублировать
 * общие мок-записи.
 */

import { BOOSTY_BLOG_PUBLIC_URL } from '../../src/lib/constants';
import {
	DISCORD_ACCOUNT,
	TELEGRAM_ACCOUNT,
	type MockLinkedAccount,
	type MockUser
} from '../fixtures/data';

// ─── «Последний вход» в карточке профиля ──────────────────────────────────────

export interface LastLoginCase {
	/** slug кейса (для имени теста). */
	id: string;
	/** Человекочитаемая платформа последнего входа (или '' если строки нет). */
	providerLabel: string;
	/** Переопределения полей user поверх MOCK_USER (для мока get-session). */
	userFields: Partial<MockUser>;
	/** Должна ли присутствовать строка «Последний вход: …». */
	expectLastLogin: boolean;
}

const TG_AVATAR = 'https://t.me/i/userpic/320/hedgehog_test.jpg';
const DC_AVATAR = 'https://cdn.discordapp.com/avatars/987654321/a1b2c3.webp';

/**
 * Все ветки последнего входа: три провайдера (Telegram/Discord/Boosty) +
 * негативные (поле lastLoginProvider не задано → строки нет; значение не
 * соответствует ни одному известному провайдеру → строки нет). Провайдер
 * теперь хранится явно в user.lastLoginProvider (см. auth.ts / complete-flow.ts),
 * а не выводится из сравнения user.image с аватарами платформ.
 */
export const lastLoginCases: LastLoginCase[] = [
	{
		id: 'telegram',
		providerLabel: 'Telegram',
		userFields: { lastLoginProvider: 'telegram-oidc' },
		expectLastLogin: true
	},
	{
		id: 'discord',
		providerLabel: 'Discord',
		userFields: { lastLoginProvider: 'discord' },
		expectLastLogin: true
	},
	{
		id: 'boosty',
		providerLabel: 'Boosty',
		userFields: { lastLoginProvider: 'boosty' },
		expectLastLogin: true
	},
	{
		id: 'no-field',
		providerLabel: '',
		userFields: {},
		expectLastLogin: false
	},
	{
		id: 'unknown-provider',
		providerLabel: '',
		userFields: { lastLoginProvider: 'github' },
		expectLastLogin: false
	}
];

// ─── Аватар в карточке профиля (img vs иконка-заглушка) ───────────────────────

export interface CardAvatarCase {
	id: string;
	/** image у юзера (null → иконка вместо <img>). */
	image: string | null;
	/** Чего ждём в карточке: <img> или svg-иконка. */
	kind: 'img' | 'icon';
}

export const cardAvatarCases: CardAvatarCase[] = [
	{ id: 'img', image: TG_AVATAR, kind: 'img' },
	{ id: 'icon', image: null, kind: 'icon' }
];

// ─── Ветки строки способа входа (аватар + подпись) ────────────────────────────

export type RowAvatarKind = 'img' | 'initial' | 'icon';

export interface ProviderRowCase {
	id: string;
	providerId: string;
	account: MockLinkedAccount;
	userFields: Partial<MockUser>;
	/** Как отрисован аватар платформы в строке. */
	avatar: RowAvatarKind;
	/** src у <img>, когда avatar === 'img'. */
	imgSrc?: string;
	/** буква-инициал, когда avatar === 'initial'. */
	initialChar?: string;
	/** Ожидаемая подпись строки (полный текст нижнего <p>). */
	subtitle: string;
}

/**
 * Ветки аватара привязанного способа:
 *  - img: есть аватар платформы → <img src>;
 *  - initial: аватара нет, но есть username → кружок с первой буквой username;
 *  - icon: ни аватара, ни username → фирменная иконка провайдера.
 * Плюс варианты подписи: «@username · ID», «Имя · ID», «ID …».
 * Используются Telegram/Discord (не трогают блок подписки Boosty).
 */
export const providerRowCases: ProviderRowCase[] = [
	{
		id: 'telegram-avatar-img',
		providerId: 'telegram-oidc',
		account: TELEGRAM_ACCOUNT,
		userFields: { telegramAvatar: TG_AVATAR, telegramOidcUsername: 'hedgehog_test', image: null },
		avatar: 'img',
		imgSrc: TG_AVATAR,
		subtitle: '@hedgehog_test · ID 123456789'
	},
	{
		id: 'telegram-initial',
		providerId: 'telegram-oidc',
		account: TELEGRAM_ACCOUNT,
		userFields: { telegramOidcUsername: 'hedgehog_test', telegramAvatar: null, image: null },
		avatar: 'initial',
		initialChar: 'H',
		subtitle: '@hedgehog_test · ID 123456789'
	},
	{
		id: 'telegram-icon-no-username',
		providerId: 'telegram-oidc',
		account: TELEGRAM_ACCOUNT,
		userFields: { telegramOidcUsername: null, telegramAvatar: null, image: null },
		avatar: 'icon',
		// Нет username/аватара → фолбэк-имя (первое слово user.name «Еж Тестовый» → «Еж»).
		subtitle: 'Еж · ID 123456789'
	},
	{
		id: 'discord-avatar-img-username',
		providerId: 'discord',
		account: DISCORD_ACCOUNT,
		userFields: { discordAvatar: DC_AVATAR, discordUsername: 'hog_discord', image: null },
		avatar: 'img',
		imgSrc: DC_AVATAR,
		subtitle: '@hog_discord · ID 987654321'
	},
	{
		id: 'discord-icon-no-username-name',
		providerId: 'discord',
		account: DISCORD_ACCOUNT,
		userFields: { discordUsername: null, discordAvatar: null, image: null },
		avatar: 'icon',
		subtitle: 'Еж · ID 987654321'
	}
];

/**
 * Непривязанные способы (нет записи в list-accounts): фирменная иконка +
 * описание провайдера + кнопка «Привязать». Описания сверены с providers.ts.
 */
export interface UnlinkedRowCase {
	providerId: string;
	label: string;
	description: string;
}

export const unlinkedRowCases: UnlinkedRowCase[] = [
	{ providerId: 'discord', label: 'Discord', description: 'Вход через Discord' },
	{ providerId: 'boosty', label: 'Boosty', description: 'Вход через Boosty' }
];

// ─── Подписка HEDGEHOG.INC в Boosty ──────────────────────────────────────────

export interface SubscriptionBody {
	linked: boolean;
	subscribed: boolean;
	levelName: string | null;
	priceRub: number | null;
	periodMonths: number | null;
	nextPayTime: number | null;
	onTime: number | null;
	isFeePaid: boolean;
	isPaused: boolean;
	error: string | null;
}

export interface SubscriptionCase {
	id: string;
	body: SubscriptionBody;
	/** Подстроки, которые ДОЛЖНЫ быть в секции подписки. */
	expect: string[];
	/** Подстроки, которых быть НЕ должно. */
	notExpect: string[];
	/** Ожидаемый href ссылки «Оформить на boosty.to» (для неактивной подписки). */
	boostyLink?: string;
}

/** Будущий момент времени (unix-сек) для nextPayTime — фиксирован для стабильности. */
const NEXT_PAY = 1893456000; // ~2030-01-01

/** Неактивная подписка (со ссылкой на оформление). */
export const noSubscriptionCase: SubscriptionCase = {
	id: 'not-subscribed',
	body: {
		linked: true,
		subscribed: false,
		levelName: null,
		priceRub: null,
		periodMonths: null,
		nextPayTime: null,
		onTime: null,
		isFeePaid: true,
		isPaused: false,
		error: null
	},
	expect: ['Активной подписки на HEDGEHOG.INC нет.'],
	notExpect: ['Действует до'],
	boostyLink: BOOSTY_BLOG_PUBLIC_URL
};

/**
 * Активные подписки: обычная, «приостановлена + оплата ожидается + действует
 * до», и минимальная (без названия уровня/цены/даты → «—»).
 */
export const subscriptionActiveCases: SubscriptionCase[] = [
	{
		id: 'active-full',
		body: {
			linked: true,
			subscribed: true,
			levelName: 'ПОВЕЛИТЕЛЬ!',
			priceRub: 2000,
			periodMonths: 1,
			nextPayTime: NEXT_PAY,
			onTime: NEXT_PAY - 2592000,
			isFeePaid: true,
			isPaused: false,
			error: null
		},
		expect: ['ПОВЕЛИТЕЛЬ!', '2 000', '/ 1 мес', 'Действует до'],
		notExpect: ['Подписка приостановлена', 'Оплата ожидается']
	},
	{
		id: 'active-paused-fee-pending-until',
		body: {
			linked: true,
			subscribed: true,
			levelName: 'ПРОФИ',
			priceRub: 600,
			periodMonths: 1,
			nextPayTime: NEXT_PAY,
			onTime: NEXT_PAY - 2592000,
			isFeePaid: false,
			isPaused: true,
			error: null
		},
		expect: ['Подписка приостановлена', 'Оплата ожидается', 'Действует до'],
		notExpect: []
	},
	{
		id: 'active-minimal-no-price',
		body: {
			linked: true,
			subscribed: true,
			levelName: null,
			priceRub: null,
			periodMonths: null,
			nextPayTime: null,
			onTime: null,
			isFeePaid: true,
			isPaused: false,
			error: null
		},
		expect: ['—'],
		notExpect: ['Действует до', 'Оплата ожидается', 'Подписка приостановлена']
	}
];
