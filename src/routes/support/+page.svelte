<script lang="ts">
	import SupportBlock from '$lib/components/support/SupportBlock.svelte';
	import { Heart } from '@lucide/svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.page.title} | Hedgehog X</title>
	<meta name="description" content={data.page.intro} />
</svelte:head>

<div class="layout-content mx-auto max-w-5xl py-6 md:py-10">
	<div class="mb-8 max-w-2xl text-center sm:text-left">
		<div
			class="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500"
		>
			<Heart class="h-3.5 w-3.5 fill-current" />
			<span>Поддержка проекта</span>
		</div>
		<h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{data.page.title}</h1>
		<p class="mt-2 text-sm text-muted-foreground sm:text-base">
			{data.page.intro}
		</p>
		{#if data.page.content}
			<p class="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
				{data.page.content}
			</p>
		{/if}
	</div>

	{#if data.page.data.support}
		<SupportBlock support={data.page.data.support} />
	{/if}
</div>
