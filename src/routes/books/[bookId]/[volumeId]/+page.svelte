<script lang="ts">
	import { audioStore } from '$lib/audio-store.svelte.js';
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { Pause, Play } from '@lucide/svelte';
	import type { Track } from '$lib/html-audio.js';
	import { scale } from 'svelte/transition';

	import DownloadButton from '$lib/components/audio/Download.svelte';
	import { useDownloads } from '$lib/client/downloads/downloadManager.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { XCircle, Check, Download as DownloadIcon } from '@lucide/svelte';

	let { data } = $props();
	let hoveredIndex = $state<number | null>(null);

	const volumeQuery = useDexie(
		() => db.volumes.get(data.volumeId),
		() => undefined,
		() => [data.volumeId]
	);
	const chaptersQuery = useDexie(
		() => db.chapters.where('volumeId').equals(data.volumeId).sortBy('chapterNumber'),
		() => [],
		() => [data.volumeId]
	);

	const manager = useDownloads();

	const volumeChapters = $derived(chaptersQuery.data);
	const isVolumeDownloading = $derived(
		volumeChapters.some((c) => manager.isDownloading(c.id) || manager.isQueued(c.id))
	);
	const isFullyDownloaded = $derived(
		volumeChapters.length > 0 && volumeChapters.every((c) => manager.isDownloaded(c.id))
	);
	const volumeProgress = $derived.by(() => {
		const total = volumeChapters.length;
		const current = volumeChapters.filter((c) => manager.isDownloaded(c.id)).length;
		return { current, total };
	});

	const formatDuration = (seconds: number) => {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	};

	async function handlePlayChapter(index: number) {
		const chapter = chaptersQuery.data[index];
		if (!chapter) return;

		if (audioStore.currentTrack?.id === chapter.id) {
			audioStore.togglePlay();
		} else {
			// Read saved progress for the selected chapter
			const savedProgress = await db.progress.get(chapter.id);
			const startTime =
				savedProgress && !savedProgress.isCompleted && savedProgress.progressSeconds > 0
					? savedProgress.progressSeconds
					: 0;

			const tracks: Track[] = chaptersQuery.data.map((c) => ({
				id: c.id,
				url: c.audioUrl,
				title: c.title,
				duration: c.durationSeconds,
				artwork: volumeQuery.data?.coverUrl,
				album: volumeQuery.data?.title,
				volumeId: volumeQuery.data?.id,
				bookId: data.bookId,
				// Only the clicked chapter starts from the saved position
				startTime: c.id === chapter.id ? startTime : 0
			}));
			audioStore.setQueueAndPlay(tracks, index);
		}
	}
</script>

<svelte:head>
	<title>{volumeQuery.data?.title || 'Том'} | Главы</title>
</svelte:head>

