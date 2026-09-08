import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
	try {
		const allBooks = await db.select().from(books).orderBy(desc(books.createdAt));
		// Публичный каталог: список можно недолго кэшировать.
		return json(allBooks, { headers: { 'Cache-Control': 'public, max-age=60' } });
	} catch (e) {
		console.error('[api/books] failed to list books', e);
		return json({ error: 'Failed to load books' }, { status: 500 });
	}
}
