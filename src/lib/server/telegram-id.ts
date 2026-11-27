/**
 * Telegram OIDC returns the real Telegram user id in the `id` claim.
 * Depending on the issuer/version it can be a number or a numeric string,
 * while `sub` is an opaque per-client identifier (19 digits for current
 * Telegram OIDC) and must not be stored as the Telegram account id.
 */
export function telegramUserIdFromClaims(claims: { id?: unknown }): string | null {
	const raw = claims.id;
	if (typeof raw === 'number') {
		return Number.isSafeInteger(raw) && raw > 0 ? String(raw) : null;
	}
	if (typeof raw === 'string') {
		const value = raw.trim();
		return /^[1-9]\d*$/.test(value) ? value : null;
	}
	return null;
}
