<script lang="ts">
	import { resolve } from '$app/paths';
	import { db, type OfflineBook, type OfflineVolume } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { OpenGraphMeta, formatBookOgTitle } from '$lib/components/seo';
	import { LayoutGrid, List as ListIcon } from '@lucide/svelte';

	let { data } = $props();

	let viewMode = $state<'grid' | 'list'>('grid');

	// Live query directly resolves from cached Dexie database
	const bookQuery = useDexie(
		() => db.books.get(data.bookId),
		() => undefined,
		() => [data.bookId]
	);
	const volumesQuery = useDexie(
		() => db.volumes.where('bookId').equals(data.bookId).toArray(),
		() => [],
		() => [data.bookId]
	);

	const serverData = $derived(
		data as typeof data & {
			book?: OfflineBook;
			volumes?: OfflineVolume[];
		}
	);
	const book = $derived(bookQuery.data ?? serverData.book);
	// SSR already has the complete sorted list; prefer it to avoid a hydration shift
	// when Dexie is still catching up with the server catalog.
	const volumes = $derived(
		(serverData.volumes?.length ?? 0) > 0
			? serverData.volumes!
			: [...volumesQuery.data].sort((a, b) => a.volumeNumber - b.volumeNumber)
	);
	const INITIAL_VOLUMES = 12;
	let visibleCount = $state(INITIAL_VOLUMES);
	const visibleVolumes = $derived(volumes.slice(0, visibleCount));

	const ogTitle = $derived(formatBookOgTitle(book?.title));
</script>

<OpenGraphMeta
	title={ogTitle}
	description={book?.description || 'Список томов аудиокниги на Hedgehog X'}
	image={book?.coverUrl}
	type="book"
/>

<svelte:head>
	{#each volumes.slice(0, 4) as volume (volume.id)}
		{#if volume.coverUrl}
			<link rel="preload" as="image" href={volume.coverUrl} fetchpriority="high" />
		{/if}
	{/each}
</svelte:head>

<main class="layout-content py-4 md:py-8">
	<div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
		<div>
			<h1 class="text-4xl font-extrabold tracking-tight">
				{book?.title || 'Загрузка...'}
			</h1>
			<p class="mt-2 text-muted-foreground">Список томов</p>
		</div>

		<!-- View Mode Toggle -->
		<div
			class="flex items-center gap-1 self-start rounded-lg border border-border/50 bg-muted/50 p-1 sm:self-auto"
		>
			<button
				type="button"
				class="rounded-md p-2 transition-colors {viewMode === 'grid'
					? 'bg-background text-foreground shadow-sm'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				onclick={() => (viewMode = 'grid')}
				aria-label="Сетка"
			>
				<LayoutGrid class="h-5 w-5" />
			</button>
			<button
				type="button"
				class="rounded-md p-2 transition-colors {viewMode === 'list'
					? 'bg-background text-foreground shadow-sm'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				onclick={() => (viewMode = 'list')}
				aria-label="Список"
			>
				<ListIcon class="h-5 w-5" />
			</button>
		</div>
	</div>

	{#if volumes.length === 0}
		<div class="rounded-2xl border-2 border-dashed border-border/50 bg-muted/30 p-8 text-center">
			<p class="text-lg text-muted-foreground">Тома не найдены или загружаются...</p>
		</div>
	{:else}
		<div
			class={viewMode === 'grid'
				? 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6 lg:grid-cols-5'
				: 'flex flex-col gap-4'}
		>
			{#each visibleVolumes as volume, i (volume.id)}
				<a
					href={resolve(`/books/${data.bookId}/${volume.id}`)}
					class="group flex {viewMode === 'grid'
						? 'min-h-[18rem] flex-col'
						: 'flex-row'} overflow-hidden rounded-xl border border-border/60 bg-card/50 text-card-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none md:rounded-2xl"
				>
					<div
						class="{viewMode === 'grid'
							? 'aspect-3/4 w-full'
							: 'w-24 shrink-0 sm:w-32 lg:w-40'} relative overflow-hidden bg-muted"
					>
						{#if volume.coverUrl}
							<img
								src={volume.coverUrl}
								alt={`Обложка ${volume.title}`}
								width={300}
								height={400}
								class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
								loading={i < 4 ? 'eager' : 'lazy'}
								fetchpriority={i < 4 ? 'high' : 'auto'}
							/>
						{:else}
							<div class="absolute inset-0 flex items-center justify-center bg-secondary/50">
								<span
									class="px-2 text-center text-xs font-medium text-secondary-foreground/50 sm:text-sm"
									>Без обложки</span
								>
							</div>
						{/if}
						<div
							class="absolute top-2 left-2 rounded-md bg-background/80 px-2 py-1 text-xs font-bold text-foreground shadow-sm backdrop-blur-md"
						>
							Том {volume.volumeNumber}
						</div>
					</div>

					<div class="flex flex-1 flex-col justify-center p-3 sm:p-4">
						<h2
							class="{viewMode === 'grid'
								? 'text-sm sm:text-base'
								: 'text-lg sm:text-xl'} line-clamp-2 leading-tight font-bold"
						>
							{volume.title}
						</h2>
						{#if viewMode === 'list'}
							<p class="mt-2 line-clamp-2 text-sm text-muted-foreground sm:line-clamp-3">
								{volume.description || 'Описание отсутствует'}
							</p>
						{/if}
					</div>
				</a>
			{/each}
		</div>
		{#if visibleCount < volumes.length}
			<div class="mt-8 flex justify-center">
				<button
					type="button"
					class="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
					onclick={() => (visibleCount += INITIAL_VOLUMES)}
				>
					Показать ещё ({volumes.length - visibleCount})
				</button>
			</div>
		{/if}
	{/if}
</main>
