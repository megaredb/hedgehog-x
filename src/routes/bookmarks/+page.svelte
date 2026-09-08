<script lang="ts">
	import { segmentTitle } from '$lib/route-titles';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
</script>

<svelte:head>
	<title>{segmentTitle('bookmarks')} — HEDGEHOG.INC</title>
</svelte:head>

<div class="p-6">
	<PageHeader
		title={segmentTitle('bookmarks')!}
		description="Здесь будут отображаться ваши сохраненные книги и закладки."
	/>
</div>
