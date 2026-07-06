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
		Gauge,
		ChevronDown,
		AudioLines
	} from '@lucide/svelte';
	import SeekTimeOverlay from './SeekTimeOverlay.svelte';
	import SleepTimerButton from './SleepTimerButton.svelte';
	import { formatTime } from '$lib/utils';
	import { onDestroy } from 'svelte';

	let { onClose } = $props<{ onClose: () => void }>();

	let showSpeedMenu = $state(false);
	let scrubbingTime = $state<number | null>(null);

	// Gesture feedback states
	let leftOverlayActive = $state(false);
	let rightOverlayActive = $state(false);
	let leftTimeout: ReturnType<typeof setTimeout>;
	let rightTimeout: ReturnType<typeof setTimeout>;

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

	function selectSpeed(speed: number) {
		player.setSpeed(speed);
		showSpeedMenu = false;
	}

	// Trigger gestures (15s skip)
	function triggerDoubleTapLeft(e: MouseEvent) {
		e.stopPropagation();
		player.skip(-15);
		leftOverlayActive = true;
		clearTimeout(leftTimeout);
		leftTimeout = setTimeout(() => {
			leftOverlayActive = false;
		}, 800);
	}

	function triggerDoubleTapRight(e: MouseEvent) {
		e.stopPropagation();
		player.skip(15);
		rightOverlayActive = true;
		clearTimeout(rightTimeout);
		rightTimeout = setTimeout(() => {
			rightOverlayActive = false;
		}, 800);
	}

	onDestroy(() => {
		clearTimeout(leftTimeout);
		clearTimeout(rightTimeout);
	});
</script>

<svelte:window onclick={handleOutsideClick} />

{#if player.currentTrack}
	<div class="h-full w-full flex flex-col p-6 max-w-md mx-auto relative justify-between">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-border/40 pb-4 relative z-30">
			<Button variant="ghost" size="icon" onclick={onClose}>
				<ChevronDown class="h-6 w-6" />
			</Button>
			<div class="text-center">
				<p class="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
					Воспроизведение
				</p>
				<p class="text-xs truncate max-w-[200px] mt-0.5">{player.currentTrack.bookTitle}</p>
			</div>
			<div class="w-10"></div>
		</div>

		<!-- Album Art Container with interactive double-tap overlays -->
		<div class="flex-1 flex flex-col justify-center items-center py-6 relative">
			<!-- Invisible touch targets for double tap skip -->
			<div class="absolute inset-0 z-10 flex">
				<button
					class="flex-1 h-full opacity-0 outline-none cursor-pointer"
					ondblclick={triggerDoubleTapLeft}
					aria-label="Skip backward 15 seconds"
				></button>
				<!-- center area to prevent accidental seeks when clicking track info -->
				<div class="w-24 pointer-events-none"></div>
				<button
					class="flex-1 h-full opacity-0 outline-none cursor-pointer"
					ondblclick={triggerDoubleTapRight}
					aria-label="Skip forward 15 seconds"
				></button>
			</div>

			<!-- Dynamic Animated Double-Tap Feedback Overlays -->
			{#if player.currentTrack.coverUrl}
				<div class="w-64 h-64 relative rounded-2xl overflow-hidden shadow-2xl bg-muted">
					<img
						src={player.currentTrack.coverUrl}
						alt={player.currentTrack.bookTitle}
						class="w-full h-full object-cover animate-in zoom-in-95 duration-300"
					/>
					<SeekTimeOverlay direction="left" visible={leftOverlayActive} />
					<SeekTimeOverlay direction="right" visible={rightOverlayActive} />
				</div>
			{:else}
				<div
					class="w-64 h-64 relative rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-2xl overflow-hidden"
				>
					<AudioLines class="h-24 w-24" />
					<SeekTimeOverlay direction="left" visible={leftOverlayActive} />
					<SeekTimeOverlay direction="right" visible={rightOverlayActive} />
				</div>
			{/if}

			<!-- Track Details -->
			<div class="text-center mt-6 w-full px-4 relative z-20">
				<h2 class="text-xl font-bold truncate">{player.currentTrack.title}</h2>
				<p class="text-sm text-muted-foreground truncate mt-1">
					{player.currentTrack.bookAuthor}
				</p>
			</div>
		</div>

		<!-- Playback Slider & Timing -->
		<div class="space-y-2 relative z-20">
			<input
				type="range"
				min="0"
				max={player.duration || 100}
				value={scrubbingTime !== null ? scrubbingTime : player.currentTime}
				oninput={handleScrub}
				onchange={handleSeekEnd}
				class="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
			/>
			<div class="flex justify-between text-xs text-muted-foreground tabular-nums">
				<span>{formatTime(scrubbingTime !== null ? scrubbingTime : player.currentTime)}</span>
				<span>{formatTime(player.duration)}</span>
			</div>
		</div>

		<!-- Playback Action Buttons -->
		<div class="flex flex-col items-center gap-6 my-4 relative z-20">
			<div class="flex items-center justify-center gap-8 w-full">
				<!-- Previous Track -->
				<Button
					variant="ghost"
					size="icon"
					class="h-12 w-12"
					onclick={() => player.prev()}
					disabled={player.queue.length <= 1}
				>
					<SkipBack class="h-7 w-7" />
				</Button>

				<!-- Skip Back 10s -->
				<Button variant="ghost" size="icon" class="h-12 w-12" onclick={() => player.skip(-10)}>
					<RotateCcw class="h-6 w-6" />
				</Button>

				<!-- Big Play Button -->
				<Button
					variant="default"
					class="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center"
					onclick={() => player.toggle()}
				>
					{#if player.isPlaying}
						<Pause class="h-8 w-8 fill-current" />
					{:else}
						<Play class="h-8 w-8 fill-current ml-1" />
					{/if}
				</Button>

				<!-- Skip Forward 30s -->
				<Button variant="ghost" size="icon" class="h-12 w-12" onclick={() => player.skip(30)}>
					<RotateCw class="h-6 w-6" />
				</Button>

				<!-- Next Track -->
				<Button
					variant="ghost"
					size="icon"
					class="h-12 w-12"
					onclick={() => player.next()}
					disabled={player.queue.length <= 1}
				>
					<SkipForward class="h-7 w-7" />
				</Button>
			</div>

			<!-- Speed & Sleep Timer Control Bar -->
			<div class="flex items-center justify-between w-full border-t border-border/40 pt-4 px-4">
				<!-- Sleep Timer -->
				<SleepTimerButton />

				<!-- Speed selector -->
				<div class="relative speed-menu-container">
					<Button
						variant="outline"
						size="sm"
						class="h-9 gap-1 text-xs"
						onclick={() => (showSpeedMenu = !showSpeedMenu)}
					>
						<Gauge class="h-4 w-4" />
						Скорость: {Math.round(player.playbackRate * 100)}%
					</Button>
					{#if showSpeedMenu}
						<div
							class="absolute bottom-11 right-0 z-50 bg-popover border border-border rounded-md shadow-lg p-1 min-w-[120px] max-h-48 overflow-y-auto"
						>
							{#each speeds as speed (speed)}
								<button
									class="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-accent transition-colors"
									class:font-bold={player.playbackRate === speed}
									onclick={() => selectSpeed(speed)}
								>
									{speed * 100}%
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
