import { fail } from '@sveltejs/kit';
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	books,
	chapterIllustrations,
	broadcastListeners,
	broadcastMessages,
	broadcastReactions,
	broadcastViews,
	broadcasts,
	chapters,
	volumes
} from '$lib/server/db/schema';
import { user } from '$lib/server/db/auth.schema';
import { requireAdmin } from '$lib/server/admin';
import { deleteFromStorage, uploadImage } from '$lib/server/storage/r2';
import {
	ACTIVE_LISTENER_WINDOW_MS,
	broadcastKind,
	invalidateActiveBroadcastCache,
	markBroadcastEnded,
	markBroadcastStarted,
	publishBroadcast,
	syncBroadcast
} from '$lib/server/broadcasts';
import type { Actions, PageServerLoad } from './$types';

async function maybeDeleteUnusedCover(
	oldCoverUrl: string | null | undefined,
	excludeBroadcastId?: string
): Promise<void> {
	if (!oldCoverUrl) return;
	const [stillUsed] = await db
		.select({ id: broadcasts.id })
		.from(broadcasts)
		.where(
			and(
				eq(broadcasts.coverUrl, oldCoverUrl),
				excludeBroadcastId ? ne(broadcasts.id, excludeBroadcastId) : undefined
			)
		)
		.limit(1);
	if (!stillUsed) {
		await deleteFromStorage(oldCoverUrl);
	}
}

function text(form: FormData, key: string, max = 2000): string {
	return String(form.get(key) ?? '')
		.trim()
		.slice(0, max);
}

