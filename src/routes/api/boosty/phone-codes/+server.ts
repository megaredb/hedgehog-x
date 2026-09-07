import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { boostyHeaders } from '$lib/server/boosty/phone-client';
import { BOOSTY_ENDPOINTS } from '$lib/server/config';

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
export const GET = async () => {
	try {
		const deviceId = randomUUID();
		const res = await fetch(BOOSTY_ENDPOINTS.phoneCodes, {
			headers: boostyHeaders(deviceId)
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
