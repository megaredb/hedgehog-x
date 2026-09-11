<script lang="ts">
	import type { ShowcaseBook } from '$lib/data/mockShowcase';
	import { inview } from '$lib/actions/inview';
	import { Button } from '$lib/components/ui/button';
	import { Play } from '@lucide/svelte';
	import { resolve } from '$app/paths';

	let {
		book,
		index,
		onVisible
	}: {
		book: ShowcaseBook;
		index: number;
		onVisible: (idx: number) => void;
	} = $props();

	function handleInView(isVisible: boolean) {
		if (isVisible) {
			onVisible(index);
		}
	}
</script>

<section
	use:inview={handleInView}
	class="relative flex h-full w-full snap-start snap-always flex-col justify-end overflow-hidden px-8 pb-24 md:px-16 md:pb-32 lg:px-24"
>
	<div class="max-w-2xl space-y-6">
		<h1 class="text-4xl font-extrabold tracking-tight text-foreground drop-shadow-md md:text-6xl">
			{book.title}
		</h1>
		<p
			class="line-clamp-3 max-w-xl text-lg leading-relaxed text-foreground/90 drop-shadow md:line-clamp-4 md:text-xl"
		>
			{book.description}
		</p>

		<div class="flex flex-wrap items-center gap-4 pt-4">
			<Button
				size="lg"
				href={resolve(`/books/${book.id}`)}
				class="rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/20"
			>
				<Play class="mr-2 h-5 w-5" />
				Слушать
			</Button>
		</div>
	</div>
</section>
