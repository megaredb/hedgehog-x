<script lang="ts">
	import { resolve } from '$app/paths';
	import { audioStore } from '$lib/audio-store.svelte';
	import {
		db,
		type OfflineProgress,
		type OfflineChapter,
		type OfflineVolume,
		type OfflineBook
	} from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { PaginationBar } from '$lib/components/ui/pagination';
	import { Progress } from '$lib/components/ui/progress';
	import { strings } from '$lib/constants/strings';
	import { History, Play, Trash2, BookOpen, CheckCircle2, Clock } from '@lucide/svelte';

	interface EnrichedHistoryItem extends OfflineProgress {
		chapter?: OfflineChapter;
		volume?: OfflineVolume;
		book?: OfflineBook;
	}

	const historyQuery = useDexie(
		async () => {
			const items = await db.progress.toArray();
			// Filter out items with no progress and not completed
			const filtered = items.filter((p) => p.progressSeconds > 0 || p.isCompleted);
			filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

			const enriched: EnrichedHistoryItem[] = await Promise.all(
				filtered.map(async (p) => {
					const chapter = await db.chapters.get(p.chapterId);
					const volume = chapter ? await db.volumes.get(chapter.volumeId) : undefined;
					const book = volume ? await db.books.get(volume.bookId) : undefined;
					return {
						...p,
						chapter,
						volume,
						book
					};
				})
			);
			return enriched;
		},
		() => [] as EnrichedHistoryItem[]
	);

	let isClearModalOpen = $state(false);

	let currentPage = $state(1);
	let pageSize = $state(10);

	const paginatedHistory = $derived(
		historyQuery.data.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	function formatTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		if (h > 0) {
			return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		}
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function formatRelativeTime(timestamp: number): string {
		if (!timestamp) return '';
		const diffMs = Date.now() - timestamp;
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin < 1) return 'Только что';
		if (diffMin < 60) return `${diffMin} мин. назад`;
		const diffHours = Math.floor(diffMin / 60);
		if (diffHours < 24) return `${diffHours} ч. назад`;
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays === 1) return strings.history.yesterday;
		if (diffDays < 7) return `${diffDays} дн. назад`;
		return new Date(timestamp).toLocaleDateString('ru-RU', {
			day: 'numeric',
			month: 'short'
		});
	}

	async function handleResume(item: EnrichedHistoryItem) {
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
			volumeId: item.volume?.id
		}));

		const startIndex = tracks.findIndex((t) => t.id === item.chapterId);
		if (startIndex !== -1) {
			audioStore.setQueueAndPlay(tracks, startIndex);
			const targetSeek = item.isCompleted ? 0 : item.progressSeconds;
			if (targetSeek > 0) {
				setTimeout(() => {
					audioStore.seek(targetSeek, false);
				}, 100);
			}
		}
	}

	async function confirmClearHistory() {
		await db.progress.clear();
		isClearModalOpen = false;
	}
</script>

<svelte:head>
	<title>{strings.history.title} | Hedgehog X</title>
</svelte:head>

<div class="layout-content mx-auto max-w-5xl py-6 md:py-10">
	<div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm"
			>
				<History class="h-5 w-5" />
			</div>
			<div>
				<h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
					{strings.history.title}
				</h1>
				<p class="text-xs text-muted-foreground sm:text-sm">
					{strings.history.subtitle}
				</p>
			</div>
		</div>

		{#if historyQuery.data.length > 0}
			<Button
				variant="outline"
				size="sm"
				class="gap-1.5 self-start rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:self-auto"
				onclick={() => (isClearModalOpen = true)}
			>
				<Trash2 class="h-4 w-4" />
				<span>{strings.history.clearHistory}</span>
			</Button>
		{/if}
	</div>

	{#if historyQuery.isLoading}
		<div class="space-y-4">
			{#each Array.from({ length: 3 }, (_, k) => k) as idx (idx)}
				<div class="h-28 w-full animate-pulse rounded-2xl bg-muted/40"></div>
			{/each}
		</div>
	{:else if historyQuery.data.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/50 p-12 text-center backdrop-blur-xs"
		>
			<div
				class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground"
			>
				<History class="h-8 w-8" />
			</div>
			<h2 class="text-lg font-semibold text-foreground">{strings.history.emptyTitle}</h2>
			<p class="mt-1.5 max-w-md text-xs text-muted-foreground sm:text-sm">
				{strings.history.emptyDescription}
			</p>
			<Button href={resolve('/')} class="mt-6 gap-2">
				<BookOpen class="h-4 w-4" />
				<span>{strings.nav.catalog}</span>
			</Button>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each paginatedHistory as item (item.chapterId)}
				{@const duration = item.chapter?.durationSeconds || 1}
				{@const progressPct = Math.min(100, Math.round((item.progressSeconds / duration) * 100))}
				{@const isFinished = item.isCompleted || progressPct >= 95}

				<Card.Root
					class="group overflow-hidden border-border/60 bg-card/60 transition-all duration-200 hover:border-border hover:shadow-md"
				>
					<div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
						<!-- Book & Chapter info -->
						<div class="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
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

							<div class="min-w-0 flex-1 space-y-2">
								<div class="flex flex-wrap items-center gap-2">
									{#if isFinished}
										<span
											class="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500"
										>
											<CheckCircle2 class="h-3 w-3" />
											<span>{strings.history.completed}</span>
										</span>
									{:else}
										<span
											class="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
										>
											<Clock class="h-3 w-3" />
											<span>{progressPct}%</span>
										</span>
									{/if}

									{#if item.updatedAt}
										<span class="text-xxs text-muted-foreground/70">
											{formatRelativeTime(item.updatedAt)}
										</span>
									{/if}
								</div>

								<div>
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
								</div>

								<!-- Progress bar -->
								<div class="space-y-1 pt-1">
									<Progress value={progressPct} class="h-1.5 w-full max-w-md" />
									<div class="text-xxs flex max-w-md justify-between text-muted-foreground">
										<span>{formatTime(item.progressSeconds)}</span>
										<span>{formatTime(duration)}</span>
									</div>
								</div>
							</div>
						</div>

						<!-- Resume Action -->
						<div class="flex items-center justify-end gap-2 pt-2 sm:pt-0">
							<Button
								size="sm"
								class="gap-1.5 rounded-xl font-medium"
								onclick={() => handleResume(item)}
							>
								<Play class="h-3.5 w-3.5 fill-current" />
								<span>{strings.history.resume}</span>
							</Button>
						</div>
					</div>
				</Card.Root>
			{/each}
		</div>

		{#if historyQuery.data.length > 0}
			<PaginationBar totalItems={historyQuery.data.length} bind:currentPage bind:pageSize />
		{/if}
	{/if}
</div>

<!-- Clear History Confirm Dialog -->
<Dialog.Root bind:open={isClearModalOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{strings.history.clearConfirmTitle}</Dialog.Title>
			<Dialog.Description>
				{strings.history.clearConfirmDescription}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex gap-2 sm:justify-end">
			<Button variant="outline" onclick={() => (isClearModalOpen = false)}>
				{strings.common.cancel}
			</Button>
			<Button variant="destructive" onclick={confirmClearHistory}>
				{strings.history.clearHistory}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
