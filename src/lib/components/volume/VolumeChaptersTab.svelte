<script lang="ts">
	import { audioStore } from '$lib/audio-store.svelte';
	import {
		db,
		type OfflineChapter,
		type OfflineProgress,
		type OfflineVolume,
		type OfflineChapterLike
	} from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { useSession } from '$lib/client/session.svelte';
	import { likeService } from '$lib/client/services/likeService';
	import GuestAuthModal from '$lib/components/auth/GuestAuthModal.svelte';
	import type { Track } from '$lib/html-audio';
	import DownloadButton from '$lib/components/audio/Download.svelte';
	import ChapterCommentsDrawer from '$lib/components/comments/ChapterCommentsDrawer.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Play, Pause, MessageSquare, Check, Heart } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	interface Props {
		volume: OfflineVolume | undefined;
		chapters: OfflineChapter[];
		bookId: string;
		isLoading?: boolean;
	}

	let { volume, chapters, bookId, isLoading = false }: Props = $props();

	const session = useSession();
	let isGuestModalOpen = $state(false);

	// Load saved progress for all chapters
	const progressQuery = useDexie(
		() => db.progress.toArray(),
		() => [] as OfflineProgress[],
		() => []
	);

	const progressMap = $derived.by(() => {
		const map = new SvelteMap<string, OfflineProgress>();
		for (const p of progressQuery.data) {
			map.set(p.chapterId, p);
		}
		return map;
	});

	// Load liked chapters from Dexie
	const chapterLikesQuery = useDexie(
		() => db.chapterLikes.toArray(),
		() => [] as OfflineChapterLike[],
		() => []
	);

	const likedChapterIds = $derived.by(() => {
		const set = new SvelteSet<string>();
		for (const l of chapterLikesQuery.data) {
			set.add(l.chapterId);
		}
		return set;
	});

	async function handleToggleChapterLike(e: MouseEvent, chapter: OfflineChapter) {
		e.stopPropagation();
		if (!session.user) {
			isGuestModalOpen = true;
			return;
		}
		await likeService.toggleChapterLike(chapter.id, chapter.likesCount);
	}

	let selectedChapterForComments = $state<OfflineChapter | null>(null);
	let isCommentsDrawerOpen = $state(false);

	function formatDuration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	async function handlePlayChapter(chapter: OfflineChapter, index: number) {
		if (audioStore.currentTrack?.id === chapter.id) {
			audioStore.togglePlay();
			return;
		}

		const savedProgress = progressMap.get(chapter.id);
		const startTime =
			savedProgress && !savedProgress.isCompleted && savedProgress.progressSeconds > 0
				? savedProgress.progressSeconds
				: 0;

		const tracks: Track[] = chapters.map((c) => ({
			id: c.id,
			url: c.audioUrl,
			title: c.title,
			duration: c.durationSeconds,
			artwork: volume?.coverUrl,
			album: volume?.title,
			volumeId: volume?.id,
			bookId,
			startTime: c.id === chapter.id ? startTime : 0
		}));

		audioStore.setQueueAndPlay(tracks, index);
	}

	function handleChapterRowClick(e: MouseEvent, chapter: OfflineChapter, index: number) {
		const isCurrent = audioStore.currentTrack?.id === chapter.id;

		if (!isCurrent) {
			handlePlayChapter(chapter, index);
			return;
		}

		// When already playing: secondary click on empty row area seeks chapter timeline
		const row = e.currentTarget as HTMLElement;
		const rect = row.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const ratio = Math.max(0, Math.min(1, clickX / rect.width));

		const targetSeconds = ratio * (chapter.durationSeconds || audioStore.duration || 0);
		audioStore.seek(targetSeconds);
	}

	function openComments(e: MouseEvent, chapter: OfflineChapter) {
		e.stopPropagation();
		selectedChapterForComments = chapter;
		isCommentsDrawerOpen = true;
	}
</script>

<div
	class="overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm"
