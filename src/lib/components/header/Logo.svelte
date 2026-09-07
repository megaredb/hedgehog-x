<script lang="ts">
	import { cn } from '$lib/utils';

	let { size = 'md' }: { size?: 'sm' | 'md' } = $props();
</script>

<div class={cn('flex items-center select-none', size === 'md' ? 'gap-3' : 'gap-2')}>
	<div
		class={cn(
			'rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shadow-sm',
			size === 'md' ? 'h-9 w-9' : 'h-8 w-8'
		)}
	>
		<img
			alt="logo"
			src="/logo.webp"
			class={cn('rounded-full object-cover', size === 'md' ? 'h-7 w-7' : 'h-6.5 w-6.5')}
		/>
	</div>
	<span
		class={cn(
			'font-extrabold tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-transparent',
			size === 'md' ? 'text-lg' : 'text-md'
		)}
	>
		HEDGEHOG.INC
	</span>
</div>
