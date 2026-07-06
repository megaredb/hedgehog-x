<script lang="ts">
	import { player } from '$lib/client/player.svelte';

	let themeColor = $derived(player.currentTrack?.themeColor || null);

	// Dynamically compute standard CSS transitions
	let gradientBackground = $derived.by(() => {
		if (themeColor) {
			const colorValue = themeColor.startsWith('#')
				? `${themeColor}15`
				: `color-mix(in oklch, ${themeColor} 15%, transparent)`;
			return `radial-gradient(circle at 50% -10%, ${colorValue}, var(--background) 75%)`;
		}
		return `radial-gradient(circle at 50% -10%, var(--background), var(--background))`;
	});
</script>

<div
	class="fixed inset-0 -z-50 w-full h-full transition-all duration-1000 ease-in-out pointer-events-none"
	style:background={gradientBackground}
></div>