>
	{#if isLoading}
		<ul class="divide-y divide-border/40">
			{#each Array.from({ length: 5 }, (_, k) => k) as idx (idx)}
				<li class="flex items-center justify-between p-4">
					<div class="flex flex-1 items-center gap-4">
						<Skeleton class="h-9 w-9 shrink-0 rounded-full" />
						<div class="flex-1 space-y-2">
							<Skeleton class="h-4 w-3/4 max-w-50" />
							<Skeleton class="h-3 w-1/3 max-w-30" />
						</div>
					</div>
					<Skeleton class="h-8 w-16 shrink-0 rounded-md" />
				</li>
			{/each}
		</ul>
	{:else if chapters.length === 0}
		<div class="p-10 text-center">
			<p class="text-sm text-muted-foreground">Главы не найдены или загружаются...</p>
		</div>
	{:else}
		<ul class="divide-y divide-border/40">
			{#each chapters as chapter, index (chapter.id)}
				{@const isCurrent = audioStore.currentTrack?.id === chapter.id}
				{@const isPlaying = isCurrent && audioStore.isPlaying}
				{@const saved = progressMap.get(chapter.id)}
				{@const currentTrackTime = isCurrent
					? audioStore.currentTime
					: (saved?.progressSeconds ?? 0)}
				{@const progressPercent =
					chapter.durationSeconds > 0
						? Math.min(100, Math.max(0, (currentTrackTime / chapter.durationSeconds) * 100))
						: 0}

				<li class="relative">
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						role="button"
						tabindex="0"
						onclick={(e) => handleChapterRowClick(e, chapter, index)}
						class="group relative flex cursor-pointer items-center justify-between p-3.5 transition-colors select-none focus:outline-none focus-visible:bg-muted/40 {isCurrent
							? 'bg-primary/5'
							: 'hover:bg-muted/30'}"
					>
						<!-- Интерактивный фон-прогрессбар для активной главы -->
						{#if isCurrent}
							<div
								class="pointer-events-none absolute inset-y-0 left-0 bg-primary/10 transition-all duration-150"
								style="width: {progressPercent}%;"
							></div>
						{/if}

						<!-- Левая часть: кнопка воспроизведения, номер, название, прогресс -->
						<div class="relative z-10 flex min-w-0 flex-1 items-center gap-3.5">
							<!-- Кнопка Play / Pause -->
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									handlePlayChapter(chapter, index);
								}}
								class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-200 {isCurrent
									? 'scale-105 bg-primary text-primary-foreground shadow-sm'
									: 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'}"
								aria-label={isPlaying
									? `Пауза: ${chapter.title}`
									: `Воспроизвести: ${chapter.title}`}
							>
								{#if isPlaying}
									<Pause class="h-4 w-4 fill-current" />
								{:else if isCurrent}
									<Play class="ml-0.5 h-4 w-4 fill-current" />
								{:else}
									<span class="group-hover:hidden">{chapter.chapterNumber}</span>
									<Play class="ml-0.5 hidden h-4 w-4 fill-current group-hover:block" />
								{/if}
							</button>

							<!-- Название главы и статус прогресса -->
							<div class="min-w-0 flex-1 pr-2">
								<h3
									class="truncate text-sm font-medium transition-colors {isCurrent
										? 'font-bold text-primary'
										: 'text-foreground'}"
								>
									{chapter.title}
								</h3>

								<div class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
									{#if isCurrent}
										<span class="font-mono font-semibold text-primary">
											{formatDuration(audioStore.currentTime)} / {formatDuration(
												chapter.durationSeconds
											)}
										</span>
									{:else if saved?.isCompleted}
										<span
											class="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400"
										>
											<Check class="h-3 w-3" />
											<span>Прослушано</span>
										</span>
									{:else if saved && saved.progressSeconds > 0}
										<span class="font-mono">
											{formatDuration(saved.progressSeconds)} / {formatDuration(
												chapter.durationSeconds
											)}
										</span>
									{:else}
										<span class="font-mono">{formatDuration(chapter.durationSeconds)}</span>
									{/if}

									<!-- Тонкая полоска прогресса для непроигрываемых глав -->
									{#if !isCurrent && saved && !saved.isCompleted && saved.progressSeconds > 0}
										<div class="h-1 w-12 overflow-hidden rounded-full bg-muted">
											<div
												class="h-full rounded-full bg-primary/60"
												style="width: {progressPercent}%;"
											></div>
										</div>
									{/if}
								</div>
							</div>
						</div>

						<!-- Правая часть: кнопка лайка, комментариев, скачивание -->
						<div class="relative z-10 flex shrink-0 items-center gap-1 pl-2 sm:gap-2">
							<!-- Кнопка лайка главы -->
							<Button
								variant="ghost"
								size="sm"
								class="h-8 gap-1 px-2 text-xs transition-colors {likedChapterIds.has(chapter.id)
									? 'text-rose-500 hover:text-rose-600'
									: 'text-muted-foreground hover:text-foreground'}"
								onclick={(e) => handleToggleChapterLike(e, chapter)}
								title={likedChapterIds.has(chapter.id) ? 'Убрать лайк' : 'Поставить лайк'}
								aria-label={likedChapterIds.has(chapter.id)
									? `Убрать лайк с ${chapter.title}`
									: `Лайкнуть ${chapter.title}`}
							>
								<Heart
									class="h-3.5 w-3.5 transition-transform active:scale-125 {likedChapterIds.has(
										chapter.id
									)
										? 'fill-rose-500 text-rose-500'
										: ''}"
								/>
								<span class="font-medium">{chapter.likesCount || 0}</span>
							</Button>

							<!-- Кнопка комментариев к конкретной главе -->
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 text-muted-foreground hover:text-foreground"
								onclick={(e) => openComments(e, chapter)}
								title="Комментарии к главе"
							>
								<MessageSquare class="h-4 w-4" />
							</Button>

							<!-- Кнопка скачивания главы -->
							<DownloadButton {chapter} class="h-8 w-8" />
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<!-- Модальное окно с комментариями Telegram выбранной главы -->
<ChapterCommentsDrawer
	bind:open={isCommentsDrawerOpen}
	chapter={selectedChapterForComments}
	volumeTitle={volume?.title}
/>

<!-- Модальное окно авторизации для гостей при попытке лайкнуть главу -->
<GuestAuthModal bind:open={isGuestModalOpen} />
