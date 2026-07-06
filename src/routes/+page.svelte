<script lang="ts">
	import { player, type Track } from '$lib/client/player.svelte';
	import { localDb } from '$lib/client/db';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Play, Pause, AudioLines, Sparkles, BookOpen, History, Music } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { liveQuery } from 'dexie';
	import { browser } from '$app/environment';
	import { formatTime } from '$lib/utils';

	let { data } = $props();

	let lastTrack = $state<Track | null>(null);
	let lastTrackProgress = $state<number>(0);
	let lastTrackDuration = $state<number>(100);

	// Fetch last track from localStorage
	onMount(() => {
		const savedTrack = localStorage.getItem('player-last-track');
		if (savedTrack) {
			try {
				lastTrack = JSON.parse(savedTrack) as Track;
			} catch (e) {
				console.error('Failed to parse last track', e);
			}
		}
	});

	// Reactively bind to progress in IndexedDB for the last track
	$effect(() => {
		if (!lastTrack || !browser) return;
		const query = liveQuery(() =>
			localDb.progress
				.where('[bookId+volumeId+chapterId]')
				.equals([lastTrack!.bookId, lastTrack!.volumeId, lastTrack!.chapterId])
				.first()
		);
		const subscription = query.subscribe((progress) => {
			if (progress) {
				lastTrackProgress = progress.currentTime;
				lastTrackDuration = progress.duration || lastTrack!.durationInDb;
			}
		});
		return () => subscription.unsubscribe();
	});

	function playLastTrack() {
		if (!lastTrack) return;
		player.loadTrack(lastTrack, true);
	}
</script>

<div class="max-w-7xl mx-auto px-4 py-8 space-y-8">
	<!-- Hero Section -->
	<section
		class="relative overflow-hidden rounded-3xl border border-border/40 bg-linear-to-br from-primary/5 via-pink-500/5 to-transparent p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8"
	>
		<div class="space-y-4 max-w-lg text-center md:text-left">
			<div
				class="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full border border-primary/20"
			>
				<Sparkles class="h-3.5 w-3.5" />
				Новый аудиокнижный плеер
			</div>
			<h1 class="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-none">
				Слушайте книги в оффлайне
			</h1>
			<p class="text-sm md:text-base text-muted-foreground leading-relaxed">
				hedgehog-x — это современный аудиокнижный плеер, оптимизированный для PWA, с надежным
				локальным кэшированием аудио, бесшовными анимациями плеера и входом по Passkey.
			</p>
			<div class="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
				<Button href="/audiobooks" class="font-semibold shadow-md">
					<BookOpen class="h-4 w-4 mr-2" />
					Открыть каталог
				</Button>
			</div>
		</div>

		<!-- decorative graphic -->
		<div class="hidden lg:block shrink-0">
			<AudioLines class="h-44 w-44 text-primary/10 stroke-[1.5] animate-pulse" />
		</div>
	</section>

	<!-- Continue Listening Widget -->
	{#if lastTrack}
		{@const isPlayingThis =
			player.currentTrack?.chapterId === lastTrack.chapterId && player.isPlaying}
		<section class="space-y-4">
			<div class="flex items-center gap-2">
				<History class="h-5 w-5 text-primary animate-pulse" />
				<h2 class="text-xl font-bold">Продолжить прослушивание</h2>
			</div>

			<Card.Root
				class="overflow-hidden border border-border/40 bg-card/60 backdrop-blur-sm shadow-sm max-w-2xl"
			>
				<div class="flex flex-col sm:flex-row">
					<div
						class="sm:w-1/4 aspect-3/4 sm:aspect-square bg-muted relative overflow-hidden shrink-0"
					>
						{#if lastTrack.coverUrl}
							<img
								src={lastTrack.coverUrl}
								alt={lastTrack.bookTitle}
								class="w-full h-full object-cover"
							/>
						{:else}
							<div class="w-full h-full flex items-center justify-center text-primary/40">
								<Music class="h-12 w-12" />
							</div>
						{/if}
					</div>

					<div class="p-6 flex-1 flex flex-col justify-between gap-4">
						<div class="space-y-1">
							<h3 class="font-bold text-base line-clamp-1">{lastTrack.title}</h3>
							<p class="text-xs text-muted-foreground line-clamp-1">
								Книга: {lastTrack.bookTitle} &middot; {lastTrack.bookAuthor}
							</p>
						</div>

						<div class="space-y-3">
							<!-- Timeline Progress -->
							<div class="space-y-1.5">
								<div class="h-1.5 bg-muted rounded-full overflow-hidden">
									<div
										class="h-full bg-primary transition-all duration-300"
										style="width: {(lastTrackProgress / (lastTrackDuration || 1)) * 100}%"
									></div>
								</div>
								<div
									class="flex justify-between text-[10px] font-mono text-muted-foreground tabular-nums"
								>
									<span>{formatTime(lastTrackProgress)}</span>
									<span>{formatTime(lastTrackDuration)}</span>
								</div>
							</div>

							<!-- Play Control -->
							<Button
								variant={isPlayingThis ? 'outline' : 'default'}
								size="sm"
								class="w-full font-medium"
								onclick={isPlayingThis ? () => player.pause() : playLastTrack}
							>
								{#if isPlayingThis}
									<Pause class="mr-2 h-4 w-4 fill-current" />
									Пауза
								{:else}
									<Play class="mr-2 h-4 w-4 fill-current" />
									Продолжить
								{/if}
							</Button>
						</div>
					</div>
				</div>
			</Card.Root>
		</section>
	{/if}

	<!-- Recent Releases Carousel -->
	<section class="space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-primary" />
				<h2 class="text-xl font-bold">Новые релизы</h2>
			</div>
			<Button
				href="/audiobooks"
				variant="ghost"
				size="sm"
				class="text-xs text-muted-foreground hover:text-foreground"
			>
				Смотреть все
			</Button>
		</div>

		{#if data?.books?.length > 0}
			<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
				{#each data?.books || [] as book (book.id)}
					<Card.Root
						class="overflow-hidden border border-border/40 hover:border-primary/40 shadow-sm transition-all duration-300 group"
					>
						<a href="/audiobooks/{book.id}" class="outline-none block">
							<div class="aspect-3/4 bg-muted relative overflow-hidden">
								{#if book.coverUrl}
									<img
										src={book.coverUrl}
										alt={book.title}
										class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
									/>
								{:else}
									<div class="w-full h-full flex items-center justify-center text-primary/40">
										<BookOpen class="h-12 w-12" />
									</div>
								{/if}
							</div>
							<div class="p-4 space-y-1">
								<h3 class="font-bold text-sm truncate group-hover:text-primary transition-colors">
									{book.title}
								</h3>
								<p class="text-xs text-muted-foreground line-clamp-1">
									{book.description || 'Нет описания'}
								</p>
							</div>
						</a>
					</Card.Root>
				{/each}
			</div>
		{:else}
			<div
				class="bg-muted/40 border border-border/20 rounded-2xl p-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2"
			>
				<BookOpen class="h-5 w-5 opacity-40 animate-pulse" />
				<span>В каталоге пока нет доступных книг.</span>
			</div>
		{/if}
	</section>
</div>
