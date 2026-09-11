<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { audioStore } from '$lib/audio-store.svelte';
	import * as AudioPlayer from '$lib/components/ui/audio/player/index.js';
	import * as Drawer from '$lib/components/ui/drawer/index.js';
	import { cn } from '$lib/utils';

	let isDrawerOpen = $state(false);

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
				href={volumeHref}
				class="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80"
			>
				<img
					class="h-10 w-10 shrink-0 rounded-sm border object-cover"
					src={audioStore.currentTrack?.artwork ??
						audioStore.currentTrack?.images?.[0] ??
						'/logo.webp'}
					alt={audioStore.currentTrack?.title ?? 'Глава...'}
				/>
				<div class="flex min-w-0 flex-col">
					<p class="truncate text-sm font-medium">{audioStore.currentTrack?.title ?? 'Глава...'}</p>
					<p class="truncate text-xs text-muted-foreground">
						{audioStore.currentTrack?.album ?? 'Том...'}
					</p>
				</div>
			</a>
		{:else}
			<img
				class="h-10 w-10 shrink-0 rounded-sm border object-cover"
				src={audioStore.currentTrack?.artwork ??
					audioStore.currentTrack?.images?.[0] ??
					'/logo.webp'}
				alt={audioStore.currentTrack?.title ?? 'Глава...'}
			/>
			<div class="flex min-w-0 flex-col">
				<p class="truncate text-sm font-medium">{audioStore.currentTrack?.title ?? 'Глава...'}</p>
				<p class="truncate text-xs text-muted-foreground">
					{audioStore.currentTrack?.album ?? 'Том...'}
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
		class="sticky bottom-0 z-50 w-full rounded-none border-t bg-background p-0 shadow-[0_0px_6px_0px] shadow-muted/40"
	>
		<!-- Seek bar sits above the bar on all breakpoints -->
		<div class="absolute top-0 left-0 z-50 w-full -translate-y-1/2">
			<AudioPlayer.SeekBar class="overflow-x-clip" />
		</div>

		<!-- ── Desktop ── -->
		<div class="hidden px-4 py-2 md:block">
			<AudioPlayer.ControlBar class="flex items-center justify-between">
				<div class="w-1/4 min-w-0">
					{@render shortBookInfo()}
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
						<!--
							Mini-bar: cover + title (tappable → opens drawer) | play button
							Compact layout — no overflow.
						-->
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
								alt={audioStore.currentTrack?.title ?? 'Глава...'}
							/>

							<!-- Track info — takes remaining space, truncates -->
							<div class="flex min-w-0 flex-1 flex-col text-left">
								<p class="truncate text-sm leading-tight font-medium">
									{audioStore.currentTrack?.title ?? 'Глава...'}
								</p>
								<p class="truncate text-xs leading-tight text-muted-foreground">
									{audioStore.currentTrack?.album ?? 'Том...'}
								</p>
							</div>

							<!-- Only Play button in the mini-bar to prevent overflow -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="shrink-0" onclick={(e: MouseEvent) => e.stopPropagation()}>
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
								<a href={volumeHref} class="hover:underline">
									<Drawer.Title class="text-base font-semibold">
										{audioStore.currentTrack?.album ?? 'Том...'}
									</Drawer.Title>
								</a>
							{:else}
								<Drawer.Title class="text-base font-semibold">
									{audioStore.currentTrack?.album ?? 'Том...'}
								</Drawer.Title>
							{/if}
							<Drawer.Description class="text-sm">
								{audioStore.currentTrack?.title ?? 'Глава...'}
							</Drawer.Description>
						</Drawer.Header>

						<!-- Large cover art — links to volume page -->
						{#if audioStore.currentTrack?.artwork ?? audioStore.currentTrack?.images?.[0]}
							{@const coverSrc =
								audioStore.currentTrack?.artwork ?? audioStore.currentTrack?.images?.[0]}
							{#if volumeHref}
								<a href={volumeHref} class="mx-auto block">
									<img
										class="h-48 w-48 rounded-xl border border-border/40 object-cover shadow-lg"
										src={coverSrc}
										alt={audioStore.currentTrack?.title ?? 'Обложка'}
									/>
								</a>
							{:else}
								<img
									class="mx-auto h-48 w-48 rounded-xl border border-border/40 object-cover shadow-lg"
									src={coverSrc}
									alt={audioStore.currentTrack?.title ?? 'Обложка'}
								/>
							{/if}
						{/if}

						<!-- SeekBar in drawer -->
						<AudioPlayer.SeekBar class="w-full" />

						<!-- Main playback controls — mobile-optimized sizing -->
						{@render drawerControls()}

						<!-- Secondary controls — override hidden md:flex with "flex" class -->
						<div class="flex items-center justify-evenly gap-2 pt-2">
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
