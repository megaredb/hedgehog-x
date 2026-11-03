import { db } from '$lib/server/db';

export const GET = async ({ params, request }) => {
	const { bookId } = params;

	// Fetch full book hierarchy (Book -> Volumes -> Chapters & Illustrations)
	const bookData = await db.query.books.findFirst({
		where: (books, { eq }) => eq(books.id, bookId),
		with: {
			volumes: {
				with: {
					chapters: true,
					illustrations: true
				}
			}
		}
	});

	if (!bookData) {
		return new Response('Not found', { status: 404 });
	}

	const volumeUpdates = bookData.volumes.map((v) => v.updatedAt?.getTime() || 0);
	const chapterUpdates = bookData.volumes.flatMap((v) =>
		v.chapters.map((c) => c.updatedAt?.getTime() || 0)
	);
	const illustrationUpdates = bookData.volumes.flatMap((v) =>
		v.illustrations.map((i) => i.updatedAt?.getTime() || 0)
	);
	const maxUpdatedAt = Math.max(
		bookData.updatedAt?.getTime() || 0,
		...volumeUpdates,
		...chapterUpdates,
		...illustrationUpdates
	);

	const etag = `W/"${maxUpdatedAt}"`;

	// Check client If-None-Match ETag header
	const clientEtag = request.headers.get('if-none-match');
	if (clientEtag === etag) {
		return new Response(null, { status: 304 });
	}

	const payloadString = JSON.stringify(bookData);

	return new Response(payloadString, {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			ETag: etag,
			'Cache-Control': 'public, max-age=0, must-revalidate'
		}
	});
};
