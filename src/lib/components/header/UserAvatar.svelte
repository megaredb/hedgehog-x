<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar';
	import { cn, getInitial } from '$lib/utils';
	import type { SessionUser } from '$lib/client/providers';

	let { user, size = 'md' }: { user: SessionUser; size?: 'sm' | 'md' | 'lg' } = $props();
</script>

<Avatar.Root
	class={cn(
		'border border-border/80 shadow-sm',
		size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-9 w-9'
	)}
>
	{#if user?.image}
		<Avatar.Image src={user.image} alt={user.name ?? ''} />
	{:else}
		<Avatar.Fallback
			class={cn(
				'bg-primary/5 text-primary',
				size === 'lg' ? 'text-lg font-bold' : 'text-xs font-semibold'
			)}
		>
			{getInitial(user?.name)}
		</Avatar.Fallback>
	{/if}
</Avatar.Root>