<main class="layout-content py-4 md:py-8">
	<div class="mb-8 flex flex-col items-start gap-6 md:flex-row">
		{#if volumeQuery.isLoading}
			<Skeleton class="aspect-2/3 w-32 shrink-0 rounded-lg shadow-md md:w-48" />
		{:else if volumeQuery.data?.coverUrl}
			<img
				src={volumeQuery.data.coverUrl}
				alt={volumeQuery.data.title}
				class="aspect-2/3 w-32 shrink-0 rounded-lg object-cover shadow-md md:w-48"
			/>
		{/if}
		<div class="w-full">
			{#if volumeQuery.isLoading}
				<Skeleton class="mb-4 h-9 w-3/4 md:w-1/2" />
				<Skeleton class="mb-2 h-4 w-full max-w-2xl" />
				<Skeleton class="mb-2 h-4 w-5/6 max-w-2xl" />
				<Skeleton class="h-4 w-2/3 max-w-2xl" />
			{:else}
				<h1 class="mb-2 text-3xl font-extrabold tracking-tight">
					{volumeQuery.data?.title || 'Загрузка...'}
				</h1>
				{#if volumeQuery.data?.description}
					<p class="mt-2 max-w-2xl text-muted-foreground">{volumeQuery.data.description}</p>
				{/if}
			{/if}
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
		<div class="flex items-center justify-between border-b bg-muted/20 p-4">
			<h2 class="text-lg font-semibold">Список глав</h2>

			{#if isVolumeDownloading}
				<Button
					variant="destructive"
					size="sm"
					onclick={() => manager.cancelVolumeQueue(data.volumeId)}
				>
					<XCircle class="mr-1.5 h-4 w-4" />
					Отменить ({volumeProgress.current}/{volumeProgress.total})
				</Button>
			{:else if isFullyDownloaded}
				<span class="flex items-center gap-1 text-sm text-green-600">
					<Check class="h-4 w-4" /> Все главы загружены
				</span>
			{:else if volumeChapters.length > 0}
				<Button
					variant="outline"
					size="sm"
					onclick={() => manager.enqueueVolume(data.volumeId, chaptersQuery.data)}
				>
					<DownloadIcon class="mr-1.5 h-4 w-4" />
					Скачать все
				</Button>
			{/if}
		</div>

		{#if chaptersQuery.isLoading}
			<ul class="divide-y">
				{#each Array(5)}
					<li class="flex items-center justify-between p-3">
						<div class="flex flex-1 items-center gap-4">
							<Skeleton class="h-8 w-8 shrink-0 rounded-full" />
							<div class="flex-1 space-y-2">
								<Skeleton class="h-4 w-3/4 max-w-50" />
								<Skeleton class="h-3 w-1/2 max-w-30" />
							</div>
						</div>
						<Skeleton class="h-8 w-8 shrink-0 rounded-md" />
					</li>
				{/each}
			</ul>
		{:else if chaptersQuery.data.length === 0}
			<div class="p-8 text-center">
				<p class="text-muted-foreground">Главы не найдены.</p>
			</div>
		{:else}
			<ul class="divide-y">
				{#each chaptersQuery.data as chapter, index (chapter.id)}
					{@const isCurrent = audioStore.currentTrack?.id === chapter.id}
					{@const isPlaying = isCurrent && audioStore.isPlaying}
					{@const showControl = isCurrent || hoveredIndex === index}

					<li
						class="group flex items-center justify-between p-3 transition-colors hover:bg-muted/10"
						onmouseenter={() => (hoveredIndex = index)}
						onmouseleave={() => (hoveredIndex = null)}
					>
						<button
							type="button"
							onclick={() => handlePlayChapter(index)}
							class="flex flex-1 cursor-pointer items-center gap-4 rounded-md p-1 text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label={isCurrent && isPlaying
								? `Пауза: ${chapter.title}`
								: `Воспроизвести: ${chapter.title}`}
						>
							<div
								class="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold transition-all duration-200 {isCurrent
									? 'scale-105 bg-primary text-primary-foreground shadow-sm'
									: 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'}"
							>
								{#if showControl}
									<div
										class="absolute inset-0 flex items-center justify-center"
										transition:scale={{ duration: 150, start: 0.8 }}
									>
										{#if isPlaying}
											<Pause class="h-4 w-4 fill-current" />
										{:else}
											<Play class="ml-0.5 h-4 w-4 fill-current" />
										{/if}
									</div>
								{:else}
									<div
										class="absolute inset-0 flex items-center justify-center"
										transition:scale={{ duration: 150, start: 0.8 }}
									>
										{chapter.chapterNumber}
									</div>
								{/if}
							</div>
							<h3
								class="font-medium transition-colors {isCurrent
									? 'font-semibold text-primary'
									: ''}"
							>
								{chapter.title}
							</h3>
						</button>

						<div class="flex shrink-0 items-center gap-3 pl-4">
							<DownloadButton {chapter} class="h-8 w-8" />

							<span class="w-10 text-right text-sm text-muted-foreground tabular-nums">
								{formatDuration(chapter.durationSeconds)}
							</span>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>
