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
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { bookmarkService } from '$lib/client/services/bookmarkService';
	import { strings } from '$lib/constants/strings';
	import { cn } from '$lib/utils';
	import { formatDuration } from '$lib/utils/time';
	import { Bookmark as BookmarkIcon, RotateCcw, X } from '@lucide/svelte';
	import { fly } from 'svelte/transition';

	let isDrawerOpen = $state(false);
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
				note: bookmarkNote
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

	const volumeHref = $derived.by(() => {
		const t = audioStore.currentTrack;
		if (!t?.bookId || !t?.volumeId) return undefined;
		const targetPath = resolve(`/books/${t.bookId}/${t.volumeId}`);

		if (targetPath === page.url.pathname) return undefined;

		return targetPath;
	});
</script>

{#snippet shortBookInfo()}
	<!-- Book info — tapping navigates to the volume page -->
	<div class="flex h-fit min-w-0 items-center gap-2">
		{#if volumeHref}
			<a
				href={resolve(volumeHref as '/')}
				class="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80"
			>
				<img
					class="h-10 w-10 shrink-0 rounded-sm border object-cover"
					src={audioStore.currentTrack?.artwork ??
						audioStore.currentTrack?.images?.[0] ??
						'/logo.webp'}
					alt={audioStore.currentTrack?.title ?? strings.player.chapterFallback}
				/>
				<div class="flex min-w-0 flex-col">
					<p class="truncate text-sm font-medium">
						{audioStore.currentTrack?.title ?? strings.player.chapterFallback}
					</p>
					<p class="truncate text-xs text-muted-foreground">
						{audioStore.currentTrack?.album ?? strings.player.volumeFallback}
					</p>
				</div>
			</a>
		{:else}
			<img
				class="h-10 w-10 shrink-0 rounded-sm border object-cover"
				src={audioStore.currentTrack?.artwork ??
					audioStore.currentTrack?.images?.[0] ??
					'/logo.webp'}
				alt={audioStore.currentTrack?.title ?? strings.player.chapterFallback}
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
	<div class="flex items-center justify-between gap-4">
		<AudioPlayer.TimeDisplay class="w-16 shrink-0" />
		<AudioPlayer.ControlGroup class="flex items-center justify-center gap-4 text-center">
			<AudioPlayer.SkipBack />
			<AudioPlayer.Rewind />
			<AudioPlayer.Play />
			<AudioPlayer.FastForward />
			<AudioPlayer.SkipForward />
		</AudioPlayer.ControlGroup>
		<AudioPlayer.TimeDisplay class="w-16 shrink-0" remaining />
	</div>
{/snippet}

{#snippet drawerControls()}
	<!-- Mobile-optimized controls: tighter gaps, all in one row -->
	<div class="flex w-full items-center justify-between gap-1">
		<AudioPlayer.TimeDisplay class="w-12 shrink-0 text-xs" />
		<AudioPlayer.ControlGroup class="flex items-center justify-center gap-2">
			<AudioPlayer.SkipBack size="sm" />
			<AudioPlayer.Rewind size="sm" />
			<AudioPlayer.Play />
			<AudioPlayer.FastForward size="sm" />
			<AudioPlayer.SkipForward size="sm" />
		</AudioPlayer.ControlGroup>
		<AudioPlayer.TimeDisplay class="w-12 shrink-0 text-xs" remaining />
	</div>
{/snippet}

{#if audioStore.queue.length > 0}
	<AudioPlayer.Root
		class="global-audio-player sticky bottom-0 z-[70] w-full rounded-none border-t bg-background p-0 shadow-[0_0px_6px_0px] shadow-muted/40"
	>
		<!-- Undo seek floating badge -->
		{#if audioStore.undoSeekAvailable && audioStore.lastSeekFrom !== null}
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

		<!-- Seek bar sits above the bar on all breakpoints -->
		<div class="absolute top-0 left-0 z-50 w-full -translate-y-1/2">
			<AudioPlayer.SeekBar class="relative z-[80]" markers={bookmarkMarkers} />
		</div>

		<!-- ── Desktop ── -->
		<div class="hidden px-4 py-2 md:block">
			<AudioPlayer.ControlBar class="flex items-center justify-between">
				<div class="flex w-fit min-w-0 items-center gap-2">
					{@render shortBookInfo()}
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
				</div>

				<div class="flex max-w-2xl flex-1 flex-col items-center gap-2">
					{@render desktopControls()}
				</div>

				<div class="flex w-1/4 items-center justify-end gap-2">
					<AudioPlayer.Download />
					<AudioPlayer.SleepTimer />
					<AudioPlayer.Speed />
					<AudioPlayer.Volume />
				</div>
			</AudioPlayer.ControlBar>
		</div>

		<!-- ── Mobile ── -->
		<div class="block md:hidden">
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
							<img
								class="h-10 w-10 shrink-0 rounded-md border border-border/40 object-cover shadow-sm"
								src={audioStore.currentTrack?.artwork ??
									audioStore.currentTrack?.images?.[0] ??
									'/logo.webp'}
								alt={audioStore.currentTrack?.title ?? strings.player.chapterFallback}
							/>

							<!-- Track info — takes remaining space, truncates -->
							<div class="flex min-w-0 flex-1 flex-col text-left">
								<p class="truncate text-sm leading-tight font-medium">
									{audioStore.currentTrack?.title ?? strings.player.chapterFallback}
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

				<Drawer.Content>
					<div class="mx-auto flex w-full max-w-sm flex-col gap-4 px-6 pt-2 pb-10">
						<!-- Header: real track data from store -->
						<Drawer.Header class="p-0 text-center">
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
							<Drawer.Description class="text-sm">
								{audioStore.currentTrack?.title ?? strings.player.chapterFallback}
							</Drawer.Description>
						</Drawer.Header>

						<!-- Large cover art — links to volume page -->
						{#if audioStore.currentTrack?.artwork ?? audioStore.currentTrack?.images?.[0]}
							{@const coverSrc =
								audioStore.currentTrack?.artwork ?? audioStore.currentTrack?.images?.[0]}
							{#if volumeHref}
								<a href={resolve(volumeHref as '/')} class="mx-auto block">
									<img
										class="h-48 w-48 rounded-xl border border-border/40 object-cover shadow-lg"
										src={coverSrc}
										alt={audioStore.currentTrack?.title ?? strings.volume.illustrationsTab}
									/>
								</a>
							{:else}
								<img
									class="mx-auto h-48 w-48 rounded-xl border border-border/40 object-cover shadow-lg"
									src={coverSrc}
									alt={audioStore.currentTrack?.title ?? strings.volume.illustrationsTab}
								/>
							{/if}
						{/if}

						<!-- SeekBar in drawer -->
						<AudioPlayer.SeekBar class="w-full" markers={bookmarkMarkers} />

						<!-- Main playback controls — mobile-optimized sizing -->
						{@render drawerControls()}

						<!-- Secondary controls -->
						<div class="flex items-center justify-evenly gap-2 pt-2">
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

			<div class="grid grid-cols-2 gap-3">
				<TimecodeInput
					label="Начало"
					value={bookmarkStart}
					onchange={(value) => {
						bookmarkStart = value;
						if (bookmarkEnd !== null && bookmarkEnd <= value) bookmarkEnd = null;
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
							value={bookmarkEnd ?? bookmarkStart + 30}
							min={bookmarkStart + 1}
							onchange={(value) => (bookmarkEnd = value)}
						/>
					{:else}
						<p class="px-1 py-2 text-xs text-muted-foreground">До конца главы</p>
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
