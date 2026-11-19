<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { Search, BookOpen, Layers } from '@lucide/svelte';
	import { strings } from '$lib/constants/strings';

	let { data }: { data: PageData } = $props();
	let query = $state('');

	const filtered = $derived(
		data.books.filter((book) => {
			const q = query.trim().toLowerCase();
			return (
				!q ||
				book.title.toLowerCase().includes(q) ||
				(book.description ?? '').toLowerCase().includes(q)
			);
		})
	);
</script>

<svelte:head>
	<title>Каталог | HEDGEHOG.INC</title>
	<meta name="description" content="Все аудиокниги HEDGEHOG.INC: описания, тома и главы." />
	{#if data.books[0]?.coverUrl}
		<link rel="preload" as="image" href={data.books[0].coverUrl} fetchpriority="high" />
	{/if}
</svelte:head>

<main class="layout-content mx-auto max-w-6xl px-4 py-8">
	<div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="mb-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
				Библиотека
			</p>
			<h1 class="text-3xl font-bold tracking-tight">{strings.nav.catalog}</h1>
			<p class="mt-1 text-sm text-muted-foreground">Все книги, их тома и главы в одном месте.</p>
		</div>
		<label class="relative block w-full sm:w-72">
			<Search
				class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			/>
			<input
				bind:value={query}
				type="search"
				placeholder={strings.common.search}
				class="h-10 w-full rounded-lg border border-border bg-card/60 pr-3 pl-9 text-sm outline-none focus:border-primary"
			/>
		</label>
	</div>

	{#if filtered.length === 0}
		<div
			class="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground"
		>
			{strings.common.notFound}
		</div>
	{:else}
		<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each filtered as book, i (book.id)}
				<a
					href={resolve(`/books/${encodeURIComponent(book.id)}` as '/')}
					class="group overflow-hidden rounded-2xl border border-border/60 bg-card/50"
				>
					<div class="relative aspect-[16/9] overflow-hidden bg-muted">
						{#if book.coverUrl}
							<img
								src={book.coverUrl}
								alt={book.title}
								width={640}
								height={360}
								class="absolute inset-0 h-full w-full object-cover"
								loading={i < 2 ? 'eager' : 'lazy'}
								fetchpriority={i === 0 ? 'high' : 'auto'}
							/>
						{:else}
							<div class="flex h-full items-center justify-center text-muted-foreground">
								<BookOpen class="h-10 w-10" />
							</div>
						{/if}
					</div>
					<div class="space-y-2 p-5">
						<h2 class="line-clamp-1 text-lg font-semibold">{book.title}</h2>
						<p class="line-clamp-2 min-h-10 text-sm text-muted-foreground">
							{book.description || 'Аудиокнига HEDGEHOG.INC'}
						</p>
						<div class="flex items-center gap-4 text-xs text-muted-foreground">
							<span class="inline-flex items-center gap-1">
								<Layers class="h-3.5 w-3.5" />
								{book.volumeCount} томов
							</span>
							<span>{book.chapterCount} глав</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</main>
