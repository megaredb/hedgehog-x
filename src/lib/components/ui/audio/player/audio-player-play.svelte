<script lang="ts">
	import { Loader2, Pause, Play } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { audioStore } from '$lib/audio-store.svelte.js';
	import AudioPlayerIconButton from './audio-player-icon-button.svelte';
	import type { ButtonSize, ButtonVariant } from '$lib/components/ui/button';

	interface Props {
		class?: string;
		size?: ButtonSize;
		variant?: ButtonVariant;
		onclick?: (e: MouseEvent) => void;
	}

	let { class: className = '', size = 'icon', variant = 'ghost', onclick }: Props = $props();

	const showSpinner = $derived(audioStore.isLoading || audioStore.isBuffering);
	const isDisabled = $derived(showSpinner || !audioStore.currentTrack);
	const tooltipLabel = $derived(audioStore.isPlaying ? 'Пауза' : 'Играть');

	function handleClick(e: MouseEvent) {
		onclick?.(e);
		audioStore.togglePlay();
	}

	// Spacebar shortcut
	onMount(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.code === 'Space' && e.target === document.body) {
				e.preventDefault();
				audioStore.togglePlay();
			}
		}
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	});
</script>

<AudioPlayerIconButton
	class={className}
	dataSlot="audio-play-button"
	{size}
	{variant}
	label={tooltipLabel}
	disabled={isDisabled}
	onclick={handleClick}
>
	{#snippet icon()}
		{#if showSpinner}
			<Loader2 class="animate-spin" />
		{:else if audioStore.isPlaying}
			<Pause fill="currentColor" />
		{:else}
			<Play fill="currentColor" />
		{/if}
	{/snippet}
</AudioPlayerIconButton>
