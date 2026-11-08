<script lang="ts">
	import type { ShowcaseBook } from '$lib/data/mockShowcase';

	let {
		books,
		currentIndex,
		isVideoPlaying
	}: {
		books: ShowcaseBook[];
		currentIndex: number;
		isVideoPlaying: boolean;
	} = $props();

	// Video element references for playback management
	let videoElements = $state<(HTMLVideoElement | null)[]>([]);

	// Play active video and pause inactive videos
	$effect(() => {
		videoElements.forEach((video, index) => {
			if (!video) return;

			if (index === currentIndex && isVideoPlaying) {
				video.play().catch(() => {
					// Ignore browser autoplay restrictions
				});
			} else {
				video.pause();
			}
		});
	});
</script>

<div class="absolute inset-0 -z-20 overflow-hidden bg-background">
	{#each books as book, i (book.id)}
		<!-- Background & video container with crossfade transition -->
		<div
			class="absolute inset-0 transition-opacity duration-700 ease-in-out"
			class:opacity-100={currentIndex === i}
			class:opacity-0={currentIndex !== i}
		>
			<!-- Background image -->
			<img
				src={book.bgImage}
				alt={book.title}
				class="absolute inset-0 h-full w-full object-cover transition-transform duration-[10s] ease-out"
				class:scale-105={currentIndex === i}
				class:scale-100={currentIndex !== i}
			/>

			<!-- Background video -->
			<video
				bind:this={videoElements[i]}
				src={book.bgVideo}
				loop
				muted
				playsinline
				class="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
				class:opacity-100={isVideoPlaying && currentIndex === i}
				class:opacity-0={!(isVideoPlaying && currentIndex === i)}
			></video>
		</div>
	{/each}

	<!-- Dark gradient overlay for text readability -->
	<div
		class="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/60 to-background/10"
	></div>
</div>
