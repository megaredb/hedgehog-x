import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { sendPhoneCode, normalizePhone, isE164Phone } from '$lib/server/boosty/phone-client';
import { checkRateLimitGroup } from '$lib/server/rate-limit';

/**
 * POST /api/boosty/send-code
 * Отправляет SMS-код входа на номер Boosty.
 *
 * Тело: { phone: string }
 * Ответ: { deviceId, verifyToken, sentTransport } или { error, status: 4xx/5xx }.
 *
 * deviceId генерируется на сервере и возвращается клиенту: он же
 * используется в confirm-code (как _clientId у фронта Boosty).
 */

export const POST = async ({ request, getClientAddress }) => {
	let body: { phone?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}
	// Нормализуем ДО валидации и rate-limit-ключа: '+7 999 123-45-67' и
	// '+79991234567' должны считаться одним номером (канонический E.164).
	const phone = normalizePhone(body?.phone);
	if (!isE164Phone(phone)) {
		return json({ error: 'Введите корректный номер телефона' }, { status: 400 });
	}

	const limit = checkRateLimitGroup('send-code', phone, getClientAddress());
	if (!limit.ok) {
		return json(
			{ error: 'Слишком много запросов. Попробуйте позже.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
		);
	}

	try {
		const deviceId = randomUUID();
		const result = await sendPhoneCode(phone, deviceId);
		return json({
			ok: true,
			deviceId,
			verifyToken: result.verifyToken,
			sentTransport: result.sentTransport
		});
	} catch (e) {
		// Сбой Boosty (недоступен/отклонил запрос) — это ошибка апстрима (502),
		// а не некорректный запрос клиента (400).
		console.error('[boosty/send-code] failed', e);
		return json({ error: 'Не удалось отправить код. Попробуйте позже.' }, { status: 502 });
	}
};
