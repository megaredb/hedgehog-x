<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		calculateTotalPages,
		clampPage,
		formatPaginationSummary,
		generatePaginationPages,
		type PaginationItem
	} from './pagination';
	import { ChevronLeft, ChevronRight, MoreHorizontal } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface Props {
		totalItems: number;
		currentPage?: number;
		pageSize?: number;
		showItemCount?: boolean;
		siblingCount?: number;
		class?: string;
		onPageChange?: (page: number) => void;
	}

	let {
		totalItems = 0,
		currentPage = $bindable(1),
		pageSize = $bindable(10),
		showItemCount = true,
		siblingCount = 1,
		class: className = '',
		onPageChange
	}: Props = $props();

	const totalPages = $derived(calculateTotalPages(totalItems, pageSize));
	const clampedCurrentPage = $derived(clampPage(currentPage, totalPages));

	// Keep currentPage synchronized if totalItems or pageSize changes
	$effect(() => {
		if (currentPage !== clampedCurrentPage) {
			currentPage = clampedCurrentPage;
		}
	});

	const pages = $derived<PaginationItem[]>(
		generatePaginationPages(clampedCurrentPage, totalPages, siblingCount)
	);

	const summary = $derived(formatPaginationSummary(totalItems, clampedCurrentPage, pageSize));

	function goToPage(page: number) {
		const target = clampPage(page, totalPages);
		if (target === currentPage) return;
		currentPage = target;
		onPageChange?.(target);
	}
</script>

<nav
	aria-label="Пагинация"
	class={cn(
		'flex flex-col items-center justify-between gap-3 py-3 sm:flex-row sm:gap-4',
		className
	)}
>
	{#if showItemCount}
		<p class="text-xs text-muted-foreground select-none" data-testid="pagination-summary">
			{summary}
		</p>
	{:else}
		<div></div>
	{/if}

	<div class="flex items-center gap-1 sm:gap-1.5" role="navigation">
		<!-- Previous Page Button -->
		<Button
			variant="outline"
			size="sm"
			class="h-8 gap-1 px-2.5 text-xs"
			disabled={clampedCurrentPage <= 1}
			onclick={() => goToPage(clampedCurrentPage - 1)}
			aria-label="Предыдущая страница"
		>
			<ChevronLeft class="h-4 w-4" />
			<span class="hidden sm:inline">Назад</span>
		</Button>

		<!-- Page Numbers -->
		<div class="flex items-center gap-1">
			{#each pages as pageItem, i (`${pageItem}-${i}`)}
				{#if pageItem === 'ellipsis'}
					<span
						class="flex h-8 w-8 items-center justify-center text-muted-foreground select-none"
						aria-hidden="true"
					>
						<MoreHorizontal class="h-4 w-4" />
						<span class="sr-only">Еще страницы</span>
					</span>
				{:else}
					<Button
						variant={clampedCurrentPage === pageItem ? 'default' : 'outline'}
						size="sm"
						class="h-8 min-w-8 px-2 font-mono text-xs"
						aria-current={clampedCurrentPage === pageItem ? 'page' : undefined}
						aria-label={`Страница ${pageItem}`}
						onclick={() => goToPage(pageItem)}
					>
						{pageItem}
					</Button>
				{/if}
			{/each}
		</div>

		<!-- Next Page Button -->
		<Button
			variant="outline"
			size="sm"
			class="h-8 gap-1 px-2.5 text-xs"
			disabled={clampedCurrentPage >= totalPages}
			onclick={() => goToPage(clampedCurrentPage + 1)}
			aria-label="Следующая страница"
		>
			<span class="hidden sm:inline">Вперед</span>
			<ChevronRight class="h-4 w-4" />
		</Button>
	</div>
</nav>
