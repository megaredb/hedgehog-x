<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		icon,
		actions
	}: {
		title: string;
		description?: string;
		icon?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

{#snippet heading()}
	<div class="flex items-center gap-3">
		{#if icon}
			{@render icon()}
		{/if}
		<h1 class="text-3xl font-bold tracking-tight">{title}</h1>
	</div>
	{#if description}
		<p class="text-muted-foreground mt-2">{description}</p>
	{/if}
{/snippet}

{#if actions}
	<div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
		<div>{@render heading()}</div>
		{@render actions()}
	</div>
{:else}
	{@render heading()}
{/if}
