<script lang="ts">
	import { SkipForward } from '@lucide/svelte';
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

	const isDisabled = $derived(
		!audioStore.currentTrack ||
			(audioStore.currentQueueIndex === audioStore.queue.length - 1 &&
				audioStore.repeatMode !== 'all')
	);

	function handleClick(e: MouseEvent) {
		onclick?.(e);
		audioStore.next();
	}
</script>

<AudioPlayerIconButton
	class={className}
	dataSlot="audio-skip-forward-button"
	label="Следующий"
	{size}
	{variant}
	disabled={isDisabled}
	onclick={handleClick}
>
	{#snippet icon()}
		<SkipForward fill="currentColor" />
	{/snippet}
</AudioPlayerIconButton>
