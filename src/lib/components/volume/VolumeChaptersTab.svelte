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
	import { formatDuration } from '$lib/utils/time';
	import { audioVersionKey } from '$lib/audio-version';
	import DownloadButton from '$lib/components/audio/Download.svelte';
	import ChapterCommentsDrawer from '$lib/components/comments/ChapterCommentsDrawer.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Play, Pause, MessageSquare, Check, Heart } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	interface ChapterAudioVersion {
		id: string;
		chapterId: string;
		versionId: string;
		title: string;
		audioUrl: string;
		durationSeconds: number;
		chapterStart: number;
		chapterEnd: number;
	}

	interface Props {
		volume: OfflineVolume | undefined;
		chapters: OfflineChapter[];
		bookId: string;
		isLoading?: boolean;
		selectedVersionId?: string;
		chapterVersions?: ChapterAudioVersion[];
		chapterVersionLikes?: Array<{ chapterId: string; versionId: string; count: number }>;
	}

	let {
		volume,
		chapters,
		bookId,
		isLoading = false,
		selectedVersionId = 'default',
		chapterVersions = [],
		chapterVersionLikes = []
	}: Props = $props();

	const activeVersionId = $derived(selectedVersionId || 'default');
	const isDefaultVersion = $derived(activeVersionId === 'default');
	const versionTracks = $derived(
		chapterVersions.filter((version) => version.versionId === activeVersionId)
	);
	const versionTrackMap = $derived(
		new Map(versionTracks.map((version) => [version.chapterId, version]))
	);

	function versionTrackFor(chapterId: string): ChapterAudioVersion | undefined {
		return isDefaultVersion ? undefined : versionTrackMap.get(chapterId);
	}

	function isChapterAvailable(chapter: OfflineChapter): boolean {
		return isDefaultVersion || !!versionTrackFor(chapter.id);
	}

	const versionLikesMap = $derived(
		new Map(
			chapterVersionLikes.map((item) => [
				audioVersionKey(item.chapterId, item.versionId),
				item.count
			])
		)
	);
	let likeCountOverrides = $state<Record<string, number>>({});

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
		const key = audioVersionKey(chapter.id, activeVersionId);
		const baseCount =
			likeCountOverrides[key] ??
			versionLikesMap.get(key) ??
			(activeVersionId === 'default' ? chapter.likesCount : 0);
		const result = await likeService.toggleChapterLike(chapter.id, baseCount, activeVersionId);
		likeCountOverrides[key] = result.likesCount;
	}

	function likesFor(chapter: OfflineChapter): number {
		const key = audioVersionKey(chapter.id, activeVersionId);
		return (
			likeCountOverrides[key] ??
			versionLikesMap.get(key) ??
			(activeVersionId === 'default' ? chapter.likesCount : 0)
		);
	}

	let selectedChapterForComments = $state<OfflineChapter | null>(null);
	let isCommentsDrawerOpen = $state(false);
	let seekingChapterId = $state<string | null>(null);

	function buildSelectedVersionTracks(): Track[] {
		if (isDefaultVersion) {
			return chapters.map((chapter) => ({
				id: chapter.id,
				url: chapter.audioUrl,
				title: chapter.title,
				duration: chapter.durationSeconds,
				versionId: 'default',
				artwork: volume?.coverUrl,
				album: volume?.title,
				volumeId: volume?.id,
				bookId,
				startTime: 0
			}));
		}

		return versionTracks.flatMap((version) => {
			const chapter = chapters.find((item) => item.id === version.chapterId);
			if (!chapter) return [];
			return [
				{
					id: chapter.id,
					url: version.audioUrl,
					title: version.title || chapter.title,
					duration: version.durationSeconds,
					versionId: activeVersionId,
					artwork: volume?.coverUrl,
					album: volume?.title,
					volumeId: volume?.id,
					bookId,
					startTime: 0
				}
			];
		});
	}

	async function handlePlayChapter(chapter: OfflineChapter) {
		if (!isChapterAvailable(chapter)) return;

		const tracks = buildSelectedVersionTracks();
		const trackIndex = tracks.findIndex((track) => track.id === chapter.id);
		if (trackIndex === -1) return;

		const currentVersion = audioStore.currentTrack?.versionId ?? 'default';
		if (audioStore.currentTrack?.id === chapter.id && currentVersion === activeVersionId) {
			audioStore.togglePlay();
			return;
		}

		const savedProgress = progressMap.get(audioVersionKey(chapter.id, activeVersionId));
		const startTime =
			savedProgress && !savedProgress.isCompleted && savedProgress.progressSeconds > 0
				? savedProgress.progressSeconds
				: 0;

		tracks[trackIndex] = { ...tracks[trackIndex], startTime };
		audioStore.setQueueAndPlay(tracks, trackIndex);
	}

	function seekAtClientX(clientX: number, row: HTMLElement, chapter: OfflineChapter) {
		const rect = row.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		const duration =
			audioStore.duration ||
			versionTrackFor(chapter.id)?.durationSeconds ||
			chapter.durationSeconds ||
			0;
		audioStore.seek(ratio * duration);
	}

	function handleChapterPointerDown(e: PointerEvent, chapter: OfflineChapter) {
		if (e.button !== 0) return;
		const target = e.target as HTMLElement;
		if (target.closest('button, a, input, textarea, select')) return;
		if (!isChapterAvailable(chapter)) return;
		const currentVersion = audioStore.currentTrack?.versionId ?? 'default';
		if (audioStore.currentTrack?.id !== chapter.id || currentVersion !== activeVersionId) return;

		e.preventDefault();
		seekingChapterId = chapter.id;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		seekAtClientX(e.clientX, e.currentTarget as HTMLElement, chapter);
	}

	function handleChapterPointerMove(e: PointerEvent, chapter: OfflineChapter) {
		if (seekingChapterId !== chapter.id) return;
		seekAtClientX(e.clientX, e.currentTarget as HTMLElement, chapter);
	}

	function handleChapterPointerUp(e: PointerEvent, chapter: OfflineChapter) {
		if (seekingChapterId !== chapter.id) return;
		seekingChapterId = null;
		const row = e.currentTarget as HTMLElement;
		if (row.hasPointerCapture(e.pointerId)) row.releasePointerCapture(e.pointerId);
	}

	function handleChapterRowClick(e: MouseEvent, chapter: OfflineChapter) {
		if (!isChapterAvailable(chapter)) return;
		const currentVersion = audioStore.currentTrack?.versionId ?? 'default';
		const isCurrent =
			audioStore.currentTrack?.id === chapter.id && currentVersion === activeVersionId;

		if (!isCurrent) {
			handlePlayChapter(chapter);
			return;
		}

		// When already playing: secondary click on empty row area seeks chapter timeline
		const row = e.currentTarget as HTMLElement;
		const rect = row.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const ratio = Math.max(0, Math.min(1, clickX / rect.width));

		const duration =
			audioStore.duration ||
			versionTrackFor(chapter.id)?.durationSeconds ||
			chapter.durationSeconds ||
			0;
		audioStore.seek(ratio * duration);
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
			{#each chapters as chapter (chapter.id)}
				{@const versionTrack = versionTrackFor(chapter.id)}
				{@const isAvailable = isDefaultVersion || !!versionTrack}
				{@const currentVersion = audioStore.currentTrack?.versionId ?? 'default'}
				{@const isCurrent =
					audioStore.currentTrack?.id === chapter.id && currentVersion === activeVersionId}
				{@const isPlaying = isCurrent && audioStore.isPlaying}
				{@const saved = progressMap.get(audioVersionKey(chapter.id, activeVersionId))}
				{@const currentTrackTime = isCurrent
					? audioStore.currentTime
					: (saved?.progressSeconds ?? 0)}
				{@const effectiveDuration = isCurrent
					? audioStore.duration || versionTrack?.durationSeconds || chapter.durationSeconds
					: versionTrack?.durationSeconds || chapter.durationSeconds}
				{@const displayTitle = versionTrack?.title || chapter.title}
				{@const progressPercent =
					effectiveDuration > 0
						? Math.min(100, Math.max(0, (currentTrackTime / effectiveDuration) * 100))
						: 0}

				<li class="relative">
					<div
						role="button"
						tabindex={isAvailable ? 0 : -1}
						aria-disabled={!isAvailable}
						onclick={(e) => handleChapterRowClick(e, chapter)}
						onpointerdown={(e) => handleChapterPointerDown(e, chapter)}
						onpointermove={(e) => handleChapterPointerMove(e, chapter)}
						onpointerup={(e) => handleChapterPointerUp(e, chapter)}
						onpointercancel={(e) => handleChapterPointerUp(e, chapter)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handlePlayChapter(chapter);
							}
						}}
						class="group relative flex touch-pan-y items-center justify-between p-3.5 transition-colors select-none focus:outline-none focus-visible:bg-muted/40 {isCurrent
							? 'bg-primary/5'
							: isAvailable
								? 'cursor-pointer hover:bg-muted/30'
								: 'cursor-not-allowed opacity-50 grayscale'}"
					>
						<!-- Interactive background progress for active chapter -->
						{#if isCurrent}
							<div
								class="pointer-events-none absolute inset-y-0 left-0 bg-primary/10 transition-all duration-150"
								style="width: {progressPercent}%;"
							></div>
						{/if}

						<!-- Left section: play button, number, title, progress -->
						<div class="relative z-10 flex min-w-0 flex-1 items-center gap-3.5">
							<!-- Play / Pause Button -->
							<button
								type="button"
								disabled={!isAvailable}
								onclick={(e) => {
									e.stopPropagation();
									handlePlayChapter(chapter);
								}}
								class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-200 {isCurrent
									? 'scale-105 bg-primary text-primary-foreground shadow-sm'
									: isAvailable
										? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
										: 'bg-muted text-muted-foreground'}"
								aria-label={isPlaying
									? `Пауза: ${chapter.chapterNumber}. ${chapter.title}`
									: `Воспроизвести: ${chapter.chapterNumber}. ${chapter.title}`}
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

							<!-- Chapter title and progress status -->
							<div class="min-w-0 flex-1 pr-2">
								<h2
									class="truncate text-sm font-medium transition-colors {isCurrent
										? 'font-bold text-primary'
										: 'text-foreground'}"
								>
									{displayTitle}
									{#if !isAvailable}
										<span
											class="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
										>
											Нет в этой озвучке
										</span>
									{/if}
								</h2>

								<div class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
									{#if !isAvailable}
										<span>{formatDuration(chapter.durationSeconds)}</span>
									{:else if isCurrent}
										<span class="font-mono font-semibold text-primary">
											{formatDuration(audioStore.currentTime)} / {formatDuration(effectiveDuration)}
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
											{formatDuration(saved.progressSeconds)} / {formatDuration(effectiveDuration)}
										</span>
									{:else}
										<span class="font-mono">{formatDuration(effectiveDuration)}</span>
									{/if}

									<!-- Progress bar for non-active chapters -->
									{#if isAvailable && !isCurrent && saved && !saved.isCompleted && saved.progressSeconds > 0}
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

						<!-- Right section: likes, comments, downloads -->
						<div class="relative z-10 flex shrink-0 items-center gap-1 pl-2 sm:gap-2">
							<!-- Chapter like button -->
							<Button
								variant="ghost"
								size="sm"
								class="h-8 gap-1 px-2 text-xs transition-colors {likedChapterIds.has(
									audioVersionKey(chapter.id, activeVersionId)
								)
									? 'text-rose-500 hover:text-rose-600'
									: 'text-muted-foreground hover:text-foreground'}"
								onclick={(e) => handleToggleChapterLike(e, chapter)}
								title={likedChapterIds.has(audioVersionKey(chapter.id, activeVersionId))
									? 'Убрать лайк'
									: 'Поставить лайк'}
								aria-label={(likedChapterIds.has(audioVersionKey(chapter.id, activeVersionId))
									? `Убрать лайк с ${chapter.title}`
									: `Лайкнуть ${chapter.title}`) + ` ${likesFor(chapter)}`}
							>
								<Heart
									class="h-3.5 w-3.5 transition-transform active:scale-125 {likedChapterIds.has(
										audioVersionKey(chapter.id, activeVersionId)
									)
										? 'fill-rose-500 text-rose-500'
										: ''}"
								/>
								<span class="font-medium">{likesFor(chapter)}</span>
							</Button>

							<!-- Comments button for chapter -->
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 text-muted-foreground hover:text-foreground"
								onclick={(e) => openComments(e, chapter)}
								title="Комментарии к главе"
							>
								<MessageSquare class="h-4 w-4" />
							</Button>

							<!-- Chapter download button: downloads are currently bound to the default audio file. -->
							{#if isDefaultVersion}
								<DownloadButton {chapter} class="h-8 w-8" />
							{/if}
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<!-- Telegram comments drawer for selected chapter -->
<ChapterCommentsDrawer
	bind:open={isCommentsDrawerOpen}
	chapter={selectedChapterForComments}
	volumeTitle={volume?.title}
/>

<!-- Guest authorization modal on like attempt -->
<GuestAuthModal bind:open={isGuestModalOpen} />
