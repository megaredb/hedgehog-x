<script lang="ts">
	import { onMount } from 'svelte';

	let { text, class: className = '' }: { text: string; class?: string } = $props();

	let viewport = $state<HTMLSpanElement | null>(null);
	let track = $state<HTMLSpanElement | null>(null);
	let distance = $state(0);
	let overflow = $state(false);

	function measure() {
		if (!viewport || !track) return;
		const next = Math.max(0, track.scrollWidth - viewport.clientWidth);
		distance = next;
		overflow = next > 4;
	}

	onMount(() => {
		measure();
		const observer = new ResizeObserver(measure);
		if (viewport) observer.observe(viewport);
		if (track) observer.observe(track);
		return () => observer.disconnect();
	});
</script>

<span
	bind:this={viewport}
	class="marquee-text {overflow ? 'is-overflow' : ''} {className}"
	title={text}
>
	<span bind:this={track} class="marquee-track" style={'--marquee-distance: -' + distance + 'px'}>
		{text}
	</span>
</span>

<style>
	.marquee-text {
		display: block;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0,
			#000 8px,
			#000 calc(100% - 8px),
			transparent 100%
		);
		mask-image: linear-gradient(
			to right,
			transparent 0,
			#000 8px,
			#000 calc(100% - 8px),
			transparent 100%
		);
	}

	.marquee-track {
		display: inline-block;
		min-width: 100%;
		will-change: transform;
	}

	.marquee-text.is-overflow .marquee-track {
		animation: marquee-scroll 16s linear 1.5s infinite;
	}

	.marquee-text:not(.is-overflow) .marquee-track {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.marquee-text:hover .marquee-track,
	.marquee-text:focus-within .marquee-track {
		animation-play-state: paused;
	}

	@keyframes marquee-scroll {
		0%,
		12% {
			transform: translateX(0);
		}
		88%,
		100% {
			transform: translateX(var(--marquee-distance));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.marquee-text.is-overflow .marquee-track {
			animation: none;
			text-overflow: ellipsis;
		}
	}
</style>
