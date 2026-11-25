import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { donationLedgerValues } from '../src/lib/server/subscriptions/ledger.ts';

const sql = postgres(process.env.DATABASE_URL ?? '');

const events = await sql`
	select id, user_id, type, amount_rub, price_per_day, note, created_at
	from subscription_events
	where type in ('grant', 'donation') and amount_rub is not null and amount_rub > 0
`;

let inserted = 0;
for (const event of events) {
	const values = donationLedgerValues({
		userId: event.user_id,
		amountRub: Number(event.amount_rub),
		pricePerDay: event.price_per_day == null ? null : Number(event.price_per_day),
		createdAt: new Date(event.created_at),
		source: event.type === 'donation' ? 'sber' : 'manual',
		note: event.note,
		idempotencyKey: `legacy:${event.id}`
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
