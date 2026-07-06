<script lang="ts">
	import { player } from '$lib/client/player.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Play,
		Pause,
		SkipForward,
		SkipBack,
		RotateCcw,
		RotateCw,
		Volume2,
		VolumeX,
		Gauge,
		ChevronUp,
		AudioLines
	} from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { formatTime } from '$lib/utils';

	let { onExpand } = $props<{ onExpand: () => void }>();

	let showSpeedMenu = $state(false);
	let scrubbingTime = $state<number | null>(null);

	const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

	// Handle click outside for speed menu
	function handleOutsideClick(e: MouseEvent) {
		if (showSpeedMenu) {
			const target = e.target as HTMLElement;
			if (!target.closest('.speed-menu-container')) {
				showSpeedMenu = false;
			}
		}
	}

	function handleScrub(e: Event) {
		const target = e.target as HTMLInputElement;
		scrubbingTime = parseFloat(target.value);
	}

	function handleSeekEnd(e: Event) {
		const target = e.target as HTMLInputElement;
		const time = parseFloat(target.value);
		scrubbingTime = null;
		player.seek(time);
	}

	function handleVolume(e: Event) {
		const target = e.target as HTMLInputElement;
		player.setVolume(parseFloat(target.value));
	}

	function selectSpeed(speed: number) {
		player.setSpeed(speed);
		showSpeedMenu = false;
	}
</script>

<svelte:window onclick={handleOutsideClick} />

{#if player.currentTrack}
	<div class="h-full max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
		<!-- Track Details -->
		<div
			class="flex items-center gap-3 min-w-0 flex-1 md:flex-none cursor-pointer"
			onclick={onExpand}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && onExpand()}
		>
			{#if player.currentTrack.coverUrl}
				<img
					src={player.currentTrack.coverUrl}
					alt={player.currentTrack.bookTitle}
					class="w-12 h-12 rounded-md object-cover shadow-sm bg-muted shrink-0"
				/>
			{:else}
				<div
					class="w-12 h-12 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0"
				>
					<AudioLines class="h-6 w-6" />
				</div>
			{/if}
			<div class="min-w-0">
				<p class="text-sm font-semibold truncate leading-snug">{player.currentTrack.title}</p>
				<p class="text-xs text-muted-foreground truncate leading-none mt-1">
					{player.currentTrack.bookAuthor}
				</p>
			</div>
			<ChevronUp class="h-4 w-4 text-muted-foreground shrink-0 animate-bounce md:hidden" />
		</div>

		<!-- Playback controls for Desktop (Hidden on mobile) -->
		<div class="hidden md:flex items-center gap-4">
			<Button
				variant="ghost"
				size="icon"
				onclick={() => player.prev()}
				disabled={player.queue.length <= 1}
			>
				<SkipBack class="h-5 w-5" />
			</Button>
			<Button variant="ghost" size="icon" onclick={() => player.skip(-10)}>
				<RotateCcw class="h-5 w-5" />
			</Button>

			<Button
				variant="default"
				size="icon"
				class="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow"
				onclick={() => player.toggle()}
			>
				{#if player.isPlaying}
					<Pause class="h-5 w-5 fill-current" />
				{:else}
					<Play class="h-5 w-5 fill-current ml-0.5" />
				{/if}
			</Button>

			<Button variant="ghost" size="icon" onclick={() => player.skip(30)}>
				<RotateCw class="h-5 w-5" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				onclick={() => player.next()}
				disabled={player.queue.length <= 1}
			>
				<SkipForward class="h-5 w-5" />
			</Button>
		</div>

		<!-- Timeline Slider & Time Labels (Hidden on mobile) -->
		<div class="hidden md:flex flex-1 items-center gap-3 max-w-xl">
			<span class="text-xs text-muted-foreground tabular-nums w-12 text-right"
				>{formatTime(player.currentTime)}</span
			>
			<input
				type="range"
				min="0"
				max={player.duration || 100}
				value={scrubbingTime !== null ? scrubbingTime : player.currentTime}
				oninput={handleScrub}
				onchange={handleSeekEnd}
				class="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary hover:h-1.5 transition-all"
			/>
			<span class="text-xs text-muted-foreground tabular-nums w-12"
				>{formatTime(player.duration)}</span
			>
		</div>

		<!-- Extra Actions (Desktop volume & speed, mobile just play/pause) -->
		<div class="flex items-center gap-2">
			<!-- Desktop controls -->
			<div class="hidden md:flex items-center gap-3 mr-2">
				<!-- Playback Speed -->
				<div class="relative speed-menu-container">
					<Button
						variant="ghost"
						size="sm"
						class="h-8 gap-1 text-xs"
						onclick={() => (showSpeedMenu = !showSpeedMenu)}
					>
						<Gauge class="h-4 w-4" />
						{Math.round(player.playbackRate * 100)}%
					</Button>
					{#if showSpeedMenu}
						<div
							class="absolute bottom-10 right-0 z-50 bg-popover border border-border rounded-md shadow-lg p-1 min-w-[80px]"
							transition:slide={{ duration: 150 }}
						>
							{#each speeds as speed (speed)}
								<button
									class="w-full text-left px-2 py-1 text-xs rounded hover:bg-accent transition-colors"
									class:font-bold={player.playbackRate === speed}
									onclick={() => selectSpeed(speed)}
								>
									{speed * 100}%
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Volume Slider -->
				<div class="flex items-center gap-2">
					<Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => player.toggleMute()}>
						{#if player.isMuted || player.volume === 0}
							<VolumeX class="h-4 w-4" />
						{:else}
							<Volume2 class="h-4 w-4" />
						{/if}
					</Button>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={player.volume}
						oninput={handleVolume}
						class="w-20 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary hover:h-1.5 transition-all"
					/>
				</div>
			</div>

			<!-- Mobile Play/Pause -->
			<Button
				variant="ghost"
				size="icon"
				class="md:hidden h-10 w-10"
				onclick={(e) => {
					e.stopPropagation();
					player.toggle();
				}}
			>
				{#if player.isPlaying}
					<Pause class="h-6 w-6" />
				{:else}
					<Play class="h-6 w-6 ml-0.5" />
				{/if}
			</Button>
		</div>
	</div>

	<!-- Tiny progress bar at the very top for mobile -->
	<div class="absolute top-0 left-0 right-0 h-[2px] bg-muted md:hidden">
		<div
			class="h-full bg-primary transition-all duration-100"
			style="width: {(player.currentTime / (player.duration || 1)) * 100}%"
		></div>
	</div>
{/if}
