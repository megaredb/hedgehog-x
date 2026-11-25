<script lang="ts">
	import { Search, X } from '@lucide/svelte';

	export interface FilterOption {
		value: string;
		label: string;
	}

	let {
		search = $bindable(''),
		period = $bindable('all'),
		source = $bindable('all'),
		sort = $bindable('new'),
		searchPlaceholder = 'Поиск',
		sourceOptions,
		sortOptions,
		resultCount,
		totalCount,
		onReset
	}: {
		search?: string;
		period?: string;
		source?: string;
		sort?: string;
		searchPlaceholder?: string;
		sourceOptions: FilterOption[];
		sortOptions: FilterOption[];
		resultCount: number;
		totalCount: number;
		onReset?: () => void;
	} = $props();

	const periods: FilterOption[] = [
		{ value: 'all', label: 'Всё время' },
		{ value: '30', label: '30 дней' },
		{ value: '365', label: 'Год' }
	];

	const activePeriod = $derived(periods.find((option) => option.value === period));
	const activeSource = $derived(sourceOptions.find((option) => option.value === source));
	const hasFilters = $derived(search.trim() !== '' || period !== 'all' || source !== 'all');

	function reset() {
		search = '';
		period = 'all';
		source = 'all';
		sort = 'new';
		onReset?.();
	}
</script>

<div class="space-y-2.5">
	<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
		<label class="space-y-1">
			<span class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
				>Поиск</span
			>
			<div class="relative">
				<Search
					class="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
				/>
				<input
					bind:value={search}
					placeholder={searchPlaceholder}
					class="h-9 w-full rounded-md border border-input bg-background pr-2.5 pl-8 text-xs shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
				/>
			</div>
		</label>
		<label class="space-y-1">
			<span class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
				>Период</span
			>
			<select
				bind:value={period}
				class="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
			>
				{#each periods as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
		<label class="space-y-1">
			<span class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
				>Источник</span
			>
			<select
				bind:value={source}
				class="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
			>
				{#each sourceOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
		<label class="space-y-1">
			<span class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
				>Сортировка</span
			>
			<select
				bind:value={sort}
				class="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
			>
				{#each sortOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="flex flex-wrap items-center gap-1.5">
			{#if activePeriod && period !== 'all'}
				<button
					type="button"
					class="inline-flex h-6 items-center gap-1 rounded-md border bg-muted/40 px-2 text-[10px] text-muted-foreground"
					onclick={() => (period = 'all')}
				>
					{activePeriod.label}
					<X class="h-3 w-3" />
				</button>
			{/if}
			{#if activeSource && source !== 'all'}
				<button
					type="button"
					class="inline-flex h-6 items-center gap-1 rounded-md border bg-muted/40 px-2 text-[10px] text-muted-foreground"
					onclick={() => (source = 'all')}
				>
					{activeSource.label}
					<X class="h-3 w-3" />
				</button>
			{/if}
			{#if hasFilters}
				<button
					type="button"
					class="h-6 px-1 text-[10px] text-muted-foreground transition hover:text-foreground"
					onclick={reset}
				>
					Сбросить всё
				</button>
			{/if}
		</div>
		<span class="text-[10px] text-muted-foreground">Найдено: {resultCount} из {totalCount}</span>
	</div>
</div>
