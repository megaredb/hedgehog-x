import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { boostyHeaders } from '$lib/server/boosty/phone-client';
import { BOOSTY_ENDPOINTS, BOOSTY_FETCH_TIMEOUT_MS } from '$lib/server/config';
import { checkRateLimit, PHONE_CODES_RATE_LIMIT } from '$lib/server/rate-limit';

/**
 * GET /api/boosty/phone-codes
 * Проксирует список кодов стран для формы входа по телефону.
 *
 * Источник — сам Boosty (https://boosty.to/app/extra-config/phone-codes):
 * браузер юзера не может ходить на boosty.to напрямую (CORS), поэтому
 * данные тянет сервер и отдаёт без изменений. По ТЗ данные берём КАЖДЫЙ
 * раз из API Boosty (не хардкодим и не кэшируем на сервере).
 *
 * Ответ: { phoneCodes: Array<{ name: string; dialCode: string; code: string; mask?: string }> }
 */
export const GET = async ({ getClientAddress }) => {
	const limit = checkRateLimit(
		`phone-codes:ip:${getClientAddress()}`,
		PHONE_CODES_RATE_LIMIT.ipLimit,
		PHONE_CODES_RATE_LIMIT.windowMs
	);
	if (!limit.ok) {
		return json(
			{ error: 'Слишком много запросов. Попробуйте позже.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
		);
	}

	try {
		const deviceId = randomUUID();
		const res = await fetch(BOOSTY_ENDPOINTS.phoneCodes, {
			headers: boostyHeaders(deviceId),
			signal: AbortSignal.timeout(BOOSTY_FETCH_TIMEOUT_MS)
		});
		if (!res.ok) {
			return json({ error: 'Boosty phone-codes: HTTP ' + res.status }, { status: 502 });
		}
		const data = (await res.json()) as {
			phoneCodes?: Array<{ name?: string; dialCode?: string; code?: string; mask?: string }>;
		};
		const phoneCodes = (data.phoneCodes ?? [])
			.filter((c) => c?.code && c?.dialCode && c?.name)
			.map((c) => ({
				name: c.name as string,
				dialCode: c.dialCode as string,
				code: c.code as string,
				mask: c.mask
			}));
		return json({ phoneCodes });
	} catch (e) {
		console.error('[boosty/phone-codes] failed', e);
		return json({ error: 'Не удалось загрузить список кодов стран' }, { status: 502 });
	}
};
