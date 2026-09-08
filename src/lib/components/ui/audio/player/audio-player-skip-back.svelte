<script lang="ts">
	import { SkipBack } from '@lucide/svelte';
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
			(audioStore.currentQueueIndex === 0 && audioStore.repeatMode !== 'all')
	);

	function handleClick(e: MouseEvent) {
		onclick?.(e);
		audioStore.previous();
	}
</script>

<AudioPlayerIconButton
	class={className}
	dataSlot="audio-skip-back-button"
	label="Предыдущий"
	{size}
	{variant}
	disabled={isDisabled}
	onclick={handleClick}
>
	{#snippet icon()}
		<SkipBack fill="currentColor" />
	{/snippet}
</AudioPlayerIconButton>
