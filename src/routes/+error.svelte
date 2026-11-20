<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>{page.status} | Hedgehog X</title>
</svelte:head>

<main
	class="layout-content flex min-h-[60vh] flex-col items-center justify-center py-16 text-center"
>
	<p class="text-sm font-semibold tracking-widest text-muted-foreground">ОШИБКА {page.status}</p>
	<h1 class="mt-3 text-3xl font-bold tracking-tight">
		{page.status === 404 ? 'Страница не найдена' : 'Не удалось открыть страницу'}
	</h1>
	<p class="mt-3 max-w-md text-muted-foreground">
		{page.error?.message ?? 'Попробуйте вернуться на главную или обновить страницу.'}
	</p>
	<a
		href={resolve('/')}
		class="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
	>
		На главную
	</a>
</main>
