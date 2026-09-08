<script lang="ts">
	import { segmentTitle } from '$lib/route-titles';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
</script>

<svelte:head>
	<title>{segmentTitle('support')} — HEDGEHOG.INC</title>
</svelte:head>

<div class="p-6">
	<PageHeader
		title={segmentTitle('support')!}
		description="Информация о том, как вы можете поддержать развитие проекта Hedgehog X."
	/>
</div>
