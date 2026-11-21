<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { resolve } from '$app/paths';
	import { audioStore } from '$lib/audio-store.svelte';
	import type { Track } from '$lib/html-audio.js';
	import {
		db,
		type OfflineBookmark,
		type OfflineChapter,
		type OfflineVolume,
		type OfflineBook
	} from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { bookmarkService } from '$lib/client/services/bookmarkService';
	import { syncService } from '$lib/client/services/syncService';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { PaginationBar } from '$lib/components/ui/pagination';
	import { Input } from '$lib/components/ui/input';
	import { strings } from '$lib/constants/strings';
	import { Bookmark, Clock, Pencil, Play, Trash2, BookOpen, Quote } from '@lucide/svelte';
	import { formatDuration } from '$lib/utils/time';

	interface EnrichedBookmark extends OfflineBookmark {
		chapter?: OfflineChapter;
		volume?: OfflineVolume;
		book?: OfflineBook;
		version?: import('$lib/client/db').OfflineChapterAudioVersion;
	}

	const bookmarksQuery = useDexie(
		async () => {
			const bms = await db.bookmarks.toArray();
			bms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

			const versionRows = await db.chapterAudioVersions.toArray();
			const enriched: EnrichedBookmark[] = await Promise.all(
				bms.map(async (bm) => {
					const chapter = await db.chapters.get(bm.chapterId);
					const volume = chapter ? await db.volumes.get(chapter.volumeId) : undefined;
					const book = volume ? await db.books.get(volume.bookId) : undefined;
					const version = versionRows.find(
						(v) => v.chapterId === bm.chapterId && v.versionId === (bm.versionId ?? 'default')
					);
					return {
						...bm,
						chapter,
						volume,
						book,
						version
					};
				})
			);
			return enriched;
		},
		() => [] as EnrichedBookmark[]
	);

	let bookmarkToDelete = $state<EnrichedBookmark | null>(null);
	let isDeleteModalOpen = $state(false);
	let bookmarkToEdit = $state<EnrichedBookmark | null>(null);
	let isEditModalOpen = $state(false);
	let editStart = $state(0);
	let editEnd = $state<number | null>(null);
	let editNote = $state('');
	let isSavingEdit = $state(false);

	let currentPage = $state(1);
	let pageSize = $state(10);
	const totalPages = $derived(Math.max(1, Math.ceil(bookmarksQuery.data.length / pageSize)));
	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
	});

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
		const versionId = item.versionId ?? 'default';
		const currentVersion =
			typeof audioStore.currentTrack?.versionId === 'string'
				? audioStore.currentTrack.versionId
				: 'default';
		if (audioStore.currentTrack?.id === item.chapterId && currentVersion === versionId) {
			audioStore.setClipRange(item.timestampSeconds, item.endTimestampSeconds);
			audioStore.seek(item.timestampSeconds);
			if (!audioStore.isPlaying) audioStore.play();
			return;
		}

		if (versionId !== 'default') {
			let version = item.version;
			if (!version && item.book?.id) {
				await syncService.syncBookDetails(item.book.id);
				version = await db.chapterAudioVersions
					.where({ chapterId: item.chapterId, versionId })
					.first();
			}
			if (!version) return;
			audioStore.setQueueAndPlay(
				[
					{
						id: item.chapter.id,
						title: version.title,
						url: version.audioUrl,
						duration: version.durationSeconds,
						versionId,
						album: item.volume?.title || `Том ${item.volume?.volumeNumber || 1}`,
						artist: item.book?.title || 'Hedgehog',
						artwork: item.volume?.coverUrl || item.book?.coverUrl,
						bookId: item.book?.id,
						volumeId: item.volume?.id,
						startTime: item.timestampSeconds
					}
				],
				0
			);
			audioStore.setClipRange(item.timestampSeconds, item.endTimestampSeconds);
			return;
		}

		const volumeId = item.chapter.volumeId;
		const allChapters = await db.chapters
			.where('volumeId')
			.equals(volumeId)
			.sortBy('chapterNumber');

		const tracks: Track[] = allChapters.map((ch) => ({
			id: ch.id,
			title: ch.title,
			url: ch.audioUrl,
			duration: ch.durationSeconds,
			versionId: 'default',
			album: item.volume?.title || `Том ${item.volume?.volumeNumber || 1}`,
			artist: item.book?.title || 'Hedgehog',
			artwork: item.volume?.coverUrl || item.book?.coverUrl,
			bookId: item.book?.id,
			volumeId: item.volume?.id
		}));

		const startIndex = tracks.findIndex((t) => t.id === item.chapterId);
		if (startIndex !== -1) {
			tracks[startIndex] = { ...tracks[startIndex], startTime: item.timestampSeconds };
			audioStore.setQueueAndPlay(tracks, startIndex);
			audioStore.setClipRange(item.timestampSeconds, item.endTimestampSeconds);
		}
	}

	function openEditModal(item: EnrichedBookmark) {
		bookmarkToEdit = item;
		editStart = item.timestampSeconds;
		editEnd = item.endTimestampSeconds ?? null;
		editNote = item.note;
		isEditModalOpen = true;
	}

	async function saveEdit() {
		if (!bookmarkToEdit || isSavingEdit) return;
		isSavingEdit = true;
		try {
			await bookmarkService.updateBookmark(bookmarkToEdit.id, {
				timestampSeconds: editStart,
				endTimestampSeconds: editEnd,
				note: editNote
			});
			isEditModalOpen = false;
			bookmarkToEdit = null;
		} finally {
			isSavingEdit = false;
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

	function chapterHref(item: EnrichedBookmark): string {
		if (!item.book || !item.volume || !item.chapter) return '#';
		return (
			resolve(`/books/${item.book.id}/${item.volume.id}`) +
			`?chapter=${encodeURIComponent(item.chapter.id)}&version=${encodeURIComponent(item.versionId ?? 'default')}`
		);
	}

	function volumeHref(item: EnrichedBookmark): string {
		return item.book && item.volume ? resolve(`/books/${item.book.id}/${item.volume.id}`) : '#';
	}

	function bookHref(item: EnrichedBookmark): string {
		return item.book ? resolve(`/books/${item.book.id}`) + '#volumes' : '#';
	}
</script>

<svelte:head>
	<title>{strings.bookmarks.title} | Hedgehog X</title>
	<meta name="description" content="Сохранённые фрагменты и заметки к прослушанным аудиокнигам." />
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
			{#each paginatedBookmarks as item, i (item.id)}
				<Card.Root
					class="group overflow-hidden border-border/60 bg-card/60 transition-all duration-200 hover:border-border hover:shadow-md"
				>
					<div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
						<!-- Book & Chapter info -->
						<div class="flex min-w-0 items-start gap-3 sm:items-center">
							{#if item.volume?.coverUrl || item.book?.coverUrl}
								<a href={chapterHref(item)} aria-label="Перейти к главе" class="shrink-0">
									<img
										src={item.volume?.coverUrl || item.book?.coverUrl}
										alt={item.volume?.title || item.chapter?.title || 'Cover'}
										width={56}
										height={80}
										loading={i < 2 ? 'eager' : 'lazy'}
										class="h-16 w-12 rounded-lg object-cover shadow-sm sm:h-20 sm:w-14"
									/>
								</a>
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
										class="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"
									>
										<Clock class="h-3 w-3" />
										<span>
											{formatDuration(item.timestampSeconds)}
											{#if item.endTimestampSeconds}
												– {formatDuration(item.endTimestampSeconds)}
											{/if}
										</span>
									</span>
									{#if item.createdAt}
										<span class="text-xxs text-muted-foreground/70">
											{formatDate(item.createdAt)}
										</span>
									{/if}
									<span class="text-xxs text-muted-foreground/70">
										{item.versionId === 'default' || !item.versionId
											? 'Новая версия'
											: 'Старая версия'}
									</span>
								</div>

								<h3 class="truncate text-base font-semibold text-foreground">
									<a href={chapterHref(item)} class="hover:underline">
										{item.chapter?.title ?? strings.player.chapterFallback}
									</a>
								</h3>

								<p class="truncate text-xs text-muted-foreground">
									{#if item.book?.title}
										<a href={bookHref(item)} class="hover:text-foreground hover:underline"
											>{item.book.title}</a
										>
										{#if item.volume?.title}
											<span> &bull; </span>
											<a href={volumeHref(item)} class="hover:text-foreground hover:underline"
												>{item.volume.title}</a
											>
										{/if}
									{:else if item.volume?.title}
										<a href={volumeHref(item)} class="hover:text-foreground hover:underline"
											>{item.volume.title}</a
										>
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
								class="h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted"
								onclick={() => openEditModal(item)}
								title="Редактировать закладку"
								aria-label="Редактировать закладку"
							>
								<Pencil class="h-4 w-4" />
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

<!-- Edit Bookmark Dialog -->
<Dialog.Root bind:open={isEditModalOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Редактировать закладку</Dialog.Title>
			<Dialog.Description>Измените таймкод, конец фрагмента или заметку.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-2">
			<label class="block space-y-1.5 text-sm">
				<span class="font-medium">Начало, секунд</span>
				<Input
					type="number"
					min="0"
					step="1"
					value={editStart}
					oninput={(event) => (editStart = Math.max(0, Number(event.currentTarget.value) || 0))}
				/>
			</label>
			<label class="block space-y-1.5 text-sm">
				<span class="font-medium">Конец фрагмента, секунд (необязательно)</span>
				<Input
					type="number"
					min={editStart + 1}
					step="1"
					value={editEnd ?? ''}
					oninput={(event) => {
						const value = Number(event.currentTarget.value);
						editEnd = Number.isFinite(value) && value > editStart ? value : null;
					}}
				/>
			</label>
			<label class="block space-y-1.5 text-sm">
				<span class="font-medium">{strings.bookmarks.noteLabel}</span>
				<Input bind:value={editNote} maxlength={500} />
			</label>
		</div>
		<Dialog.Footer class="flex gap-2 sm:justify-end">
			<Button variant="outline" onclick={() => (isEditModalOpen = false)}>
				{strings.common.cancel}
			</Button>
			<Button
				onclick={saveEdit}
				disabled={isSavingEdit || (editEnd !== null && editEnd <= editStart)}
			>
				{isSavingEdit ? 'Сохранение…' : 'Сохранить'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

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
