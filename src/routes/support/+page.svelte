<script lang="ts">
	import SupportBlock from '$lib/components/support/SupportBlock.svelte';
	import { Heart } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Поддержать автора | Hedgehog X</title>
	<meta name="description" content="Поддержите выпуск новых глав и озвучку любимых аудиокниг." />
</svelte:head>

<div class="layout-content mx-auto max-w-2xl py-6 md:py-10">
	<div class="mb-8 text-center sm:text-left">
		<div
			class="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500"
		>
			<Heart class="h-3.5 w-3.5 fill-current" />
			<span>Поддержка проекта</span>
		</div>
		<h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Поддержать автора</h1>
		<p class="mt-2 text-sm text-muted-foreground sm:text-base">
			Ваша поддержка напрямую помогает выпускать новые главы быстрее, оплачивать студийное
			оборудование и развивать проект.
		</p>
	</div>

	<SupportBlock />
</div>
