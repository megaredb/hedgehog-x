<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import type { OfflineVolume } from '$lib/client/db';
	import SupportBlock from '$lib/components/support/SupportBlock.svelte';
	import { Play, Sparkles, BookCheck, Clock } from '@lucide/svelte';
	import { strings } from '$lib/constants/strings';

	interface Props {
		open: boolean;
		currentVolume: OfflineVolume | undefined;
		nextVolume?: OfflineVolume | null;
		onPlayNextVolume?: () => void;
	}

	let {
		open = $bindable(false),
		currentVolume,
		nextVolume = null,
		onPlayNextVolume
	}: Props = $props();

	let wasOpen = false;

	$effect(() => {
		if (open && !wasOpen) {
			try {
				const jingle = new Audio('/audio/volume-complete.mp3');
				jingle.volume = 0.6;
				jingle.play().catch(() => {});
			} catch {
				// Autoplay restriction or audio API unavailable
			}
		}
		wasOpen = open;
	});

	function handlePlayNext() {
		open = false;
		if (onPlayNextVolume) onPlayNextVolume();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
		<Dialog.Header class="text-center sm:text-left">
			<div
				class="mb-2 inline-flex items-center gap-1.5 self-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:self-start"
			>
				<Sparkles class="h-3.5 w-3.5" />
				<span>{strings.volume.volumeCompletedTitle}</span>
			</div>
			<Dialog.Title class="text-xl font-bold sm:text-2xl">
				{nextVolume ? strings.volume.nextVolume : strings.volume.volumeFinishedHeading}
			</Dialog.Title>
			<Dialog.Description class="text-xs sm:text-sm">
				{nextVolume
					? strings.volume.nextVolumeDescription(currentVolume?.volumeNumber ?? 1)
					: currentVolume?.status === 'completed'
						? strings.volume.volumeFinishedAll
						: strings.volume.volumeOngoing}
			</Dialog.Description>
		</Dialog.Header>

		<div class="my-4 space-y-6">
			<!-- Next volume promo card -->
			{#if nextVolume}
				<div
					class="flex flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm sm:flex-row"
				>
					{#if nextVolume.coverUrl}
						<img
							src={nextVolume.coverUrl}
							alt={nextVolume.title}
							class="h-28 w-20 shrink-0 rounded-xl object-cover shadow-md"
						/>
					{/if}
					<div class="flex-1 text-center sm:text-left">
						<span class="text-xs font-bold tracking-wider text-primary uppercase">
							{strings.breadcrumbs.volumes}
							{nextVolume.volumeNumber}
						</span>
						<h3 class="text-lg font-bold text-foreground">
							{nextVolume.title}
						</h3>
						{#if nextVolume.description}
							<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
								{nextVolume.description}
							</p>
						{/if}
						<Button class="mt-3 w-full gap-2 sm:w-auto" onclick={handlePlayNext}>
							<Play class="h-4 w-4 fill-current" />
							<span>{strings.volume.playNextVolume}</span>
						</Button>
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
					{#if currentVolume?.status === 'completed'}
						<BookCheck class="h-8 w-8 shrink-0 text-emerald-500" />
						<div>
							<h4 class="text-sm font-semibold">{strings.volume.volumeReleasedStatus}</h4>
							<p class="text-xs text-muted-foreground">{strings.volume.volumeReleasedStatusDesc}</p>
						</div>
					{:else}
						<Clock class="h-8 w-8 shrink-0 text-amber-500" />
						<div>
							<h4 class="text-sm font-semibold">{strings.volume.volumeRecordingStatus}</h4>
							<p class="text-xs text-muted-foreground">
								{strings.volume.volumeRecordingStatusDesc}
							</p>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Author support section -->
			<div class="border-t border-border/60 pt-4">
				<h4 class="mb-3 text-sm font-bold text-foreground">{strings.support.title}</h4>
				<SupportBlock />
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
