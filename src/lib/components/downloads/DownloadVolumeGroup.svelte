<script lang="ts">
	import { resolve } from '$app/paths';
	import { ExternalLink } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Accordion from '$lib/components/ui/accordion';
	import DownloadChapterRow from './DownloadChapterRow.svelte';
	import type { DownloadGroup, DownloadGroupMode } from './types';

	let {
		group,
		mode,
		onCancelVolume,
		onCancelChapter,
		onDeleteChapter
	}: {
		group: DownloadGroup;
		mode: DownloadGroupMode;
		onCancelVolume: () => void;
		onCancelChapter: (chapterId: string) => void;
		onDeleteChapter: (chapterId: string) => void;
	} = $props();
</script>

<Accordion.Item value={group.volumeId}>
	<div class="flex items-center gap-1 pr-4">
		<Accordion.Trigger
			class="hover:no-underline hover:bg-muted/30 px-4 transition-colors flex-1 min-w-0"
		>
			<div class="flex items-center gap-4 w-full">
				{#if group.volume?.coverUrl}
					<img
						src={group.volume.coverUrl}
						alt="Cover"
						class="w-10 h-10 rounded-md object-cover shadow-sm"
					/>
				{/if}
				<div class="flex-1 text-left min-w-0">
					<span class="font-semibold text-base truncate block text-foreground">
						{group.volume?.title || 'Неизвестный том'}
					</span>
					{#if mode === 'active'}
						<p class="text-xs text-muted-foreground mt-0.5">
							{group.items.length}
							{group.items.length === 1 ? 'глава' : 'глав'} в очереди
						</p>
					{:else}
						<p class="text-xs mt-0.5 text-green-600 font-medium">
							Доступно оффлайн: {group.items.length}
							{group.items.length === 1 ? 'глава' : 'глав'}
						</p>
					{/if}
				</div>
			</div>
		</Accordion.Trigger>
		<a
			href={group.volume ? resolve(`/books/${group.volume.bookId}/${group.volume.id}`) : '#'}
			class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			title="Открыть том"
			aria-label="Открыть том"
		>
			<ExternalLink class="size-4" />
		</a>
		<Button variant="destructive-outline" size="sm" class="shrink-0" onclick={onCancelVolume}>
			{mode === 'active' ? 'Отменить том' : 'Удалить том'}
		</Button>
	</div>
	<Accordion.Content class="p-4 pt-1 bg-muted/5 border-t">
		<div class="flex flex-col gap-2 mt-2">
			{#each group.items as { chapter, download } (chapter.id)}
				<DownloadChapterRow {chapter} {download} {mode} {onCancelChapter} {onDeleteChapter} />
			{/each}
		</div>
	</Accordion.Content>
</Accordion.Item>
