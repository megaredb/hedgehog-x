import { db } from '$lib/server/db';
import { books, volumes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const escapeXml = (value: string) =>
	value.replace(
		/[<>&'"]/g,
		(c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c
	);

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.origin;
	const rows = await db
		.select({ bookId: books.id, volumeId: volumes.id })
		.from(volumes)
		.innerJoin(books, eq(volumes.bookId, books.id));

	const urls = [
		`${origin}/`,
		`${origin}/books`,
		...new Set(rows.map((row) => `${origin}/books/${row.bookId}`)),
		...rows.map((row) => `${origin}/books/${row.bookId}/${row.volumeId}`)
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((value) => `  <url><loc>${escapeXml(value)}</loc></url>`).join('\n')}
</urlset>`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
