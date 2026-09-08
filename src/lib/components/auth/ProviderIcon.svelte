<script lang="ts">
	import { cn } from '$lib/utils';
	import type { AuthProvider } from '$lib/client/providers';

	let { provider, class: className }: { provider: AuthProvider; class?: string } = $props();

	const Icon = $derived(provider.icon);
</script>

<Icon style="color: {provider.brandColor}" class={cn(className)} />
