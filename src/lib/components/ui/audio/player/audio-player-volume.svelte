<script lang="ts">
	import { Volume, Volume1, Volume2, VolumeX } from '@lucide/svelte';
	import { audioStore } from '$lib/audio-store.svelte.js';
	import { cn } from '$lib/utils.js';
	import { Button, type ButtonSize, type ButtonVariant } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';

	interface Props {
		class?: string;
		size?: ButtonSize;
		variant?: ButtonVariant;
	}

	let { class: className = '', size = 'icon', variant = 'outline' }: Props = $props();

	let open = $state(false);
	let closeTimer: ReturnType<typeof setTimeout> | null = null;

	let volumePercent = $derived(Math.round(audioStore.volume * 100));

	const VolumeIcon = $derived.by(() => {
		if (audioStore.isMuted || audioStore.volume === 0) return VolumeX;
		if (volumePercent < 33) return Volume;
		if (volumePercent < 66) return Volume1;
		return Volume2;
	});

	const tooltipLabel = $derived(audioStore.isMuted ? 'Беззвуч.' : `Громк. ${volumePercent}%`);

	function handleSliderChange(v: number) {
		if (v === undefined) return;
		audioStore.setVolume({ volume: v / 100 });
		if (v === 0 && !audioStore.isMuted) audioStore.toggleMute();
		if (v > 0 && audioStore.isMuted) audioStore.toggleMute();
	}

	function show() {
		if (closeTimer) {
			clearTimeout(closeTimer);
			closeTimer = null;
		}
		open = true;
	}

	function hide() {
		if (closeTimer) clearTimeout(closeTimer);
		closeTimer = setTimeout(() => {
			open = false;
			closeTimer = null;
		}, 150);
	}

	function toggleMute() {
		audioStore.toggleMute();
	}
</script>

<div
	class={cn('relative hidden md:flex', className)}
	role="group"
	aria-label="Громкость"
	onmouseenter={show}
	onmouseleave={hide}
>
	<Button
		class="shrink-0"
		data-slot="audio-volume-button"
		{size}
		{variant}
		onclick={toggleMute}
		aria-label={audioStore.isMuted ? 'Включить звук' : 'Выключить звук'}
		title={tooltipLabel}
	>
		<VolumeIcon class={cn(audioStore.isMuted && 'opacity-40', 'text-primary')} />
	</Button>

	{#if open}
		<div
			class="absolute right-0 bottom-full z-50 mb-2 flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-popover p-2 text-popover-foreground shadow-lg"
			role="group"
			aria-label="Регулятор громкости"
			onmouseenter={show}
			onmouseleave={hide}
		>
			<button
				type="button"
				aria-label={audioStore.isMuted ? 'Включить звук' : 'Выключить звук'}
				class={cn(
					'size-4 shrink-0 cursor-pointer',
					audioStore.isMuted ? 'opacity-40' : 'opacity-60'
				)}
				onclick={toggleMute}
			>
				<VolumeX class="size-4" />
			</button>

			<Slider
				type="single"
				orientation="vertical"
				class="h-24"
				max={100}
				min={0}
				value={volumePercent}
				onValueChange={handleSliderChange}
			/>

			<Volume2 aria-hidden="true" class="size-4 shrink-0 opacity-60" />
			<span class="font-mono text-xs tabular-nums">{volumePercent}%</span>
		</div>
	{/if}
</div>