function bool(form: FormData, key: string, fallback = false): boolean {
	const value = form.get(key);
	return value == null ? fallback : String(value) === 'true' || String(value) === 'on';
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const rows = await db
		.select({
			id: broadcasts.id,
			title: broadcasts.title,
			description: broadcasts.description,
			coverUrl: broadcasts.coverUrl,
			scheduledStartAt: broadcasts.scheduledStartAt,
			startedAt: broadcasts.startedAt,
			endedAt: broadcasts.endedAt,
			saveRecording: broadcasts.saveRecording,
			publishAfterEnd: broadcasts.publishAfterEnd,
			chatEnabled: broadcasts.chatEnabled,
			publishedAt: broadcasts.publishedAt,
			chapterId: chapters.id,
			chapterTitle: chapters.title,
			durationSeconds: chapters.durationSeconds,
			volumeId: volumes.id,
			volumeTitle: volumes.title,
			bookId: books.id,
			bookTitle: books.title
		})
		.from(broadcasts)
		.innerJoin(chapters, eq(chapters.id, broadcasts.chapterId))
		.innerJoin(volumes, eq(volumes.id, chapters.volumeId))
		.innerJoin(books, eq(books.id, volumes.bookId))
		.orderBy(desc(broadcasts.scheduledStartAt));

	const synced = await Promise.all(rows.map(async (row) => (await syncBroadcast(row.id)) ?? row));
	const now = new Date();
	const since = new Date(now.getTime() - ACTIVE_LISTENER_WINDOW_MS);
	const broadcastIds = synced.map((row) => row.id);
	const chapterIds = [...new Set(synced.map((row) => row.chapterId))];

	const [viewStats, viewerRows, messageStats, reactionStats, illustrationStats, activePeopleRows] =
		broadcastIds.length > 0
			? await Promise.all([
					db
						.select({
							broadcastId: broadcastViews.broadcastId,
							views: count(),
							uniqueViewers: sql<number>`count(distinct ${broadcastViews.userId})`
						})
						.from(broadcastViews)
						.where(inArray(broadcastViews.broadcastId, broadcastIds))
						.groupBy(broadcastViews.broadcastId),
					db
						.select({
							broadcastId: broadcastViews.broadcastId,
							id: user.id,
							name: user.name
						})
						.from(broadcastViews)
						.innerJoin(user, eq(user.id, broadcastViews.userId))
						.where(inArray(broadcastViews.broadcastId, broadcastIds))
						.groupBy(broadcastViews.broadcastId, user.id, user.name)
						.orderBy(asc(user.name)),
					db
						.select({
							broadcastId: broadcastMessages.broadcastId,
							value: count()
						})
						.from(broadcastMessages)
						.where(inArray(broadcastMessages.broadcastId, broadcastIds))
						.groupBy(broadcastMessages.broadcastId),
					db
						.select({
							broadcastId: broadcastMessages.broadcastId,
							value: count()
						})
						.from(broadcastReactions)
						.innerJoin(broadcastMessages, eq(broadcastMessages.id, broadcastReactions.messageId))
						.where(inArray(broadcastMessages.broadcastId, broadcastIds))
						.groupBy(broadcastMessages.broadcastId),
					chapterIds.length > 0
						? db
								.select({
									chapterId: chapterIllustrations.chapterId,
									value: count()
								})
								.from(chapterIllustrations)
								.where(inArray(chapterIllustrations.chapterId, chapterIds))
								.groupBy(chapterIllustrations.chapterId)
						: Promise.resolve([]),
					db
						.select({
							broadcastId: broadcastListeners.broadcastId,
							id: user.id,
							name: user.name
						})
						.from(broadcastListeners)
						.innerJoin(user, eq(user.id, broadcastListeners.userId))
						.where(
							and(
								inArray(broadcastListeners.broadcastId, broadcastIds),
								isNull(broadcastListeners.leftAt),
								gt(broadcastListeners.lastSeenAt, since)
							)
						)
						.orderBy(asc(user.name))
				])
			: [[], [], [], [], [], []];

	const viewsByBroadcast = new Map(
		viewStats.map((row) => [
			row.broadcastId,
			{ views: Number(row.views ?? 0), uniqueViewers: Number(row.uniqueViewers ?? 0) }
		])
	);
	const viewersByBroadcast = new Map<string, Array<{ id: string; name: string }>>();
	for (const row of viewerRows) {
		const list = viewersByBroadcast.get(row.broadcastId) ?? [];
		list.push({ id: row.id, name: row.name });
		viewersByBroadcast.set(row.broadcastId, list);
	}
	const messagesByBroadcast = new Map(
		messageStats.map((row) => [row.broadcastId, Number(row.value ?? 0)])
	);
	const reactionsByBroadcast = new Map(
		reactionStats.map((row) => [row.broadcastId, Number(row.value ?? 0)])
	);
	const illustrationsByChapter = new Map(
		illustrationStats.map((row) => [row.chapterId, Number(row.value ?? 0)])
	);
	const peopleByBroadcast = new Map<string, Array<{ id: string; name: string }>>();
	for (const row of activePeopleRows) {
		const list = peopleByBroadcast.get(row.broadcastId) ?? [];
		list.push({ id: row.id, name: row.name });
		peopleByBroadcast.set(row.broadcastId, list);
	}

	const liveRows = synced.map((row) => {
		const viewInfo = viewsByBroadcast.get(row.id);
		const people = peopleByBroadcast.get(row.id) ?? [];
		return {
			...row,
			kind: broadcastKind(row as never, now),
			listeners: people.length,
			views: viewInfo?.views ?? 0,
			uniqueViewers: viewInfo?.uniqueViewers ?? 0,
			messageCount: messagesByBroadcast.get(row.id) ?? 0,
			reactionCount: reactionsByBroadcast.get(row.id) ?? 0,
			illustrationCount: illustrationsByChapter.get(row.chapterId) ?? 0,
			people,
			viewers: viewersByBroadcast.get(row.id) ?? []
		};
	});

	const chapterRows = await db
		.select({
			id: chapters.id,
			title: chapters.title,
			durationSeconds: chapters.durationSeconds,
			published: chapters.published,
			volumeId: volumes.id,
			volumeTitle: volumes.title,
			bookTitle: books.title
		})
		.from(chapters)
		.innerJoin(volumes, eq(volumes.id, chapters.volumeId))
		.innerJoin(books, eq(books.id, volumes.bookId))
		.orderBy(desc(chapters.createdAt));

	return {
		broadcasts: liveRows,
		chapters: chapterRows
	};
};

