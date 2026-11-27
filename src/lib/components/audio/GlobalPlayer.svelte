<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { audioStore } from '$lib/audio-store.svelte';
	import * as AudioPlayer from '$lib/components/ui/audio/player/index.js';
	import * as Drawer from '$lib/components/ui/drawer/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import TimecodeInput from '$lib/components/audio/TimecodeInput.svelte';
	import BlurhashImage from '$lib/components/common/BlurhashImage.svelte';
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { bookmarkService } from '$lib/client/services/bookmarkService';
	import { strings } from '$lib/constants/strings';
	import { cn } from '$lib/utils';
	import { formatDuration } from '$lib/utils/time';
	import { Bookmark as BookmarkIcon, RotateCcw, X } from '@lucide/svelte';
	import { fly } from 'svelte/transition';

	let isDrawerOpen = $state(false);
	const isLiveBroadcast = $derived(Boolean(audioStore.currentTrack?.broadcastLive));
	const isBroadcast = $derived(Boolean(audioStore.currentTrack?.broadcastId));
	const playbackSource = $derived(isLiveBroadcast ? 'live' : isBroadcast ? 'replay' : 'regular');
	const isBroadcastPage = $derived(
		page.url.pathname === '/broadcasts' || page.url.pathname.startsWith('/broadcasts/')
	);
	const showSourceBadge = $derived(playbackSource !== 'regular' || isBroadcastPage);
	type ScheduledArtwork = { id?: string; imageUrl: string; showAtSeconds: number };
	let fetchedArtworks = $state<ScheduledArtwork[]>([]);
	const scheduledArtworks = $derived.by(() => {
		const raw = audioStore.currentTrack?.illustrations;
		const source = Array.isArray(raw) ? raw : fetchedArtworks;
		return source
			.filter(
				(item): item is ScheduledArtwork =>
					Boolean(item) &&
					typeof item === 'object' &&
					typeof (item as ScheduledArtwork).imageUrl === 'string' &&
					Number.isFinite((item as ScheduledArtwork).showAtSeconds)
			)
			.sort((a, b) => a.showAtSeconds - b.showAtSeconds);
	});
	const broadcastTicks = $derived.by(() => {
		const duration = audioStore.duration || Number(audioStore.currentTrack?.duration ?? 0);
		if (duration <= 0) return [];
		return scheduledArtworks
			.filter((image) => image.showAtSeconds >= 0 && image.showAtSeconds <= duration)
			.map((image) => (image.showAtSeconds / duration) * 100);
	});
	const activeArtwork = $derived.by(() => {
		const fallback = audioStore.currentTrack?.artwork ?? audioStore.currentTrack?.images?.[0];
		if (!scheduledArtworks.length) return fallback;
		const time = audioStore.currentTime;
		return (
			[...scheduledArtworks].reverse().find((image) => image.showAtSeconds <= time)?.imageUrl ??
			fallback
		);
	});
	$effect(() => {
		const track = audioStore.currentTrack;
		const chapterId = String(track?.id ?? '');
		if (!chapterId || Array.isArray(track?.illustrations)) {
			fetchedArtworks = [];
			return;
		}
		const controller = new AbortController();
		fetch('/api/chapters/' + encodeURIComponent(chapterId) + '/illustrations', {
			signal: controller.signal,
			cache: 'no-store'
		})
			.then((response) => (response.ok ? response.json() : null))
			.then((payload) => {
				if (!controller.signal.aborted && Array.isArray(payload?.illustrations)) {
					fetchedArtworks = payload.illustrations;
				}
			})
			.catch(() => {});
		return () => controller.abort();
	});

	let isBookmarkModalOpen = $state(false);
	let bookmarkNote = $state('');
	let bookmarkStart = $state(0);
	let bookmarkEnd = $state<number | null>(null);
	let hasBookmarkEnd = $state(false);
	let isSavingBookmark = $state(false);
	let isBookmarkSaved = $state(false);

	const playerBookmarksQuery = useDexie(
		() => {
			const chapterId = audioStore.currentTrack?.id;
			if (chapterId === undefined || chapterId === null) return Promise.resolve([]);
			return db.bookmarks.where('chapterId').equals(String(chapterId)).toArray();
		},
		() => [],
		() => [
			String(audioStore.currentTrack?.id ?? ''),
			audioStore.currentTrack?.versionId ?? 'default'
		]
	);
	const bookmarkMarkers = $derived.by(() => {
		const versionId = audioStore.currentTrack?.versionId ?? 'default';
		if (!audioStore.duration) return [];
		return playerBookmarksQuery.data
			.filter((bookmark) => (bookmark.versionId ?? 'default') === versionId)
			.map((bookmark) => ({
				id: bookmark.id,
				percent: Math.max(
					0,
					Math.min(100, (bookmark.timestampSeconds / audioStore.duration) * 100)
				),
				endPercent: bookmark.endTimestampSeconds
					? Math.max(0, Math.min(100, (bookmark.endTimestampSeconds / audioStore.duration) * 100))
					: undefined,
				note: bookmark.note || formatDuration(bookmark.timestampSeconds)
			}));
	});

	function openBookmarkModal() {
		if (!audioStore.currentTrack) return;
		bookmarkNote = '';
		bookmarkStart = Math.floor(audioStore.currentTime);
		bookmarkEnd = null;
		hasBookmarkEnd = false;
		isBookmarkSaved = false;
		isBookmarkModalOpen = true;
	}

	async function handleSaveBookmark() {
		if (!audioStore.currentTrack) return;
		isSavingBookmark = true;
		try {
			await bookmarkService.addBookmark({
				chapterId: String(audioStore.currentTrack.id),
				versionId:
					typeof audioStore.currentTrack.versionId === 'string'
						? audioStore.currentTrack.versionId
						: 'default',
				timestampSeconds: bookmarkStart,
				endTimestampSeconds: hasBookmarkEnd ? bookmarkEnd : null,
				note: bookmarkNote,
				...(typeof audioStore.currentTrack.broadcastId === 'string'
					? {
							broadcastId: audioStore.currentTrack.broadcastId,
							broadcastTitle:
								typeof audioStore.currentTrack.broadcastTitle === 'string'
									? audioStore.currentTrack.broadcastTitle
									: undefined,
							broadcastBookTitle:
								typeof audioStore.currentTrack.broadcastBookTitle === 'string'
									? audioStore.currentTrack.broadcastBookTitle
									: undefined,
							broadcastVolumeTitle:
								typeof audioStore.currentTrack.broadcastVolumeTitle === 'string'
									? audioStore.currentTrack.broadcastVolumeTitle
									: undefined,
							broadcastCoverUrl:
								typeof audioStore.currentTrack.broadcastCoverUrl === 'string'
									? audioStore.currentTrack.broadcastCoverUrl
									: undefined,
							broadcastHref:
								typeof audioStore.currentTrack.broadcastHref === 'string'
									? audioStore.currentTrack.broadcastHref
									: undefined
						}
					: {})
			});
			isBookmarkSaved = true;
			setTimeout(() => {
				isBookmarkModalOpen = false;
				isBookmarkSaved = false;
			}, 600);
		} finally {
			isSavingBookmark = false;
		}
	}

	onNavigate(() => {
		isDrawerOpen = false;
	});

	const broadcastHref = $derived.by(() => {
		const id = audioStore.currentTrack?.broadcastId;
		return typeof id === 'string' && id ? resolve('/broadcasts/[id]', { id }) : undefined;
	});

	const volumeHref = $derived.by(() => {
		if (broadcastHref) return broadcastHref;
		const t = audioStore.currentTrack;
		if (!t?.bookId || !t?.volumeId) return undefined;
		const targetPath = resolve(`/books/${t.bookId}/${t.volumeId}`);

		if (targetPath === page.url.pathname) return undefined;

		return targetPath;
	});
