<script lang="ts">
	import { useDownloads } from '$lib/client/downloads/downloadManager.svelte';
	import { Trash2, Download as DownloadIcon, Loader2, Check, Clock } from '@lucide/svelte';
	import Button, { type ButtonSize, type ButtonVariant } from '../ui/button/button.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import type { OfflineChapter } from '$lib/client/db';
	import { cn } from '$lib/utils.js';

	interface Props {
		chapter: OfflineChapter;
		class?: string;
		size?: ButtonSize;
		variant?: ButtonVariant;
		[key: string]: unknown;
	}

	let {
		chapter,
		class: className = '',
		size = 'icon',
		variant = 'ghost',
		...rest
	}: Props = $props();

	let downloadManager = useDownloads();

	const isDownloaded = $derived(downloadManager.isDownloaded(chapter.id));
	const isDownloading = $derived(downloadManager.isDownloading(chapter.id));
	const isQueued = $derived(downloadManager.isQueued(chapter.id));
	const stats = $derived(downloadManager.getProgress(chapter.id));

	function toggleDownload(e: MouseEvent) {
		e.stopPropagation();
		if (isDownloaded || isDownloading || isQueued) {
			downloadManager.deleteDownload(chapter.id, chapter.audioUrl);
		} else {
			downloadManager.enqueueDownload(chapter);
		}
	}

	const tooltipText = $derived.by(() => {
		if (isDownloaded) return 'Удалить из памяти';
		if (isDownloading || isQueued) return 'Отменить загрузку';
		return 'Скачать для прослушивания оффлайн';
	});

	const buttonVariant = $derived<ButtonVariant>(isDownloading || isQueued ? 'secondary' : variant);

	const buttonClass = $derived(
		cn(
			'transition-colors duration-200',
			className,
			isDownloading && 'gap-1.5 text-primary hover:text-destructive w-[72px] px-2',
			isQueued && 'gap-1.5 text-muted-foreground hover:text-destructive w-[72px] px-2',
			isDownloaded && 'text-green-600 hover:text-destructive hover:bg-destructive/10 group/btn',
			!isDownloaded && !isDownloading && !isQueued && 'hover:text-primary'
		)
	);

	const buttonSize = $derived<ButtonSize>(isDownloading || isQueued ? 'sm' : size);
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props: tooltipProps })}
			<Button
				variant={buttonVariant}
				size={buttonSize}
				class={buttonClass}
				{...tooltipProps}
				{...rest}
				onclick={(e) => {
					toggleDownload(e);
					// Compose with any existing handlers from tooltip or rest props
					if (typeof tooltipProps.onclick === 'function') tooltipProps.onclick(e);
					if (typeof rest.onclick === 'function') rest.onclick(e);
				}}
			>
				{#if isDownloaded}
					<span class="flex items-center justify-center group-hover/btn:hidden">
						<Check class="w-4.5 h-4.5" />
					</span>
					<span class="hidden items-center justify-center group-hover/btn:flex">
						<Trash2 class="w-4.5 h-4.5" />
					</span>
				{:else if isDownloading}
					<Loader2 class="w-3.5 h-3.5 animate-spin shrink-0" />
					<span class="text-xs font-mono">{stats.percentage}%</span>
				{:else if isQueued}
					<Clock class="w-3.5 h-3.5 shrink-0" />
					<span class="text-xs font-mono">В очер.</span>
				{:else}
					<DownloadIcon class="w-4.5 h-4.5" />
				{/if}
			</Button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content sideOffset={4}>
		<p>{tooltipText}</p>
	</Tooltip.Content>
</Tooltip.Root>