export const actions: Actions = {
	saveBroadcast: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = text(form, 'id', 36);
		const chapterId = text(form, 'chapterId', 128);
		const title = text(form, 'title', 255);
		const description = text(form, 'description', 4000);
		let coverUrl = text(form, 'coverUrl', 1024) || null;
		let coverBlurhash = text(form, 'coverBlurhash', 100) || null;
		const coverFile = form.get('coverFile');
		if (coverFile instanceof File && coverFile.size > 0) {
			try {
				const uploaded = await uploadImage(Buffer.from(await coverFile.arrayBuffer()), {
					folder: 'broadcasts'
				});
				coverUrl = uploaded.url;
				coverBlurhash = uploaded.blurhash;
			} catch (error) {
				return fail(400, {
					error: error instanceof Error ? error.message : 'Не удалось загрузить обложку'
				});
			}
		}
		const scheduledRaw = text(form, 'scheduledStartAt', 64);
		const scheduledStartAt = scheduledRaw ? new Date(scheduledRaw) : new Date(Number.NaN);
		if (!chapterId || !title) return fail(400, { error: 'Выберите главу и укажите название' });
		if (Number.isNaN(scheduledStartAt.getTime())) {
			return fail(400, { error: 'Укажите корректное время начала' });
		}
		const [chapter] = await db
			.select({ id: chapters.id, volumeId: chapters.volumeId })
			.from(chapters)
			.where(eq(chapters.id, chapterId))
			.limit(1);
		if (!chapter) return fail(404, { error: 'Глава не найдена' });
		let existingCoverUrl: string | null = null;
		if (id) {
			const [existing] = await db
				.select({ coverUrl: broadcasts.coverUrl, coverBlurhash: broadcasts.coverBlurhash })
				.from(broadcasts)
				.where(eq(broadcasts.id, id))
				.limit(1);
			existingCoverUrl = existing?.coverUrl ?? null;
			if (!coverBlurhash) coverBlurhash = existing?.coverBlurhash ?? null;
		}

		if (id) {
			await db
				.update(broadcasts)
				.set({
					chapterId,
					title,
					description,
					coverUrl,
					coverBlurhash,
					scheduledStartAt,
					saveRecording: bool(form, 'saveRecording', true),
					publishAfterEnd: bool(form, 'publishAfterEnd', true),
					chatEnabled: bool(form, 'chatEnabled', true),
					updatedAt: new Date()
				})
				.where(eq(broadcasts.id, id));
			if (existingCoverUrl && existingCoverUrl !== coverUrl) {
				await maybeDeleteUnusedCover(existingCoverUrl, id);
			}
		} else {
			await db.insert(broadcasts).values({
				chapterId,
				title,
				description,
				coverUrl,
				coverBlurhash,
				scheduledStartAt,
				saveRecording: bool(form, 'saveRecording', true),
				publishAfterEnd: bool(form, 'publishAfterEnd', true),
				chatEnabled: bool(form, 'chatEnabled', true),
				createdBy: locals.user?.id ?? null
			});
		}
		invalidateActiveBroadcastCache(id || undefined);
		return { success: true, message: 'Трансляция сохранена' };
	},
	startBroadcast: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = text(await request.formData(), 'id', 36);
		await markBroadcastStarted(id);
		return { success: true, message: 'Трансляция начата' };
	},
	endBroadcast: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = text(await request.formData(), 'id', 36);
		await markBroadcastEnded(id);
		return { success: true, message: 'Трансляция завершена' };
	},
	publishBroadcast: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = text(form, 'id', 36);
		const state = await syncBroadcast(id);
		if (!state?.endedAt) return fail(400, { error: 'Сначала завершите трансляцию' });
		if (!state.saveRecording) return fail(400, { error: 'Запись отключена при создании' });
		await publishBroadcast(id);
		return { success: true, message: 'Трансляция опубликована' };
	},
	deleteBroadcast: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = text(await request.formData(), 'id', 36);
		const [existing] = await db
			.select({ coverUrl: broadcasts.coverUrl })
			.from(broadcasts)
			.where(eq(broadcasts.id, id))
			.limit(1);
		await db.delete(broadcasts).where(eq(broadcasts.id, id));
		if (existing?.coverUrl) {
			await maybeDeleteUnusedCover(existing.coverUrl);
		}
		invalidateActiveBroadcastCache(id);
		return { success: true, message: 'Трансляция удалена' };
	}
};