</script>

{#snippet sourceBadge()}
	{#if showSourceBadge}
		<span
			class="inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wide {playbackSource ===
			'live'
				? 'bg-red-500/15 text-red-500'
				: playbackSource === 'replay'
					? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
					: 'bg-muted text-muted-foreground'}"
			title={playbackSource === 'regular' ? 'Обычная глава, не трансляция' : undefined}
			>{playbackSource === 'live' ? 'LIVE' : playbackSource === 'replay' ? 'REPLAY' : 'ГЛАВА'}</span
		>
	{/if}
{/snippet}

{#snippet shortBookInfo()}
	<!-- Book info — tapping navigates to the volume page -->
	<div class="flex h-fit min-w-0 items-center gap-2">
		{#if volumeHref}
			<a
				href={resolve(volumeHref as '/')}
				class="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80"
			>
				<BlurhashImage
					class="h-10 w-10 shrink-0 rounded-sm border object-cover"
					src={audioStore.currentTrack?.artwork ??
						audioStore.currentTrack?.images?.[0] ??
						'/logo.webp'}
					alt={audioStore.currentTrack?.title ?? strings.player.chapterFallback}
					blurhash={audioStore.currentTrack?.blurhash}
					loading="eager"
				/>
				<div class="flex min-w-0 flex-col">
					<p class="flex items-center gap-1.5 truncate text-sm font-medium">
						<span class="truncate"
							>{audioStore.currentTrack?.title ?? strings.player.chapterFallback}</span
						>
						{@render sourceBadge()}
					</p>
					<p class="truncate text-xs text-muted-foreground">
						{audioStore.currentTrack?.album ?? strings.player.volumeFallback}
					</p>
				</div>
			</a>
		{:else}
			<BlurhashImage
				class="h-10 w-10 shrink-0 rounded-sm border object-cover"
				src={audioStore.currentTrack?.artwork ??
					audioStore.currentTrack?.images?.[0] ??
					'/logo.webp'}
				alt={audioStore.currentTrack?.title ?? strings.player.chapterFallback}
				blurhash={audioStore.currentTrack?.blurhash}
				loading="eager"
			/>
			<div class="flex min-w-0 flex-col">
				<p class="truncate text-sm font-medium">
					{audioStore.currentTrack?.title ?? strings.player.chapterFallback}
				</p>
				<p class="truncate text-xs text-muted-foreground">
					{audioStore.currentTrack?.album ?? strings.player.volumeFallback}
				</p>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet desktopControls()}
	<div class="flex items-center justify-center gap-3">
		<AudioPlayer.TimeDisplay class="w-20 shrink-0 text-right" />
		<AudioPlayer.ControlGroup class="flex items-center justify-center gap-4 text-center">
			{#if !isLiveBroadcast}
				{#if !isBroadcast}<AudioPlayer.SkipBack />{/if}
				<AudioPlayer.Rewind />
			{/if}
			<AudioPlayer.Play />
			{#if !isLiveBroadcast}
				<AudioPlayer.FastForward />
				{#if !isBroadcast}<AudioPlayer.SkipForward />{/if}
			{/if}
		</AudioPlayer.ControlGroup>
		<AudioPlayer.TimeDisplay class="w-20 shrink-0 text-left" remaining />
	</div>
{/snippet}

{#snippet drawerControls()}
	<!-- Mobile-optimized controls: tighter gaps, all in one row -->
	<div class="flex w-full items-center justify-center gap-2">
		<AudioPlayer.TimeDisplay class="w-[4.25rem] shrink-0 text-right text-xs" />
		<AudioPlayer.ControlGroup class="flex items-center justify-center gap-2">
			{#if !isLiveBroadcast}
				{#if !isBroadcast}<AudioPlayer.SkipBack size="sm" />{/if}
				<AudioPlayer.Rewind size="sm" />
			{/if}
			<AudioPlayer.Play />
			{#if !isLiveBroadcast}
				<AudioPlayer.FastForward size="sm" />
				{#if !isBroadcast}<AudioPlayer.SkipForward size="sm" />{/if}
			{/if}
		</AudioPlayer.ControlGroup>
		<AudioPlayer.TimeDisplay class="w-[4.25rem] shrink-0 text-left text-xs" remaining />
	</div>
{/snippet}

{#if audioStore.queue.length > 0}
	<AudioPlayer.Root
		class="global-audio-player sticky bottom-0 z-40 w-full rounded-none border-t bg-background p-0 shadow-[0_0px_6px_0px] shadow-muted/40"
	>
		<!-- Undo seek floating badge -->
		{#if !isLiveBroadcast && audioStore.undoSeekAvailable && audioStore.lastSeekFrom !== null}
			<div
				class="absolute -top-11 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/40 bg-background/95 px-3 py-1 text-xs font-medium shadow-lg backdrop-blur-md"
				transition:fly={{ y: 8, duration: 200 }}
			>
				<RotateCcw class="h-3.5 w-3.5 text-primary" />
				<span class="text-muted-foreground"
					>{strings.player.undoSeekTo} {formatDuration(audioStore.lastSeekFrom)}</span
				>
				<button
					type="button"
					class="cursor-pointer font-bold text-primary hover:underline"
					onclick={() => audioStore.undoSeek()}
				>
					{strings.player.undoSeek}
				</button>
				<button
					type="button"
					class="ml-1 cursor-pointer text-muted-foreground hover:text-foreground"
					onclick={() => audioStore.dismissUndoSeek()}
					aria-label={strings.common.close}
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</div>
		{/if}

		<!-- Read-only progress for live; the normal seek bar stays hidden. -->
		{#if isLiveBroadcast}
			<div class="absolute top-0 left-0 z-50 w-full -translate-y-1/2" aria-hidden="true">
				<div class="relative h-1 w-full overflow-hidden bg-muted">
					<div
						class="h-full bg-primary transition-[width]"
						style="width: {Math.min(100, audioStore.progress)}%"
					></div>
					{#each broadcastTicks as left, index (index)}
						<span
							class="absolute top-0 h-full w-[3px] -translate-x-1/2 bg-amber-300"
							style="left: {left}%"
							title="Иллюстрация"
						></span>
					{/each}
				</div>
			</div>
		{:else}
			<div class="absolute top-0 left-0 z-50 w-full -translate-y-1/2">
				<div class="relative">
					<AudioPlayer.SeekBar class="relative z-[80]" markers={bookmarkMarkers} />
					<div
						class="pointer-events-none absolute inset-x-0 top-1/2 z-[90] h-1 -translate-y-1/2 overflow-hidden"
					>
						{#each broadcastTicks as left, index (index)}
							<span
								class="absolute top-0 h-full w-[3px] -translate-x-1/2 bg-amber-300"
								style="left: {left}%"
								title="Иллюстрация"
							></span>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- ── Desktop ── -->
		<div class="player-desktop hidden px-4 py-2 md:block">
			<AudioPlayer.ControlBar class="flex items-center justify-between">
				<div class="flex w-fit min-w-0 items-center gap-2">
					{@render shortBookInfo()}
					{#if !isLiveBroadcast}
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="ghost"
										size="icon"
										class="h-8 w-8 text-muted-foreground hover:text-foreground"
										onclick={openBookmarkModal}
										aria-label={strings.player.addBookmark}
									>
										<BookmarkIcon class="h-4 w-4" />
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content sideOffset={6} class="z-[110]">
								{strings.player.addBookmark}
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}
				</div>

				<div class="flex max-w-2xl flex-1 flex-col items-center gap-2">
					{@render desktopControls()}
				</div>

				<div class="flex w-1/4 items-center justify-end gap-2">
					{#if !isLiveBroadcast}
						<AudioPlayer.Download />
						<AudioPlayer.SleepTimer />
						<AudioPlayer.Speed />
					{/if}
					<AudioPlayer.Volume />
				</div>
			</AudioPlayer.ControlBar>
		</div>

		<!-- ── Mobile ── -->
		<div class="player-mobile block md:hidden">
			<Drawer.Root bind:open={isDrawerOpen}>
				<Drawer.Trigger class="w-full">
					{#snippet child({ props })}
						<!-- Mini-bar: cover + title (tappable → opens drawer) | play button -->
						<div
							{...props}
							class={cn(
								'flex w-full items-center gap-3 px-3 py-2 transition-colors active:bg-muted/50',
								props?.class || ''
							)}
						>
							<!-- Cover art -->
							<BlurhashImage
								class="h-10 w-10 shrink-0 rounded-md border border-border/40 object-cover shadow-sm"
								src={audioStore.currentTrack?.artwork ??
									audioStore.currentTrack?.images?.[0] ??
									'/logo.webp'}
								alt={audioStore.currentTrack?.title ?? strings.player.chapterFallback}
								blurhash={audioStore.currentTrack?.blurhash}
								loading="eager"
							/>

							<!-- Track info — takes remaining space, truncates -->
							<div class="flex min-w-0 flex-1 flex-col text-left">
								<p class="flex items-center gap-1.5 truncate text-sm leading-tight font-medium">
									<span class="truncate"
										>{audioStore.currentTrack?.title ?? strings.player.chapterFallback}</span
									>
									{@render sourceBadge()}
								</p>
								<p class="truncate text-xs leading-tight text-muted-foreground">
									{audioStore.currentTrack?.album ?? strings.player.volumeFallback}
								</p>
							</div>

							<!-- Only Play button in the mini-bar to prevent overflow -->
							<div
								class="shrink-0"
								role="presentation"
								onclick={(e: MouseEvent) => e.stopPropagation()}
							>
								<AudioPlayer.Play />
							</div>
						</div>
					{/snippet}
				</Drawer.Trigger>

				<Drawer.Content class="z-[120]">
					<div
						class="mx-auto flex w-full max-w-sm flex-col gap-4 px-6 pt-2 pb-10 max-lg:landscape:grid max-lg:landscape:max-w-4xl max-lg:landscape:grid-cols-[minmax(180px,40%)_minmax(0,1fr)] max-lg:landscape:items-center max-lg:landscape:gap-x-8 max-lg:landscape:gap-y-3 max-lg:landscape:px-8 max-lg:landscape:pt-6"
					>
						<!-- Header: real track data from store -->
						<Drawer.Header
							class="p-0 text-center max-lg:landscape:col-start-2 max-lg:landscape:row-start-1 max-lg:landscape:text-left"
						>
							{#if volumeHref}
								<a href={resolve(volumeHref as '/')} class="hover:underline">
									<Drawer.Title class="text-base font-semibold">
										{audioStore.currentTrack?.album ?? strings.player.volumeFallback}
									</Drawer.Title>
								</a>
							{:else}
								<Drawer.Title class="text-base font-semibold">
									{audioStore.currentTrack?.album ?? strings.player.volumeFallback}
								</Drawer.Title>
							{/if}
							<Drawer.Description
								class="flex items-center justify-center gap-1.5 text-sm max-lg:landscape:justify-start"
							>
								<span>{audioStore.currentTrack?.title ?? strings.player.chapterFallback}</span>
								{@render sourceBadge()}
							</Drawer.Description>
						</Drawer.Header>

						<!-- Large cover art — links to volume page -->
						{#if activeArtwork}
							{@const coverSrc = activeArtwork}
							{#if volumeHref}
								<a
									href={resolve(volumeHref as '/')}
									class="mx-auto block max-lg:landscape:col-start-1 max-lg:landscape:row-span-4 max-lg:landscape:row-start-1 max-lg:landscape:self-center"
								>
									<BlurhashImage
										class="h-48 w-48 rounded-xl border border-border/40 object-cover shadow-lg max-lg:landscape:h-56 max-lg:landscape:w-56"
										src={coverSrc}
										alt={audioStore.currentTrack?.title ?? strings.volume.illustrationsTab}
										blurhash={audioStore.currentTrack?.blurhash}
										loading="eager"
									/>
								</a>
							{:else}
								<BlurhashImage
									class="mx-auto h-48 w-48 rounded-xl border border-border/40 object-cover shadow-lg max-lg:landscape:col-start-1 max-lg:landscape:row-span-4 max-lg:landscape:row-start-1 max-lg:landscape:h-56 max-lg:landscape:w-56 max-lg:landscape:self-center"
									src={coverSrc}
									alt={audioStore.currentTrack?.title ?? strings.volume.illustrationsTab}
									blurhash={audioStore.currentTrack?.blurhash}
									loading="eager"
								/>
							{/if}
						{/if}

						<div class="w-full max-lg:landscape:col-start-2 max-lg:landscape:row-start-2">
							{#if isLiveBroadcast}
								<div class="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
									<div
										class="h-full rounded-full bg-primary transition-[width]"
										style="width: {Math.min(100, audioStore.progress)}%"
									></div>
									{#each broadcastTicks as left, index (index)}
										<span
											class="pointer-events-none absolute top-0 h-full w-[3px] -translate-x-1/2 bg-amber-300"
											style="left: {left}%"
											title="Иллюстрация"
										></span>
									{/each}
								</div>
							{:else}
								<div class="relative">
									<AudioPlayer.SeekBar class="w-full" markers={bookmarkMarkers} />
									<div
										class="pointer-events-none absolute inset-x-0 top-1/2 z-[90] h-1.5 -translate-y-1/2 overflow-hidden"
									>
										{#each broadcastTicks as left, index (index)}
											<span
												class="absolute top-0 h-full w-[3px] -translate-x-1/2 bg-amber-300"
												style="left: {left}%"
												title="Иллюстрация"
											></span>
										{/each}
									</div>
								</div>
							{/if}
						</div>

						<!-- Main playback controls — mobile-optimized sizing -->
						<div class="max-lg:landscape:col-start-2 max-lg:landscape:row-start-3">
							{@render drawerControls()}
						</div>

						<!-- Secondary controls -->
						{#if !isLiveBroadcast}
							<div
								class="flex items-center justify-evenly gap-2 pt-2 max-lg:landscape:col-start-2 max-lg:landscape:row-start-4 max-lg:landscape:justify-start max-lg:landscape:gap-4"
							>
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="ghost"
												size="icon"
												class="h-9 w-9 text-muted-foreground hover:text-foreground"
												onclick={openBookmarkModal}
												aria-label={strings.player.addBookmark}
											>
												<BookmarkIcon class="h-4 w-4" />
											</Button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content sideOffset={6} class="z-[110]">
										{strings.player.addBookmark}
									</Tooltip.Content>
								</Tooltip.Root>
								<AudioPlayer.Download />
								<AudioPlayer.SleepTimer class="flex" />
								<AudioPlayer.Speed class="flex" />
							</div>
						{/if}
					</div>
				</Drawer.Content>
			</Drawer.Root>
		</div>
	</AudioPlayer.Root>
{/if}

<!-- Add Bookmark Dialog -->
<Dialog.Root bind:open={isBookmarkModalOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{strings.bookmarks.addModalTitle}</Dialog.Title>
			<Dialog.Description>{strings.bookmarks.addModalDescription}</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-2">
			<div
				class="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 p-3"
			>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-semibold">
						{audioStore.currentTrack?.title ?? strings.player.chapterFallback}
					</p>
					<p class="truncate text-xs text-muted-foreground">
						{audioStore.currentTrack?.album ?? strings.player.volumeFallback}
					</p>
				</div>
			</div>

			<div class="space-y-3">
				<TimecodeInput
					label="Начало"
					value={bookmarkStart}
					onchange={(value) => {
						bookmarkStart = value;
						if (bookmarkEnd !== null && bookmarkEnd <= value) {
							bookmarkEnd = null;
							hasBookmarkEnd = false;
						}
					}}
				/>
				<div class="space-y-1.5">
					<label class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
						<input
							type="checkbox"
							checked={hasBookmarkEnd}
							onchange={(event) => {
								hasBookmarkEnd = event.currentTarget.checked;
								if (hasBookmarkEnd && bookmarkEnd === null) bookmarkEnd = bookmarkStart + 30;
							}}
						/>
						Конец фрагмента
					</label>
					{#if hasBookmarkEnd}
						<TimecodeInput
							label="Конец"
							value={bookmarkEnd ?? bookmarkStart + 30}
							min={bookmarkStart + 1}
							onchange={(value) => (bookmarkEnd = value)}
						/>
					{:else}
						<p class="text-xs text-muted-foreground">До конца главы</p>
					{/if}
				</div>
			</div>

			<div class="space-y-1.5">
				<label for="bookmark-note" class="text-xs font-medium text-muted-foreground">
					{strings.bookmarks.noteLabel}
				</label>
				<Input
					id="bookmark-note"
					bind:value={bookmarkNote}
					placeholder={strings.player.bookmarkNotePlaceholder}
					maxlength={500}
				/>
			</div>
		</div>
		<Dialog.Footer class="flex gap-2 sm:justify-end">
			<Button variant="outline" onclick={() => (isBookmarkModalOpen = false)}>
				{strings.common.cancel}
			</Button>
			<Button onclick={handleSaveBookmark} disabled={isSavingBookmark}>
				{isBookmarkSaved ? strings.player.bookmarkSaved : strings.bookmarks.saveBookmark}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
