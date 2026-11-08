import { db } from '$lib/server/db';
import { volumeLikes, chapterLikes } from '$lib/server/db/schema';
import { inArray, count } from 'drizzle-orm';

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

	const volumeIds = bookData.volumes.map((v) => v.id);
	const chapterIds = bookData.volumes.flatMap((v) => v.chapters.map((c) => c.id));

	const [volLikesCounts, chLikesCounts] = await Promise.all([
		volumeIds.length > 0
			? db
					.select({
						volumeId: volumeLikes.volumeId,
						count: count()
					})
					.from(volumeLikes)
					.where(inArray(volumeLikes.volumeId, volumeIds))
					.groupBy(volumeLikes.volumeId)
			: [],
		chapterIds.length > 0
			? db
					.select({
						chapterId: chapterLikes.chapterId,
						count: count()
					})
					.from(chapterLikes)
					.where(inArray(chapterLikes.chapterId, chapterIds))
					.groupBy(chapterLikes.chapterId)
			: []
	]);

	const volLikesMap = new Map(volLikesCounts.map((v) => [v.volumeId, Number(v.count)]));
	const chLikesMap = new Map(chLikesCounts.map((c) => [c.chapterId, Number(c.count)]));

	const enrichedVolumes = bookData.volumes.map((v) => ({
		...v,
		likesCount: volLikesMap.get(v.id) ?? 0,
		chapters: v.chapters.map((c) => ({
			...c,
			likesCount: chLikesMap.get(c.id) ?? 0
		}))
	}));

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

	const responsePayload = {
		...bookData,
		volumes: enrichedVolumes
	};

	const payloadString = JSON.stringify(responsePayload);

	return new Response(payloadString, {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			ETag: etag,
			'Cache-Control': 'public, max-age=0, must-revalidate'
		}
	});
};
