<script lang="ts">
	import { FastForward } from '@lucide/svelte';
	import { audioStore } from '$lib/audio-store.svelte.js';
	import { htmlAudio } from '$lib/html-audio.js';
	import AudioPlayerIconButton from './audio-player-icon-button.svelte';
	import type { ButtonSize, ButtonVariant } from '$lib/components/ui/button';

	interface Props {
		class?: string;
		size?: ButtonSize;
		variant?: ButtonVariant;
		onclick?: (e: MouseEvent) => void;
	}

	let { class: className = '', size = 'icon', variant = 'ghost', onclick }: Props = $props();

	const isLiveStream = $derived(htmlAudio.isLive(audioStore.duration));
	const isDisabled = $derived(
		!audioStore.currentTrack ||
			isLiveStream ||
			(audioStore.duration > 0 && audioStore.currentTime >= audioStore.duration)
	);
	const tooltipLabel = $derived(
		isLiveStream ? 'Недоступно для прямого эфира' : 'Перемотать вперёд'
	);

	function handleClick(e: MouseEvent) {
		onclick?.(e);
		if (!isLiveStream) {
			audioStore.seek(Math.min(audioStore.currentTime + 10, audioStore.duration));
		}
	}
</script>

<AudioPlayerIconButton
	class={className}
	dataSlot="audio-fast-forward-button"
	{size}
	{variant}
	label={tooltipLabel}
	disabled={isDisabled}
	onclick={handleClick}
>
	{#snippet icon()}
		<FastForward fill="currentColor" />
	{/snippet}
</AudioPlayerIconButton>
