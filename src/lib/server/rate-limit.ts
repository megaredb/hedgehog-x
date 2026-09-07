/**
 * Простой in-memory rate limiter (фиксированное окно).
 *
 * Используется для защиты мутирующих эндпоинтов Boosty-входа
 * (`/api/boosty/send-code`, `/api/boosty/confirm-code`) от спама SMS
 * и перебора кода подтверждения.
 *
 * Важно: счётчики живут в памяти текущего процесса — при рестарте или
 * горизонтальном масштабировании (несколько инстансов) они сбрасываются.
 * Для продакшена с несколькими репликами нужен Redis (см. навык `cache`).
 *
 * Модуль намеренно НЕ импортирует `$env/dynamic/private` и `src/lib/server/config`
 * — чтобы оставаться покрываемым unit-тестами (`pnpm test:unit` запускает
 * файл через `tsx` без SvelteKit-алиасов).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function pruneIfNeeded(now: number): void {
	if (buckets.size <= MAX_BUCKETS) return;
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) buckets.delete(key);
	}
}

/**
 * Проверяет лимит для ключа и регистрирует текущую попытку.
 * При превышении лимита возвращает `ok: false` и число секунд до сброса окна.
 */
export function checkRateLimit(
	key: string,
	limit: number,
	windowMs: number
): { ok: boolean; retryAfterSec: number } {
	const now = Date.now();
	pruneIfNeeded(now);

	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return { ok: true, retryAfterSec: 0 };
	}

	if (bucket.count >= limit) {
		return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
	}

	bucket.count += 1;
	return { ok: true, retryAfterSec: 0 };
}

/** Только для тестов: очищает все счётчики. */
export function resetRateLimits(): void {
	buckets.clear();
}

// ─── Лимиты входа Boosty ─────────────────────────────────────────────────────

export const SEND_CODE_RATE_LIMIT = {
	windowMs: 15 * 60 * 1000, // 15 минут
	phoneLimit: 3, // SMS на один номер в окне
	ipLimit: 10 // запросов с одного IP в окне
} as const;

export const CONFIRM_CODE_RATE_LIMIT = {
	windowMs: 15 * 60 * 1000, // 15 минут
	phoneLimit: 5, // попыток подтверждения на один номер в окне
	ipLimit: 20 // попыток с одного IP в окне
} as const;

/**
 * Проверяет лимиты шага входа Boosty сразу по двум ключам (номер + IP).
 * Возвращает `ok: false` при превышении любого из них.
 */
export function checkRateLimitGroup(
	scope: 'send-code' | 'confirm-code',
	phone: string,
	ip: string
): { ok: boolean; retryAfterSec: number } {
	const config = scope === 'send-code' ? SEND_CODE_RATE_LIMIT : CONFIRM_CODE_RATE_LIMIT;
	const phoneResult = checkRateLimit(`${scope}:phone:${phone}`, config.phoneLimit, config.windowMs);
	if (!phoneResult.ok) return phoneResult;
	return checkRateLimit(`${scope}:ip:${ip}`, config.ipLimit, config.windowMs);
}
