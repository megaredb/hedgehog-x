<script lang="ts">
	import { Rewind } from '@lucide/svelte';
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
		!audioStore.currentTrack || audioStore.currentTime <= 0 || isLiveStream
	);
	const tooltipLabel = $derived(isLiveStream ? 'Недоступно для прямого эфира' : 'Перемотать назад');

	function handleClick(e: MouseEvent) {
		onclick?.(e);
		if (!isLiveStream) {
			audioStore.seek(Math.max(audioStore.currentTime - 10, 0));
		}
	}
</script>

<AudioPlayerIconButton
	class={className}
	dataSlot="audio-rewind-button"
	{size}
	{variant}
	label={tooltipLabel}
	disabled={isDisabled}
	onclick={handleClick}
>
	{#snippet icon()}
		<Rewind fill="currentColor" />
	{/snippet}
</AudioPlayerIconButton>
