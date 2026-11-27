import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import {
	donationLedgerValues,
	type DonationLedgerInput
} from '../src/lib/server/subscriptions/ledger.ts';

const VALID_SOURCES = new Set<DonationLedgerInput['source']>(['sber', 'boosty', 'manual']);

function resolveSource(rawSource: unknown, eventType: string): DonationLedgerInput['source'] {
	if (
		typeof rawSource === 'string' &&
		VALID_SOURCES.has(rawSource as DonationLedgerInput['source'])
	) {
		return rawSource as DonationLedgerInput['source'];
	}
	return eventType === 'donation' ? 'sber' : 'manual';
}

const sql = postgres(process.env.DATABASE_URL ?? '');

const events = await sql`
	select e.id, e.user_id, e.type, e.source, e.amount_rub, e.price_per_day, e.note, e.created_at
	from subscription_events e
	where e.type in ('grant', 'donation')
		and e.amount_rub is not null
		and e.amount_rub > 0
		and not exists (
			select 1
			from donation_ledger dl
			where dl.idempotency_key in ('grant:' || e.id, 'legacy:' || e.id)
		)
`;

let inserted = 0;
for (const event of events) {
	const idempotencyKey = event.type === 'grant' ? `grant:${event.id}` : `legacy:${event.id}`;
	const values = donationLedgerValues({
		userId: event.user_id,
		amountRub: Number(event.amount_rub),
		pricePerDay: event.price_per_day == null ? null : Number(event.price_per_day),
		createdAt: new Date(event.created_at),
		source: resolveSource(event.source, event.type),
		note: event.note,
		idempotencyKey
	});
	const result = await sql`
		insert into donation_ledger
			(id, donor_key, user_id, amount_rub, price_per_day, created_at, source, note, idempotency_key)
		values
			(${randomUUID()}, ${values.donorKey}, ${values.userId}, ${values.amountRub},
			 ${values.pricePerDay}, ${values.createdAt}, ${values.source}, ${values.note},
			 ${values.idempotencyKey})
		on conflict (idempotency_key) do nothing
		returning id
	`;
	if (result.length > 0) inserted += 1;
}

const [summary] = await sql`
	select count(*)::int as count, sum(amount_rub)::int as total,
		count(distinct donor_key)::int as donors
	from donation_ledger
`;
console.log(JSON.stringify({ events: events.length, inserted, ledger: summary }));
await sql.end();
