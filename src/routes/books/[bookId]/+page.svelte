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
	<div class="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
		<div>
			<h1 class="text-4xl font-extrabold tracking-tight">
				{bookQuery.data?.title || 'Загрузка...'}
			</h1>
			<p class="text-muted-foreground mt-2">Список томов</p>
		</div>

		<!-- View Mode Toggle -->
		<div
			class="flex items-center gap-1 bg-muted/50 p-1 rounded-lg self-start sm:self-auto border border-border/50"
		>
			<button
				class="p-2 rounded-md transition-colors {viewMode === 'grid'
					? 'bg-background shadow-sm text-foreground'
					: 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
				onclick={() => (viewMode = 'grid')}
				aria-label="Сетка"
			>
				<LayoutGrid class="w-5 h-5" />
			</button>
			<button
				class="p-2 rounded-md transition-colors {viewMode === 'list'
					? 'bg-background shadow-sm text-foreground'
					: 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
				onclick={() => (viewMode = 'list')}
				aria-label="Список"
			>
				<ListIcon class="w-5 h-5" />
			</button>
		</div>
	</div>

	{#if volumesQuery.data.length === 0}
		<div class="p-8 text-center bg-muted/30 rounded-2xl border-2 border-dashed border-border/50">
			<p class="text-lg text-muted-foreground">Тома не найдены или загружаются...</p>
		</div>
	{:else}
		<div
			class={viewMode === 'grid'
				? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6'
				: 'flex flex-col gap-4'}
		>
			{#each volumesQuery.data as volume (volume.id)}
				<a
					href={resolve(`/books/${data.bookId}/${volume.id}`)}
					class="group flex {viewMode === 'grid'
						? 'flex-col'
						: 'flex-row'} bg-card text-card-foreground rounded-xl md:rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
				>
					<div
						class="{viewMode === 'grid'
							? 'w-full aspect-3/4'
							: 'w-24 sm:w-32 lg:w-40 shrink-0'} bg-muted relative overflow-hidden"
					>
						{#if volume.coverUrl}
							<img
								src={volume.coverUrl}
								alt={`Обложка ${volume.title}`}
								class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
								loading="lazy"
							/>
						{:else}
							<div class="absolute inset-0 flex items-center justify-center bg-secondary/50">
								<span
									class="text-secondary-foreground/50 font-medium text-xs sm:text-sm text-center px-2"
									>Без обложки</span
								>
							</div>
						{/if}
						<div
							class="absolute top-2 left-2 bg-background/80 text-foreground px-2 py-1 text-xs rounded-md font-bold backdrop-blur-md shadow-sm"
						>
							Том {volume.volumeNumber}
						</div>
					</div>

					<div class="p-3 sm:p-4 flex flex-col justify-center flex-1">
						<h2
							class="{viewMode === 'grid'
								? 'text-sm sm:text-base'
								: 'text-lg sm:text-xl'} font-bold leading-tight line-clamp-2"
						>
							{volume.title}
						</h2>
						{#if viewMode === 'list'}
							<p class="text-muted-foreground text-sm mt-2 line-clamp-2 sm:line-clamp-3">
								{volume.description || 'Описание отсутствует'}
							</p>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</main>
