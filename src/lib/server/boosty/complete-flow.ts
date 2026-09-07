import { db } from '$lib/server/db';
import { user, account, session } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { boostyEmail } from '$lib/server/boosty/token-utils';
import {
	ACCOUNT_ID_PREFIX,
	SESSION_ID_PREFIX,
	SESSION_TTL_MS,
	USER_ID_PREFIX
} from '$lib/server/config';

/**
 * Создание локальной сессии better-auth после входа/привязки Boosty.
 *
 * Boosty — не OAuth-провайдер: нет клиентского redirect-кода. Мы получаем
 * refresh_token + device_id приватного API Boosty (подтверждение телефоном)
 * и создаём пользователя + аккаунт + сессию вручную в формате better-auth.
 *
 * identity: accountId = 'boosty:<user_id>' — СТАБИЛЬНЫЙ числовой id юзера
 * Boosty (берём из /v1/blog/self -> signedQuery). refresh_token ротируется
 * при каждом обновлении, поэтому его нельзя использовать как ключ —
 * иначе каждый вход плодил бы нового юзера/аккаунт.
 */

const PROVIDER_ID = 'boosty';

export async function completeBoostyLogin(params: {
	refreshToken: string;
	deviceId: string;
	/** Стабильный числовой id пользователя Boosty (из blog/self). */
	boostyUserId: number;
	nameHint?: string | null;
	imageHint?: string | null;
	/** При привязке к уже вошедшему юзеру (/profile): его user.id. */
	linkToUserId?: string | null;
	/** Не создавать новую сессию (уже вошедший юзер привязывает аккаунт). */
	skipSession?: boolean;
	/** Аватар пользователя на Boosty (images.boosty.to/user/{id}/avatar). */
	boostyAvatarHint?: string | null;
}): Promise<{
	userId: string;
	name: string;
	image: string | null;
	sessionToken: string | null;
	sessionExpiresAt: Date | null;
}> {
	const {
		refreshToken,
		deviceId,
		boostyUserId,
		nameHint,
		imageHint,
		linkToUserId,
		skipSession,
		boostyAvatarHint
	} = params;
	// Стабильный ключ аккаунта boosty.
	const accountKey = PROVIDER_ID + ':' + boostyUserId;

	// 1. Ищем существующий аккаунт boosty этого юзера Boosty.
	const existing = await db
		.select({ id: account.id, userId: account.userId })
		.from(account)
		.where(eq(account.accountId, accountKey))
		.limit(1);
	const matched = existing[0];

	// Если аккаунт boosty уже привязан к ДРУГОМУ локальному юзеру — конфликт.
	if (matched && linkToUserId && matched.userId !== linkToUserId) {
		throw new Error('Этот аккаунт Boosty уже привязан к другому пользователю');
	}

	let userId: string;
	if (matched) {
		// Повторный вход/привязка — используем существующего локального юзера.
		userId = matched.userId;
	} else if (linkToUserId) {
		// Привязка boosty к уже вошедшему юзеру.
		userId = linkToUserId;
	} else {
		// Новый локальный пользователь (первый вход через Boosty).
		const email = boostyEmail(String(boostyUserId));
		const name = nameHint?.trim() || 'Boosty-пользователь';
		const now = new Date();
		const created = await db
			.insert(user)
			.values({
				id: USER_ID_PREFIX + randomBytes(16).toString('hex'),
				name,
				email,
				emailVerified: true,
				image: imageHint ?? null,
				createdAt: now,
				updatedAt: now
			})
			.returning({ id: user.id });
		userId = created[0]?.id;
		if (!userId) throw new Error('failed to create user');
	}

	// 2. Аккаунт boosty: обновляем refresh_token и device_id (ротация).
	if (matched) {
		await db
			.update(account)
			.set({ refreshToken, scope: 'device_id=' + deviceId, updatedAt: new Date() })
			.where(eq(account.id, matched.id));
	} else {
		const nowA = new Date();
		await db.insert(account).values({
			id: ACCOUNT_ID_PREFIX + randomBytes(12).toString('hex'),
			accountId: accountKey,
			providerId: PROVIDER_ID,
			userId,
			refreshToken,
			accessToken: null,
			scope: 'device_id=' + deviceId,
			createdAt: nowA,
			updatedAt: nowA
		});
	}

	// 3. Доп.поля юзера (аватар Boosty) для карточки провайдера.
	if (boostyAvatarHint) {
		await db
			.update(user)
			.set({ boostyAvatar: boostyAvatarHint, updatedAt: new Date() })
			.where(eq(user.id, userId));
	}

	// 4. Сессия better-auth: token — то, что подписываем в cookie.
	// (пропускается при «привязке» — юзер уже вошёл.)
	let sessionToken: string | null = null;
	let expiresAt: Date | null = null;
	if (!skipSession) {
		sessionToken = randomBytes(32).toString('base64url');
		expiresAt = new Date(Date.now() + SESSION_TTL_MS); // 7 дней
		const nowS = new Date();
		await db.insert(session).values({
			id: SESSION_ID_PREFIX + randomBytes(16).toString('hex'),
			token: sessionToken,
			expiresAt,
			createdAt: nowS,
			updatedAt: nowS,
			userId
		});
	}

	const row = await db.select().from(user).where(eq(user.id, userId)).limit(1);
	const u = row[0];
	if (!u) throw new Error('user row not found after upsert');
	return {
		userId: u.id,
		name: u.name,
		image: u.image ?? null,
		sessionToken,
		sessionExpiresAt: expiresAt
	};
}
