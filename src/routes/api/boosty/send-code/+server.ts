import { json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { sendPhoneCode } from '$lib/server/boosty/phone-client';

/**
 * POST /api/boosty/send-code
 * Отправляет SMS-код входа на номер Boosty.
 *
 * Тело: { phone: string }
 * Ответ: { deviceId, verifyToken, sentTransport } или { error, status: 4xx }.
 *
 * deviceId генерируется на сервере и возвращается клиенту: он же
 * используется в confirm-code (как _clientId у фронта Boosty).
 */
export const POST = async ({ request }) => {
	let body: { phone?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}
	const phone = body?.phone?.trim();
	if (!phone || !/^\+?[0-9]{10,15}$/.test(phone)) {
		return json({ error: 'Введите корректный номер телефона' }, { status: 400 });
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
		const msg = e instanceof Error ? e.message : String(e);
		// Ошибки Boosty: "denied_phone_registration", rate-limit и т.п.
		return json({ error: msg }, { status: 400 });
	}
};
