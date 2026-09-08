<script lang="ts">
	import { Clock, Trash2, XCircle } from '@lucide/svelte';
	import { useDownloads } from '$lib/client/downloads/downloadManager.svelte';
	import type { OfflineChapter, OfflineDownload } from '$lib/client/db';
	import { Button } from '$lib/components/ui/button';
	import { Item } from '$lib/components/ui/item';
	import { Progress } from '$lib/components/ui/progress';
	import type { DownloadGroupMode } from './types';

	let {
		chapter,
		download,
		mode,
		onCancelChapter,
		onDeleteChapter
	}: {
		chapter: OfflineChapter;
		download: OfflineDownload;
		mode: DownloadGroupMode;
		onCancelChapter: (chapterId: string) => void;
		onDeleteChapter: (chapterId: string) => void;
	} = $props();

	const manager = useDownloads();
	const stats = $derived(manager.getProgress(chapter.id));
</script>

<Item
	class="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/10 transition-colors"
>
	<div class="flex-1 min-w-0 pr-4">
		<p class="font-medium truncate text-sm">{chapter.title}</p>
		{#if mode === 'active'}
			{#if download.status === 'downloading'}
				<div class="flex items-center gap-3 mt-1.5">
					<Progress value={stats.percentage} class="h-1.5 flex-1" />
					<span class="text-xs font-mono text-primary w-12 text-right">{stats.percentage}%</span>
				</div>
			{:else}
				<p class="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
					<Clock class="w-3.5 h-3.5" /> В очереди
				</p>
			{/if}
		{:else}
			<p class="text-xs text-muted-foreground mt-1">
				Размер: {stats.totalBytes > 0
					? (stats.totalBytes / (1024 * 1024)).toFixed(2) + ' МБ'
					: 'Неизвестно'}
			</p>
		{/if}
	</div>
	{#if mode === 'active'}
		<Button
			variant="destructive-ghost"
			size="icon"
			class="shrink-0"
			title="Отменить главу"
			aria-label="Отменить главу"
			onclick={() => onCancelChapter(chapter.id)}
		>
			<XCircle class="w-4.5 h-4.5" />
		</Button>
	{:else}
		<Button
			variant="destructive-ghost"
			size="icon"
			class="shrink-0"
			title="Удалить главу"
			aria-label="Удалить главу"
			onclick={() => onDeleteChapter(chapter.id)}
		>
			<Trash2 class="w-4.5 h-4.5" />
		</Button>
	{/if}
</Item>
