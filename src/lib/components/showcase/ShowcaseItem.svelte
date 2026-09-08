<script lang="ts">
	import type { ShowcaseBook } from '$lib/data/mockShowcase';
	import { inview } from '$lib/actions/inview';
	import { Button } from '$lib/components/ui/button';
	import { Play } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';

	let {
		book,
		index,
		onVisible
	}: {
		book: ShowcaseBook;
		index: number;
		onVisible: (idx: number) => void;
	} = $props();

	// Ссылку «Слушать» показываем только если в Dexie есть реальная книга с таким id,
	// иначе витрина остаётся чисто визуальной (без гарантированного 404).
	const catalogBook = useDexie(
		() => db.books.get(book.id),
		() => undefined,
		() => [book.id]
	);

	function handleInView(isVisible: boolean) {
		if (isVisible) {
			onVisible(index);
		}
	}
</script>

<section
	use:inview={handleInView}
	class="snap-start snap-always relative h-full w-full overflow-hidden flex flex-col justify-end px-8 md:px-16 lg:px-24 pb-24 md:pb-32"
>
	<div class="max-w-2xl space-y-6">
		<h1 class="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground drop-shadow-md">
			{book.title}
		</h1>
		<p
			class="text-lg md:text-xl text-foreground/90 drop-shadow max-w-xl leading-relaxed line-clamp-3 md:line-clamp-4"
		>
			{book.description}
		</p>

		<div class="flex flex-wrap items-center gap-4 pt-4">
			{#if catalogBook.data}
				<Button
					size="lg"
					href={resolve(`/books/${book.id}`)}
					class="rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/20"
				>
					<Play class="w-5 h-5 mr-2" />
					Слушать
				</Button>
			{:else}
				<Button
					size="lg"
					disabled
					class="rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/20"
				>
					<Play class="w-5 h-5 mr-2" />
					Скоро
				</Button>
			{/if}
		</div>
	</div>
</section>
