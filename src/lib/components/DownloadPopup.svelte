<script lang="ts">
	import { downloadManager } from '$lib/client/download.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Download } from '@lucide/svelte';
	import { slide } from 'svelte/transition';

	// Compute list of active downloads from reactive state
	const activeList = $derived(Object.entries(downloadManager.activeDownloads));
</script>

{#if activeList.length > 0}
	<div
		transition:slide={{ duration: 150 }}
		class="fixed bottom-24 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5"
	>
		<Card.Root class="border-primary/20 bg-background/95 backdrop-blur shadow-xl p-4 space-y-3">
			<div class="flex items-center gap-2 text-xs font-semibold text-primary">
				<Download class="h-4 w-4 animate-bounce" />
				<span>Скачивание файлов ({activeList.length})</span>
			</div>

			<div class="space-y-3 max-h-48 overflow-y-auto pr-1">
				{#each activeList as [chapterId, dl] (chapterId)}
					<div class="space-y-1">
						<div class="flex justify-between text-[11px] font-medium leading-none">
							<span class="truncate max-w-[200px]">{dl.title}</span>
							<span class="font-mono">{dl.progress}%</span>
						</div>
						<div class="h-1 bg-muted rounded-full overflow-hidden">
							<div
								class="h-full bg-primary transition-all duration-300"
								style="width: {dl.progress}%"
							></div>
						</div>
					</div>
				{/each}
			</div>
		</Card.Root>
	</div>
{/if}
