import { fail } from '@sveltejs/kit';
import { and, asc, count, desc, eq, gt, isNull, sql } from 'drizzle-orm';
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
import { uploadImage } from '$lib/server/storage/r2';
import {
	activeListenerCount,
	broadcastKind,
	markBroadcastEnded,
	markBroadcastStarted,
	publishBroadcast,
	syncBroadcast
} from '$lib/server/broadcasts';
import type { Actions, PageServerLoad } from './$types';

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
	const liveRows = await Promise.all(
		synced.map(async (row) => {
			const now = new Date();
			const listeners = await activeListenerCount(row.id, now);
			const [viewRow] = await db
				.select({ value: count() })
				.from(broadcastViews)
				.where(eq(broadcastViews.broadcastId, row.id));
			const [viewerRow] = await db
				.select({ value: sql<number>`count(distinct ${broadcastViews.userId})` })
				.from(broadcastViews)
				.where(eq(broadcastViews.broadcastId, row.id));
			const viewers = await db
				.select({ id: user.id, name: user.name })
				.from(broadcastViews)
				.innerJoin(user, eq(user.id, broadcastViews.userId))
				.where(eq(broadcastViews.broadcastId, row.id))
				.groupBy(user.id, user.name)
				.orderBy(asc(user.name));
			const [messageRow] = await db
				.select({ value: count() })
				.from(broadcastMessages)
				.where(eq(broadcastMessages.broadcastId, row.id));
			const [reactionRow] = await db
				.select({ value: count() })
				.from(broadcastReactions)
				.innerJoin(broadcastMessages, eq(broadcastMessages.id, broadcastReactions.messageId))
				.where(eq(broadcastMessages.broadcastId, row.id));
			const [illustrationRow] = await db
				.select({ value: count() })
				.from(chapterIllustrations)
				.where(eq(chapterIllustrations.chapterId, row.chapterId));
			const people = await db
				.select({ id: user.id, name: user.name })
				.from(broadcastListeners)
				.innerJoin(user, eq(user.id, broadcastListeners.userId))
				.where(
					and(
						eq(broadcastListeners.broadcastId, row.id),
						isNull(broadcastListeners.leftAt),
						gt(broadcastListeners.lastSeenAt, new Date(now.getTime() - 30_000))
					)
				)
				.orderBy(asc(user.name));
			return {
				...row,
				kind: broadcastKind(row as never, now),
				listeners,
				views: Number(viewRow?.value ?? 0),
				uniqueViewers: Number(viewerRow?.value ?? 0),
				messageCount: Number(messageRow?.value ?? 0),
				reactionCount: Number(reactionRow?.value ?? 0),
				illustrationCount: Number(illustrationRow?.value ?? 0),
				people,
				viewers
			};
		})
	);

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
		if (id && !coverBlurhash) {
			const [existing] = await db
				.select({ coverBlurhash: broadcasts.coverBlurhash })
				.from(broadcasts)
				.where(eq(broadcasts.id, id))
				.limit(1);
			coverBlurhash = existing?.coverBlurhash ?? null;
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
		await db.delete(broadcasts).where(eq(broadcasts.id, id));
		return { success: true, message: 'Трансляция удалена' };
	}
};
