import { createHash } from 'node:crypto';

// Fixed namespace for deterministic, non-PII donor keys.
const DONOR_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function donorKeyForUser(userId: string): string {
	const namespace = Buffer.from(DONOR_NAMESPACE.replaceAll('-', ''), 'hex');
	const hash = createHash('sha1')
		.update(Buffer.concat([namespace, Buffer.from(userId, 'utf8')]))
		.digest();
	hash[6] = (hash[6] & 0x0f) | 0x50;
	hash[8] = (hash[8] & 0x3f) | 0x80;
	const hex = hash.toString('hex');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export interface DonationLedgerInput {
	userId: string;
	amountRub: number;
	pricePerDay?: number | null;
	createdAt: Date;
	source: 'sber' | 'boosty' | 'manual';
	note?: string | null;
	idempotencyKey: string;
}

export function donationLedgerValues(input: DonationLedgerInput) {
	return {
		donorKey: donorKeyForUser(input.userId),
		userId: input.userId,
		amountRub: Math.floor(input.amountRub),
		pricePerDay: input.pricePerDay ?? null,
		createdAt: input.createdAt,
		source: input.source,
		note: input.note?.trim().slice(0, 500) || null,
		idempotencyKey: input.idempotencyKey
	};
}
