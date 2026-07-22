<script lang="ts">
	import { audioStore } from '$lib/audio-store.svelte.js';
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { Pause, Play } from '@lucide/svelte';
	import type { Track } from '$lib/html-audio.js';
	import { scale } from 'svelte/transition';

	let { data } = $props();
	let hoveredIndex = $state<number | null>(null);

	// Данные загрузятся мгновенно из Dexie
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

	// Утилита форматирования времени
	const formatDuration = (seconds: number) => {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	};

	function handlePlayChapter(index: number) {
		const chapter = chaptersQuery.data[index];
		if (!chapter) return;

		if (audioStore.currentTrack?.id === chapter.id) {
			audioStore.togglePlay();
		} else {
			const tracks: Track[] = chaptersQuery.data.map((c) => ({
				id: c.id,
				url: c.audioUrl,
				title: c.title,
				duration: c.durationSeconds,
				artwork: volumeQuery.data?.coverUrl,
				album: volumeQuery.data?.title
			}));
			audioStore.setQueueAndPlay(tracks, index);
		}
	}
</script>

<svelte:head>
	<title>{volumeQuery.data?.title || 'Том'} | Главы</title>
</svelte:head>

<main class="layout-content py-4 md:py-8">
	<div class="mb-8 flex flex-col md:flex-row gap-6 items-start">
		{#if volumeQuery.data?.coverUrl}
			<img
				src={volumeQuery.data.coverUrl}
				alt={volumeQuery.data.title}
				class="w-32 md:w-48 rounded-lg shadow-md object-cover aspect-2/3"
			/>
		{/if}
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight mb-2">
				{volumeQuery.data?.title || 'Загрузка...'}
			</h1>
			{#if volumeQuery.data?.description}
				<p class="text-muted-foreground max-w-2xl mt-2">{volumeQuery.data.description}</p>
			{/if}
		</div>
	</div>

	<div class="bg-card text-card-foreground border rounded-2xl shadow-sm overflow-hidden">
		<div class="p-4 border-b bg-muted/20">
			<h2 class="font-semibold text-lg">Список глав</h2>
		</div>

		{#if chaptersQuery.data.length === 0}
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
						class="group"
						onmouseenter={() => (hoveredIndex = index)}
						onmouseleave={() => (hoveredIndex = null)}
					>
						<button
							type="button"
							onclick={() => handlePlayChapter(index)}
							class="w-full text-left p-4 hover:bg-muted/10 transition-colors flex items-center justify-between cursor-pointer select-none"
							aria-label={audioStore.currentTrack?.id === chapter.id && audioStore.isPlaying
								? `Пауза: ${chapter.title}`
								: `Воспроизвести: ${chapter.title}`}
						>
							<div class="flex items-center gap-4">
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
							</div>

							<div class="flex items-center gap-4">
								<span class="text-sm text-muted-foreground tabular-nums">
									{formatDuration(chapter.durationSeconds)}
								</span>
							</div>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>
