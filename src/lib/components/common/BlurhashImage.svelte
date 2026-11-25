<script lang="ts">
	import { decode } from 'blurhash';
	import { cn } from '$lib/utils';

	interface Props {
		src: string | null | undefined;
		alt: string;
		blurhash?: string | null;
		class?: string;
		imgClass?: string;
		width?: number;
		height?: number;
		loading?: 'eager' | 'lazy';
		fetchpriority?: 'high' | 'low' | 'auto';
		decoding?: 'sync' | 'async' | 'auto';
		sizes?: string;
	}

	let {
		src,
		alt,
		blurhash = null,
		class: className,
		imgClass,
		width,
		height,
		loading = 'lazy',
		fetchpriority = 'auto',
		decoding = 'async',
		sizes
	}: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);

	$effect(() => {
		if (!canvas || !blurhash) return;
		try {
			const pixels = decode(blurhash, 32, 32);
			const context = canvas.getContext('2d');
			if (!context) return;
			const imageData = context.createImageData(32, 32);
			imageData.data.set(pixels);
			context.putImageData(imageData, 0, 0);
		} catch {
			// A malformed hash must not block the actual image.
		}
	});
</script>

<div class={cn('relative overflow-hidden bg-muted', className)}>
	{#if blurhash}
		<canvas
			bind:this={canvas}
			width={32}
			height={32}
			class="absolute inset-0 h-full w-full object-cover"
			aria-hidden="true"
		></canvas>
	{/if}
	{#if src}
		<img
			{src}
			{alt}
			{width}
			{height}
			{loading}
			{fetchpriority}
			{decoding}
			{sizes}
			class={cn('absolute inset-0 h-full w-full object-cover', imgClass)}
		/>
	{/if}
</div>
