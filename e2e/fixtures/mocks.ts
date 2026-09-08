/**
 * Переиспользуемые моки API через page.route.
 *
 * Все хелперы работают по принципу «последний зарегистрированный route побеждает»:
 * тест может зарегистрировать свой обработчик поверх (например, перехватить
 * send-code и запомнить тело запроса) — Playwright разбирает их в порядке,
 * обратном регистрации.
 */

import type { Page } from '@playwright/test';
import {
	MOCK_CATALOG,
	PHONE_CODES,
	type MockBook,
	type MockBookDetail,
	type MockLinkedAccount,
	type MockSession,
	type MockUser,
	type SessionPayload
} from './data';

const JSON_HEADERS = { contentType: 'application/json' } as const;

// ─── Сессия и аккаунты ────────────────────────────────────────────────────────

/**
 * Мок GET /api/auth/get-session.
 * body = null → гость (лучше-auth так отвечает без session-cookie);
 * body = { user, session } → залогиненный пользователь.
 */
export async function mockGetSession(page: Page, body: SessionPayload): Promise<void> {
	await page.route('**/api/auth/get-session', (route) =>
		route.fulfill({ status: 200, ...JSON_HEADERS, body: JSON.stringify(body) })
	);
}

/** Мок GET /api/auth/list-accounts — массив привязанных способов входа. */
export async function mockListAccounts(page: Page, accounts: MockLinkedAccount[]): Promise<void> {
	await page.route('**/api/auth/list-accounts', (route) =>
		route.fulfill({ status: 200, ...JSON_HEADERS, body: JSON.stringify(accounts) })
	);
}

// ─── Каталог ───────────────────────────────────────────────────────────────────

export interface MockCatalogOptions {
	/** Книги для мока; по умолчанию — [MOCK_CATALOG]. */
	books?: MockBookDetail[];
}

/** Книга в списке GET /api/books — та же запись, но без вложенных томов. */
function toBookListItem(book: MockBookDetail): MockBook {
	return {
		id: book.id,
		title: book.title,
		description: book.description,
		coverUrl: book.coverUrl,
		blurhash: book.blurhash,
		themeColor: book.themeColor,
		status: book.status,
		createdAt: book.createdAt,
		updatedAt: book.updatedAt
	};
}

/**
 * Мок каталога:
 *  - GET /api/books → список книг (без вложенностей);
 *  - GET /api/books/:bookId → полное дерево (книга + тома + главы + иллюстрации),
 *    404 для неизвестного id.
 * Синхронизация (syncService) работает с ETag, но мок всегда отвечает 200,
 * чтобы данные гарантированно гидратировались в Dexie.
 */
export async function mockCatalog(page: Page, options: MockCatalogOptions = {}): Promise<void> {
	const books = options.books && options.books.length > 0 ? options.books : [MOCK_CATALOG];
	const list = books.map(toBookListItem);

	await page.route('**/api/books', (route) =>
		route.fulfill({ status: 200, ...JSON_HEADERS, body: JSON.stringify(list) })
	);
	await page.route('**/api/books/*', async (route) => {
		const path = new URL(route.request().url()).pathname;
		const bookId = decodeURIComponent(path.slice('/api/books/'.length));
		const book = books.find((b) => b.id === bookId);
		if (book) {
			await route.fulfill({ status: 200, ...JSON_HEADERS, body: JSON.stringify(book) });
		} else {
			await route.fulfill({ status: 404, body: 'Not found' });
		}
	});
}

// ─── Boosty (телефон + SMS) ───────────────────────────────────────────────────

export interface MockBoostyOptions {
	/** Если задан и >= 400 — confirm-code отвечает ошибкой с этим статусом. */
	confirmStatus?: number;
	/** Сообщение ошибки confirm-code (по умолчанию 'Code is invalid'). */
	confirmError?: string;
}

/**
 * Мок флоу «Вход через Boosty»:
 *  - GET  /api/boosty/phone-codes  → { phoneCodes: PHONE_CODES };
 *  - POST /api/boosty/send-code    → { ok, deviceId, verifyToken, sentTransport };
 *  - POST /api/boosty/confirm-code → ошибка, только если задан confirmStatus >= 400.
 *
 * Успешный confirm-code здесь намеренно не мокается: тест, проверяющий
 * подтверждение кода, регистрирует собственный обработчик «поверх» и сам
 * захватывает тело запроса (см. boosty-login.e2e.ts) — так ассерты по телу
 * остаются в теле теста, а не внутри page.route-колбэка.
 */
export async function mockBoosty(page: Page, options: MockBoostyOptions = {}): Promise<void> {
	await page.route('**/api/boosty/phone-codes', (route) =>
		route.fulfill({
			status: 200,
			...JSON_HEADERS,
			body: JSON.stringify({ phoneCodes: PHONE_CODES })
		})
	);
	await page.route('**/api/boosty/send-code', (route) =>
		route.fulfill({
			status: 200,
			...JSON_HEADERS,
			body: JSON.stringify({
				ok: true,
				deviceId: 'device-123',
				verifyToken: 'verify-token-123',
				sentTransport: 'gate'
			})
		})
	);
	if (options.confirmStatus && options.confirmStatus >= 400) {
		await page.route('**/api/boosty/confirm-code', (route) =>
			route.fulfill({
				status: options.confirmStatus,
				...JSON_HEADERS,
				body: JSON.stringify({ error: options.confirmError ?? 'Code is invalid' })
			})
		);
	}
}

