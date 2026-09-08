<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const isNotFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{isNotFound ? 'Страница не найдена' : 'Ошибка'} — HEDGEHOG.INC</title>
</svelte:head>

<div
	class="layout-content flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center"
>
	<p class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
		{page.status}
	</p>
	<h1 class="text-3xl font-extrabold tracking-tight md:text-4xl">
		{#if isNotFound}
			Страница не найдена
		{:else}
			Что-то пошло не так
		{/if}
	</h1>
	<p class="max-w-md text-muted-foreground">
		{#if isNotFound}
			Книга или том не найдены: возможно, ссылка устарела или контент был удалён.
		{:else}
			Произошла непредвиденная ошибка. Обновите страницу или вернитесь на главную.
		{/if}
	</p>
	<a
		href={resolve('/')}
		class="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/80"
	>
		На главную
	</a>
</div>
