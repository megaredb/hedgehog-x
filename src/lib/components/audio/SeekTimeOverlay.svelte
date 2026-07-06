<!-- SeekTimeOverlay.svelte -->
<script lang="ts">
	import { RotateCcw, RotateCw } from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	let { direction, visible = false } = $props<{
		direction: 'left' | 'right';
		visible: boolean;
	}>();
</script>

{#if visible}
	<div
		transition:fade={{ duration: 150 }}
		class="absolute inset-y-0 {direction === 'left'
			? 'left-0 rounded-l-2xl'
			: 'right-0 rounded-r-2xl'} w-[35%] z-20 flex flex-col items-center justify-center bg-black/40 text-white select-none pointer-events-none"
	>
		<div class="flex flex-col items-center gap-2 animate-pulse">
			{#if direction === 'left'}
				<RotateCcw class="h-10 w-10 stroke-[2.5]" />
				<span class="text-xs font-bold font-mono">-15 сек</span>
			{:else}
				<RotateCw class="h-10 w-10 stroke-[2.5]" />
				<span class="text-xs font-bold font-mono">+15 сек</span>
			{/if}
		</div>
	</div>
{/if}