/**
 * Тело GET /api/boosty/subscription — форма HedgehogSubscriptionStatus
 * (см. src/lib/server/boosty/subscriptions.ts). Значения сверены с реальным
 * эндпоинтом и e2e/profile/profile.cases.ts.
 */
export interface BoostySubscriptionBody {
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

/**
 * Мок GET /api/boosty/subscription → 200 с заданным телом (статус подписки
 * HEDGEHOG.INC). Используется на /profile: подписка рендерится только когда
 * привязан boosty-аккаунт (см. mockListAccounts + BOOSTY_ACCOUNT).
 */
export async function mockBoostySubscription(
	page: Page,
	body: BoostySubscriptionBody
): Promise<void> {
	await page.route('**/api/boosty/subscription', (route) =>
		route.fulfill({ status: 200, ...JSON_HEADERS, body: JSON.stringify(body) })
	);
}

// ─── Аудиоплеер ────────────────────────────────────────────────────────────────

/**
 * «Герметичный» мок медиа-элемента: реальный медиа-пайплайн (сеть, декодер)
 * в e2e не задействуется вообще, а UI-состояние плеера (isPlaying и пр.) ведёт
 * audioStore — мок только эмулирует ключевые события, на которые завязан
 * audio-provider.
 *
 * Почему именно так:
 *  - htmlAudio._load() вызывает audio.pause() на неиграющем элементе перед
 *    сменой src. Нативный браузер НЕ шлёт 'pause', если элемент уже остановлен;
 *    эмуляция «всегда слать 'pause'» приводила к тому, что provider сбрасывал
 *    isPlaying=false в audio-store (гонка с автоплеем после загрузки трека).
 *    Поэтому pause() — no-op (элемент под моком никогда реально не играет).
 *  - Присваивание audio.src (preload=auto) всё равно запускает сетевую загрузку
 *    и декодирование → случайные media 'error' + ретраи htmlAudio. Чтобы этого
 *    избежать, src и load() становятся no-op: htmlAudio._load() не дожидается
 *    loadedmetadata/canplay (promise висит до таймаута), а isPlaying остаётся
 *    под контролем audioStore — детерминированно.
 *  - play() «стартует» без звука: резолвится и эмитит 'play'/'playing'.
 *  - currentTime всегда 0 (seek не двигает позицию), paused всегда true —
 *    тесты позиции/прогресса переопределяют их сами.
 */
export async function mockAudio(page: Page): Promise<void> {
	// Внимание: тело addInitScript исполняется в браузере — только чистый JS,
	// без TS-синтаксиса (Playwright сериализует функцию как есть).
	await page.addInitScript(() => {
		const proto = HTMLMediaElement.prototype;

		// Не запускаем сетевую загрузку и декодирование медиа.
		proto.load = function load() {
			/* no-op */
		};

		// Имитация старта воспроизведения: play() резолвится и «эмитит» события,
		// на которые завязан UI (audio-provider слушает 'play'/'playing').
		proto.play = function play() {
			this.dispatchEvent(new Event('play'));
			this.dispatchEvent(new Event('playing'));
			return Promise.resolve();
		};

		// pause() — no-op: элемент под моком никогда реально не играет, а эмит
		// 'pause' здесь (в т.ч. из audio.pause() внутри htmlAudio._load() при смене
		// трека) сбрасывал бы isPlaying в audio-store (гонка с автоплеем).
		// Состояние play/pause ведёт audioStore (togglePlay/play/pause).
		proto.pause = function pause() {
			/* no-op */
		};

		// src: присваивание не запускает реальную загрузку (см. выше).
		Object.defineProperty(proto, 'src', {
			configurable: true,
			get() {
				return '';
			},
			set() {
				/* no-op */
			}
		});

		// Seek: присваивание currentTime — no-op, чтобы позиция не прыгала
		// и не требовала загруженного аудиофайла. currentTime всегда 0.
		Object.defineProperty(proto, 'currentTime', {
			configurable: true,
			get() {
				return 0;
			},
			set() {
				/* seek без реального перехода */
			}
		});

		// paused всегда true — под моком реальное воспроизведение не идёт
		// (htmlAudio._play() при paused=true всегда вызывает play()).
		try {
			Object.defineProperty(proto, 'paused', {
				configurable: true,
				get() {
					return true;
				}
			});
		} catch {
			/* нативный paused и так true под моком */
		}
	});
}

// ─── Типы-помощники (переэкспорт для удобства) ───────────────────────────────

export type { MockBook, MockBookDetail, MockLinkedAccount, MockSession, MockUser, SessionPayload };
