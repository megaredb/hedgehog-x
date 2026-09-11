<script lang="ts">
	import { resolve } from '$app/paths';
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { LayoutGrid, List as ListIcon } from '@lucide/svelte';

	let { data } = $props();

	let viewMode = $state<'grid' | 'list'>('grid');

	// Поскольку syncService в +layout.ts кладет данные в базу,
	// эта руна либо сразу покажет кэш, либо обновится через миллисекунду.
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
</script>

<svelte:head>
	<title>{bookQuery.data?.title || 'Книга'} | Тома</title>
</svelte:head>

<main class="layout-content py-4 md:py-8">
	<div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
		<div>
			<h1 class="text-4xl font-extrabold tracking-tight">
				{bookQuery.data?.title || 'Загрузка...'}
			</h1>
			<p class="mt-2 text-muted-foreground">Список томов</p>
		</div>

		<!-- View Mode Toggle -->
		<div
			class="flex items-center gap-1 self-start rounded-lg border border-border/50 bg-muted/50 p-1 sm:self-auto"
		>
			<button
				class="rounded-md p-2 transition-colors {viewMode === 'grid'
					? 'bg-background text-foreground shadow-sm'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				onclick={() => (viewMode = 'grid')}
				aria-label="Сетка"
			>
				<LayoutGrid class="h-5 w-5" />
			</button>
			<button
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

	{#if volumesQuery.data.length === 0}
		<div class="rounded-2xl border-2 border-dashed border-border/50 bg-muted/30 p-8 text-center">
			<p class="text-lg text-muted-foreground">Тома не найдены или загружаются...</p>
		</div>
	{:else}
		<div
			class={viewMode === 'grid'
				? 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6 lg:grid-cols-5'
				: 'flex flex-col gap-4'}
		>
			{#each volumesQuery.data as volume (volume.id)}
				<a
					href={resolve(`/books/${data.bookId}/${volume.id}`)}
					class="group flex {viewMode === 'grid'
						? 'flex-col'
						: 'flex-row'} overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:shadow-md md:rounded-2xl"
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
								class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
								loading="lazy"
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
	{/if}
</main>
