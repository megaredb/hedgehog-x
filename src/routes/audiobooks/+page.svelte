<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Search, BookOpen, Layers } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { onDestroy } from 'svelte';

	let { data } = $props();

	let searchQuery = $state(page.url.searchParams.get('q') || '');
	let selectedStatus = $state(page.url.searchParams.get('status') || 'all');

	let searchTimeout: ReturnType<typeof setTimeout>;

	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			const params = new SvelteURLSearchParams(page.url.searchParams);
			if (searchQuery) {
				params.set('q', searchQuery);
			} else {
				params.delete('q');
			}

			if (selectedStatus !== 'all') {
				params.set('status', selectedStatus);
			} else {
				params.delete('status');
			}

			goto(`?${params.toString()}`, { keepFocus: true, replaceState: true });
		}, 300);
	}

	function handleStatusChange(status: string) {
		selectedStatus = status;
		handleSearch();
	}

	onDestroy(() => clearTimeout(searchTimeout));
</script>

<div class="max-w-7xl mx-auto px-4 py-8 space-y-8">
	<!-- Page Title & Header -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-extrabold tracking-tight">Каталог книг</h1>
			<p class="text-sm text-muted-foreground mt-1">
				Ищите и фильтруйте книги по статусу и названию.
			</p>
		</div>

		<!-- Search Bar -->
		<div class="relative w-full md:max-w-xs">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
			<Input
				type="text"
				placeholder="Поиск книг..."
				class="pl-9 h-10 w-full"
				bind:value={searchQuery}
				oninput={handleSearch}
			/>
		</div>
	</div>

	<!-- Filter Tabs -->
	<div class="flex items-center gap-2 border-b border-border/40 pb-3 overflow-x-auto">
		<Button
			variant={selectedStatus === 'all' ? 'default' : 'ghost'}
			size="sm"
			class="rounded-full"
			onclick={() => handleStatusChange('all')}
		>
			Все
		</Button>
		<Button
			variant={selectedStatus === 'ongoing' ? 'default' : 'ghost'}
			size="sm"
			class="rounded-full"
			onclick={() => handleStatusChange('ongoing')}
		>
			В процессе (Онгоинг)
		</Button>
		<Button
			variant={selectedStatus === 'completed' ? 'default' : 'ghost'}
			size="sm"
			class="rounded-full"
			onclick={() => handleStatusChange('completed')}
		>
			Завершенные
		</Button>
	</div>

	<!-- Books Grid -->
	{#if data.books.length > 0}
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
			{#each data.books as book (book.id)}
				<Card.Root
					class="overflow-hidden border border-border/40 hover:border-primary/40 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between"
				>
					<a href="/audiobooks/{book.id}" class="outline-none block flex-1 flex-col">
						<!-- Cover image -->
						<div class="aspect-3/4 bg-muted relative overflow-hidden">
							{#if book.coverUrl}
								<img
									src={book.coverUrl}
									alt={book.title}
									class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
								/>
							{:else}
								<div
									class="w-full h-full flex flex-col items-center justify-center text-primary/40"
								>
									<BookOpen class="h-16 w-16" />
								</div>
							{/if}

							<!-- Status badge overlay -->
							<div class="absolute top-3 left-3">
								<span
									class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-md shadow border {book.status ===
									'completed'
										? 'bg-green-500/10 text-green-400 border-green-500/20'
										: 'bg-amber-500/10 text-amber-400 border-amber-500/20'}"
								>
									{book.status === 'completed' ? 'Завершена' : 'Онгоинг'}
								</span>
							</div>
						</div>

						<!-- Card Body -->
						<div class="p-4 space-y-2 flex-1 flex flex-col justify-between">
							<div>
								<h3
									class="font-bold text-base leading-snug group-hover:text-primary transition-colors line-clamp-1"
								>
									{book.title}
								</h3>
								{#if book.description}
									<p class="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
										{book.description}
									</p>
								{/if}
							</div>
						</div>
					</a>

					<!-- Action Card Footer -->
					<div
						class="p-4 pt-0 border-t border-border/10 mt-auto flex items-center justify-between text-xs text-muted-foreground"
					>
						<div class="flex items-center gap-1">
							<Layers class="h-3.5 w-3.5" />
							<span>Перейти к томам</span>
						</div>
					</div>
				</Card.Root>
			{/each}
		</div>
	{:else}
		<div class="text-center py-16 space-y-4">
			<BookOpen class="h-12 w-12 text-muted-foreground mx-auto animate-bounce" />
			<div>
				<h3 class="font-bold text-lg">Книг не найдено</h3>
				<p class="text-sm text-muted-foreground mt-1">
					Попробуйте изменить параметры поиска или фильтр.
				</p>
			</div>
		</div>
	{/if}
</div>
