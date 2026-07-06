<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { ArrowLeft, BookOpen, Layers, Calendar } from '@lucide/svelte';

	let { data } = $props();
	const book = $derived(data.book);
	const volumes = $derived(data.volumes);

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
	}
</script>

<div class="max-w-5xl mx-auto px-4 py-8 space-y-8">
	<!-- Back link -->
	<div class="flex">
		<Button
			href="/audiobooks"
			variant="ghost"
			size="sm"
			class="gap-1.5 text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
			Назад в каталог
		</Button>
	</div>

	<!-- Book details header -->
	<section
		class="flex flex-col md:flex-row gap-6 md:gap-8 items-start border-b border-border/40 pb-8"
	>
		<div
			class="w-48 h-64 md:w-56 md:h-72 rounded-xl overflow-hidden bg-muted shadow-lg border border-border/30 shrink-0"
		>
			{#if book.coverUrl}
				<img src={book.coverUrl} alt={book.title} class="w-full h-full object-cover" />
			{:else}
				<div class="w-full h-full flex items-center justify-center text-primary/40">
					<BookOpen class="h-16 w-16" />
				</div>
			{/if}
		</div>

		<div class="space-y-4 flex-1">
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<span
						class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-md shadow border {book.status ===
						'completed'
							? 'bg-green-500/10 text-green-400 border-green-500/20'
							: 'bg-amber-500/10 text-amber-400 border-amber-500/20'}"
					>
						{book.status === 'completed' ? 'Завершена' : 'Онгоинг'}
					</span>
				</div>
				<h1 class="text-3xl font-extrabold tracking-tight leading-tight">{book.title}</h1>
			</div>

			{#if book.description}
				<p class="text-sm text-muted-foreground leading-relaxed whitespace-pre-line max-w-2xl">
					{book.description}
				</p>
			{/if}

			<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
				<Calendar class="h-4 w-4" />
				<span>Добавлена {formatDate(book.createdAt)}</span>
			</div>
		</div>
	</section>

	<!-- Volumes section -->
	<section class="space-y-6">
		<div class="flex items-center gap-2">
			<Layers class="h-5 w-5 text-primary" />
			<h2 class="text-xl font-bold">Доступные тома ({volumes.length})</h2>
		</div>

		{#if volumes.length > 0}
			<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
				{#each volumes as volume (volume.id)}
					<Card.Root
						class="overflow-hidden border border-border/40 hover:border-primary/40 shadow-sm hover:shadow transition-all duration-300 group flex flex-col justify-between"
					>
						<a href="/audiobooks/{book.id}/volumes/{volume.id}" class="outline-none block flex-1">
							<!-- Volume cover -->
							<div class="aspect-video bg-muted relative overflow-hidden">
								{#if volume.coverUrl || book.coverUrl}
									<img
										src={volume.coverUrl || book.coverUrl}
										alt={volume.title}
										class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
									/>
								{:else}
									<div class="w-full h-full flex items-center justify-center text-primary/40">
										<Layers class="h-12 w-12" />
									</div>
								{/if}

								<!-- Volume number overlay -->
								<div
									class="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10 uppercase tracking-wider"
								>
									Том {volume.volumeNumber}
								</div>
							</div>

							<!-- Card Body -->
							<div class="p-4 space-y-1">
								<h3
									class="font-bold text-base leading-snug group-hover:text-primary transition-colors line-clamp-1"
								>
									{volume.title}
								</h3>
								<p class="text-xs text-muted-foreground">Открыть список глав</p>
							</div>
						</a>
					</Card.Root>
				{/each}
			</div>
		{:else}
			<div
				class="bg-muted/40 border border-border/20 rounded-xl p-8 text-center text-muted-foreground text-sm"
			>
				У этой книги пока нет опубликованных томов.
			</div>
		{/if}
	</section>
</div>
