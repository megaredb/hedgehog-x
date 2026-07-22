import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
	const allBooks = await db.select().from(books).orderBy(desc(books.createdAt));

	return json(allBooks);
}
