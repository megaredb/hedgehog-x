<script lang="ts">
	import { audioStore } from '$lib/audio-store.svelte.js';
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { Pause, Play } from '@lucide/svelte';
	import { formatDuration, type Track } from '$lib/html-audio.js';
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
	<title>{volumeQuery.data?.title || 'Том'} — HEDGEHOG.INC</title>
</svelte:head>

<main class="layout-content py-4 md:py-8">
	<div class="mb-8 flex flex-col md:flex-row gap-6 items-start">
		{#if volumeQuery.isLoading}
			<Skeleton class="w-32 md:w-48 rounded-lg shadow-md aspect-2/3 shrink-0" />
		{:else if volumeQuery.data?.coverUrl}
			<img
				src={volumeQuery.data.coverUrl}
				alt={volumeQuery.data.title}
				class="w-32 md:w-48 rounded-lg shadow-md object-cover aspect-2/3 shrink-0"
			/>
		{/if}
		<div class="w-full">
			{#if volumeQuery.isLoading}
				<Skeleton class="h-9 w-3/4 md:w-1/2 mb-4" />
				<Skeleton class="h-4 w-full max-w-2xl mb-2" />
				<Skeleton class="h-4 w-5/6 max-w-2xl mb-2" />
				<Skeleton class="h-4 w-2/3 max-w-2xl" />
			{:else}
				<h1 class="text-3xl font-extrabold tracking-tight mb-2">
					{volumeQuery.data?.title || 'Загрузка...'}
				</h1>
				{#if volumeQuery.data?.description}
					<p class="text-muted-foreground max-w-2xl mt-2">{volumeQuery.data.description}</p>
				{/if}
			{/if}
		</div>
	</div>

	<div class="bg-card text-card-foreground border rounded-2xl shadow-sm overflow-hidden">
		<div class="p-4 border-b bg-muted/20 flex items-center justify-between">
			<h2 class="font-semibold text-lg">Список глав</h2>

			{#if isVolumeDownloading}
				<Button
					variant="destructive"
					size="sm"
					onclick={() => manager.cancelVolumeQueue(data.volumeId)}
				>
					<XCircle class="w-4 h-4 mr-1.5" />
					Отменить ({volumeProgress.current}/{volumeProgress.total})
				</Button>
			{:else if isFullyDownloaded}
				<span class="text-sm text-green-600 flex items-center gap-1">
					<Check class="w-4 h-4" /> Все главы загружены
				</span>
			{:else if volumeChapters.length > 0}
				<Button
					variant="outline"
					size="sm"
					onclick={() => manager.enqueueVolume(data.volumeId, chaptersQuery.data)}
				>
					<DownloadIcon class="w-4 h-4 mr-1.5" />
					Скачать все
				</Button>
			{/if}
		</div>

		{#if chaptersQuery.isLoading}
			<ul class="divide-y">
				{#each Array(5)}
					<li class="flex items-center justify-between p-3">
						<div class="flex-1 flex items-center gap-4">
							<Skeleton class="w-8 h-8 rounded-full shrink-0" />
							<div class="space-y-2 flex-1">
								<Skeleton class="h-4 w-3/4 max-w-50" />
								<Skeleton class="h-3 w-1/2 max-w-30" />
							</div>
						</div>
						<Skeleton class="w-8 h-8 rounded-md shrink-0" />
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
						class="group flex items-center justify-between p-3 hover:bg-muted/10 transition-colors"
						onmouseenter={() => (hoveredIndex = index)}
						onmouseleave={() => (hoveredIndex = null)}
					>
						<button
							type="button"
							onclick={() => handlePlayChapter(index)}
							class="flex-1 flex items-center gap-4 text-left cursor-pointer select-none outline-none p-1 rounded-md focus-visible:ring-2 focus-visible:ring-ring"
							aria-label={isCurrent && isPlaying
								? `Пауза: ${chapter.title}`
								: `Воспроизвести: ${chapter.title}`}
						>
							<div
								class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all duration-200 relative overflow-hidden {isCurrent
									? 'bg-primary text-primary-foreground scale-105 shadow-sm'
									: 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'}"
							>
								{#if showControl}
									<div
										class="absolute inset-0 flex items-center justify-center"
										transition:scale={{ duration: 150, start: 0.8 }}
									>
										{#if isPlaying}
											<Pause class="w-4 h-4 fill-current" />
										{:else}
											<Play class="w-4 h-4 fill-current ml-0.5" />
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
									? 'text-primary font-semibold'
									: ''}"
							>
								{chapter.title}
							</h3>
						</button>

						<div class="flex items-center gap-3 pl-4 shrink-0">
							<DownloadButton {chapter} class="h-8 w-8" />

							<span class="text-sm text-muted-foreground tabular-nums w-10 text-right">
								{formatDuration(chapter.durationSeconds)}
							</span>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>
