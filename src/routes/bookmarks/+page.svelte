<script lang="ts">
	import { resolve } from '$app/paths';
	import { audioStore } from '$lib/audio-store.svelte';
	import {
		db,
		type OfflineBookmark,
		type OfflineChapter,
		type OfflineVolume,
		type OfflineBook
	} from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { bookmarkService } from '$lib/client/services/bookmarkService';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { PaginationBar } from '$lib/components/ui/pagination';
	import { strings } from '$lib/constants/strings';
	import { formatTimeRange } from '$lib/utils/timecode';
	import { Bookmark, Clock, Play, Trash2, BookOpen, Quote } from '@lucide/svelte';

	interface EnrichedBookmark extends OfflineBookmark {
		chapter?: OfflineChapter;
		volume?: OfflineVolume;
		book?: OfflineBook;
	}

	const bookmarksQuery = useDexie(
		async () => {
			const bms = await db.bookmarks.toArray();
			bms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

			const enriched: EnrichedBookmark[] = await Promise.all(
				bms.map(async (bm) => {
					const chapter = await db.chapters.get(bm.chapterId);
					const volume = chapter ? await db.volumes.get(chapter.volumeId) : undefined;
					const book = volume ? await db.books.get(volume.bookId) : undefined;
					return {
						...bm,
						chapter,
						volume,
						book
					};
				})
			);
			return enriched;
		},
		() => [] as EnrichedBookmark[]
	);

	let bookmarkToDelete = $state<EnrichedBookmark | null>(null);
	let isDeleteModalOpen = $state(false);

	let currentPage = $state(1);
	let pageSize = $state(10);

	const paginatedBookmarks = $derived(
		bookmarksQuery.data.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	function formatDate(timestamp: number): string {
		if (!timestamp) return '';
		return new Date(timestamp).toLocaleDateString('ru-RU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	async function handlePlayBookmark(item: EnrichedBookmark) {
		if (!item.chapter) return;
		const volumeId = item.chapter.volumeId;
		const allChapters = await db.chapters
			.where('volumeId')
			.equals(volumeId)
			.sortBy('chapterNumber');

		const tracks = allChapters.map((ch) => ({
			id: ch.id,
			title: ch.title,
			url: ch.audioUrl,
			duration: ch.durationSeconds,
			album: item.volume?.title || `Том ${item.volume?.volumeNumber || 1}`,
			artist: item.book?.title || 'Hedgehog',
			artwork: item.volume?.coverUrl || item.book?.coverUrl,
			bookId: item.book?.id,
			volumeId: item.volume?.id,
			startTime: ch.id === item.chapterId ? item.timestampSeconds : 0
		}));

		const startIndex = tracks.findIndex((t) => t.id === item.chapterId);
		if (startIndex !== -1) {
			audioStore.setQueueAndPlay(tracks, startIndex);
			setTimeout(() => {
				audioStore.seek(item.timestampSeconds, false);
				if (item.endTimestampSeconds && item.endTimestampSeconds > item.timestampSeconds) {
					audioStore.setPlaybackRange(item.endTimestampSeconds);
				}
				// Resuming a track that was already loaded does not go through the
				// provider's load effect, so make sure playback actually starts.
				audioStore.play();
			}, 100);
		}
	}

	function openDeleteModal(item: EnrichedBookmark) {
		bookmarkToDelete = item;
		isDeleteModalOpen = true;
	}

	async function confirmDelete() {
		if (!bookmarkToDelete) return;
		await bookmarkService.deleteBookmark(bookmarkToDelete.id);
		isDeleteModalOpen = false;
		bookmarkToDelete = null;
	}
</script>

<svelte:head>
	<title>{strings.bookmarks.title} | Hedgehog X</title>
</svelte:head>

<div class="layout-content mx-auto max-w-5xl py-6 md:py-10">
	<div class="mb-8 flex flex-col gap-2">
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm"
			>
				<Bookmark class="h-5 w-5" />
			</div>
			<div>
				<h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
					{strings.bookmarks.title}
				</h1>
				<p class="text-xs text-muted-foreground sm:text-sm">
					{strings.bookmarks.subtitle}
				</p>
			</div>
		</div>
	</div>

	{#if bookmarksQuery.isLoading}
		<div class="space-y-4">
			{#each Array.from({ length: 3 }, (_, k) => k) as idx (idx)}
				<div class="h-28 w-full animate-pulse rounded-2xl bg-muted/40"></div>
			{/each}
		</div>
	{:else if bookmarksQuery.data.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/50 p-12 text-center backdrop-blur-xs"
		>
			<div
				class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground"
			>
				<Bookmark class="h-8 w-8" />
			</div>
			<h2 class="text-lg font-semibold text-foreground">{strings.bookmarks.emptyTitle}</h2>
			<p class="mt-1.5 max-w-md text-xs text-muted-foreground sm:text-sm">
				{strings.bookmarks.emptyDescription}
			</p>
			<Button href={resolve('/')} class="mt-6 gap-2">
				<BookOpen class="h-4 w-4" />
				<span>{strings.nav.catalog}</span>
			</Button>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each paginatedBookmarks as item (item.id)}
				<Card.Root
					class="group overflow-hidden border-border/60 bg-card/60 transition-all duration-200 hover:border-border hover:shadow-md"
				>
					<div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
						<!-- Book & Chapter info -->
						<div class="flex min-w-0 items-start gap-3 sm:items-center">
							{#if item.volume?.coverUrl || item.book?.coverUrl}
								<img
									src={item.volume?.coverUrl || item.book?.coverUrl}
									alt={item.volume?.title || item.chapter?.title || 'Cover'}
									class="h-16 w-12 shrink-0 rounded-lg object-cover shadow-sm sm:h-20 sm:w-14"
								/>
							{:else}
								<div
									class="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:h-20 sm:w-14"
								>
									<BookOpen class="h-6 w-6" />
								</div>
							{/if}

							<div class="min-w-0 flex-1 space-y-1">
								<div class="flex flex-wrap items-center gap-2">
									<span
										class="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary tabular-nums"
									>
										<Clock class="h-3 w-3" />
										<span>{formatTimeRange(item.timestampSeconds, item.endTimestampSeconds)}</span>
									</span>
									{#if item.createdAt}
										<span class="text-xxs text-muted-foreground/70">
											{formatDate(item.createdAt)}
										</span>
									{/if}
								</div>

								<h3 class="truncate text-base font-semibold text-foreground">
									{item.chapter?.title ?? strings.player.chapterFallback}
								</h3>

								<p class="truncate text-xs text-muted-foreground">
									{#if item.book?.title}
										<span>{item.book.title}</span>
										{#if item.volume?.title}
											<span> &bull; {item.volume.title}</span>
										{/if}
									{:else if item.volume?.title}
										<span>{item.volume.title}</span>
									{/if}
								</p>

								{#if item.note}
									<div
										class="mt-1.5 flex items-start gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-foreground/90"
									>
										<Quote class="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
										<span class="line-clamp-2 italic">{item.note}</span>
									</div>
								{/if}
							</div>
						</div>

						<!-- Actions -->
						<div class="flex items-center justify-end gap-2 pt-2 sm:pt-0">
							<Button
								size="sm"
								class="gap-1.5 rounded-xl font-medium"
								onclick={() => handlePlayBookmark(item)}
							>
								<Play class="h-3.5 w-3.5 fill-current" />
								<span>{strings.bookmarks.jumpToBookmark}</span>
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
								onclick={() => openDeleteModal(item)}
								title={strings.bookmarks.deleteBookmark}
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						</div>
					</div>
				</Card.Root>
			{/each}
		</div>

		{#if bookmarksQuery.data.length > 0}
			<PaginationBar totalItems={bookmarksQuery.data.length} bind:currentPage bind:pageSize />
		{/if}
	{/if}
</div>

<!-- Delete Bookmark Confirm Dialog -->
<Dialog.Root bind:open={isDeleteModalOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{strings.bookmarks.deleteConfirmTitle}</Dialog.Title>
			<Dialog.Description>
				{strings.bookmarks.deleteConfirmDescription}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex gap-2 sm:justify-end">
			<Button variant="outline" onclick={() => (isDeleteModalOpen = false)}>
				{strings.common.cancel}
			</Button>
			<Button variant="destructive" onclick={confirmDelete}>
				{strings.common.delete}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
