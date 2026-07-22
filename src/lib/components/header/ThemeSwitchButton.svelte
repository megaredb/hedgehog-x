<script lang="ts">
	import { toggleMode, mode } from 'mode-watcher';
	import { Moon, Sun } from '@lucide/svelte';
</script>

<button
	onclick={toggleMode}
	class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
>
	{#if mode.current === 'dark'}
		<Sun class="h-5 w-5" />
	{:else}
		<Moon class="h-5 w-5" />
	{/if}
</button>
