<script lang="ts">
	import { ChevronUp, ChevronDown, MonitorPlay, MonitorOff } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import type { ShowcaseBook } from '$lib/data/mockShowcase';

	let {
		books,
		currentIndex,
		isVideoPlaying,
		onScrollTo,
		onToggleVideo
	}: {
		books: ShowcaseBook[];
		currentIndex: number;
		isVideoPlaying: boolean;
		onScrollTo: (index: number) => void;
		onToggleVideo: () => void;
	} = $props();

	const hasPrev = $derived(currentIndex > 0);
	const hasNext = $derived(currentIndex < books.length - 1);
</script>

<div
	class="pointer-events-auto absolute top-1/2 right-4 z-10 flex -translate-y-1/2 flex-col items-center gap-4 md:right-8"
>
	<!-- Навигация -->
	<div
		class="flex flex-col overflow-hidden rounded-full border border-border/40 bg-background/50 shadow-xl backdrop-blur-md"
	>
		<Button
			variant="ghost"
			size="icon"
			class="h-12 w-12 rounded-none text-foreground transition-all duration-300 hover:bg-foreground/10 disabled:opacity-30"
			disabled={!hasPrev}
			onclick={() => onScrollTo(currentIndex - 1)}
			title={hasPrev ? `К предыдущей: ${books[currentIndex - 1].title}` : ''}
		>
			<ChevronUp class="h-7 w-7" />
			<span class="sr-only">Вверх</span>
		</Button>

		<div class="h-px w-full bg-border/40"></div>

		<Button
			variant="ghost"
			size="icon"
			class="h-12 w-12 rounded-none text-foreground transition-all duration-300 hover:bg-foreground/10 disabled:opacity-30"
			disabled={!hasNext}
			onclick={() => onScrollTo(currentIndex + 1)}
			title={hasNext ? `К следующей: ${books[currentIndex + 1].title}` : ''}
		>
			<ChevronDown class="h-7 w-7" />
			<span class="sr-only">Вниз</span>
		</Button>
	</div>

	<!-- Управление видео -->
	<Button
		variant="outline"
		size="icon"
		class="mt-2 h-12 w-12 rounded-full border border-border/40 bg-background/50 text-foreground shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-foreground/10"
		onclick={onToggleVideo}
		title={isVideoPlaying ? 'Выключить видеофон' : 'Включить видеофон'}
	>
		{#if isVideoPlaying}
			<MonitorOff class="h-5 w-5" />
		{:else}
			<MonitorPlay class="h-5 w-5" />
		{/if}
		<span class="sr-only">Переключить видео</span>
	</Button>
</div>
