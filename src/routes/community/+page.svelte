<script lang="ts">
	import { segmentTitle } from '$lib/route-titles';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
</script>

<svelte:head>
	<title>{segmentTitle('community')} — HEDGEHOG.INC</title>
</svelte:head>

<div class="p-6">
	<PageHeader
		title={segmentTitle('community')!}
		description="Обсуждения, отзывы и активность пользователей Hedgehog X."
	/>
</div>
