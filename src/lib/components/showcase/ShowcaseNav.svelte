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
	class="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-10 pointer-events-auto"
>
	<!-- Навигация -->
	<div
		class="flex flex-col rounded-full bg-background/50 backdrop-blur-md border border-border/40 shadow-xl overflow-hidden"
	>
		<Button
			variant="ghost"
			size="icon"
			class="rounded-none w-12 h-12 text-foreground hover:bg-foreground/10 disabled:opacity-30 transition-all duration-300"
			disabled={!hasPrev}
			onclick={() => onScrollTo(currentIndex - 1)}
			title={hasPrev ? `К предыдущей: ${books[currentIndex - 1].title}` : ''}
		>
			<ChevronUp class="w-7 h-7" />
			<span class="sr-only">Вверх</span>
		</Button>

		<div class="h-px bg-border/40 w-full"></div>

		<Button
			variant="ghost"
			size="icon"
			class="rounded-none w-12 h-12 text-foreground hover:bg-foreground/10 disabled:opacity-30 transition-all duration-300"
			disabled={!hasNext}
			onclick={() => onScrollTo(currentIndex + 1)}
			title={hasNext ? `К следующей: ${books[currentIndex + 1].title}` : ''}
		>
			<ChevronDown class="w-7 h-7" />
			<span class="sr-only">Вниз</span>
		</Button>
	</div>

	<!-- Управление видео -->
	<Button
		variant="outline"
		size="icon"
		class="rounded-full w-12 h-12 mt-2 bg-background/50 backdrop-blur-md border border-border/40 text-foreground hover:bg-foreground/10 shadow-xl transition-all duration-300"
		onclick={onToggleVideo}
		title={isVideoPlaying ? 'Выключить видеофон' : 'Включить видеофон'}
	>
		{#if isVideoPlaying}
			<MonitorOff class="w-5 h-5" />
		{:else}
			<MonitorPlay class="w-5 h-5" />
		{/if}
		<span class="sr-only">Переключить видео</span>
	</Button>
</div>
