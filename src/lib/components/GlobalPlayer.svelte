<script lang="ts">
	import { player } from '$lib/client/player.svelte';
	import MiniPlayer from './audio/MiniPlayer.svelte';
	import FullscreenPlayer from './audio/FullscreenPlayer.svelte';

	let isExpanded = $state(false);

	// Lock body scroll when expanded, with cleanup on unmount
	$effect(() => {
		if (typeof document !== 'undefined') {
			if (isExpanded) {
				document.body.style.overflow = 'hidden';
			} else {
				document.body.style.overflow = '';
			}
		}
		return () => {
			if (typeof document !== 'undefined') {
				document.body.style.overflow = '';
			}
		};
	});
</script>

{#if player.currentTrack}
	<!-- Persistent bottom bar container -->
	<div
		class="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-t border-border/40 shadow-lg transition-all duration-300 ease-in-out"
		class:h-screen={isExpanded}
		class:md:h-24={!isExpanded}
		class:h-20={!isExpanded}
	>
		{#if !isExpanded}
			<!-- Mini Player View -->
			<MiniPlayer onExpand={() => (isExpanded = true)} />
		{:else}
			<!-- Expanded Full-Screen Mobile/Tablet View -->
			<FullscreenPlayer onClose={() => (isExpanded = false)} />
		{/if}
	</div>
{/if}
