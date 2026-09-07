<script lang="ts">
	import { segmentTitle } from '$lib/route-titles';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
</script>

<div class="p-6">
	<PageHeader
		title={segmentTitle('settings')!}
		description="Настройки внешнего вида, уведомлений и приложения."
	/>
</div>
