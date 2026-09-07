<script lang="ts">
	import { useDownloads } from '$lib/client/downloads/downloadManager.svelte';
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Accordion from '$lib/components/ui/accordion';
	import * as Empty from '$lib/components/ui/empty';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import { segmentTitle } from '$lib/route-titles';
	import DownloadVolumeGroup from '$lib/components/downloads/DownloadVolumeGroup.svelte';
	import { HardDriveDownload, XCircle } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';

	const manager = useDownloads();

	const volumesQuery = useDexie(
		() => db.volumes.toArray(),
		() => [],
		() => []
	);
	const volumesMap = $derived(new SvelteMap(volumesQuery.data.map((v) => [v.id, v])));

	const activeGroups = $derived.by(() => {
		const groups = new SvelteMap<string, typeof manager.queuedChapters>();

		// Сначала добавляем активные
		for (const ch of manager.downloadingChapters) {
			if (!groups.has(ch.chapter.volumeId)) groups.set(ch.chapter.volumeId, []);
			groups.get(ch.chapter.volumeId)!.push(ch);
		}

		// Затем в очереди
		for (const ch of manager.queuedChapters) {
			if (!groups.has(ch.chapter.volumeId)) groups.set(ch.chapter.volumeId, []);
			groups.get(ch.chapter.volumeId)!.push(ch);
		}

		return Array.from(groups.entries()).map(([volumeId, items]) => ({
			volumeId,
			volume: volumesMap.get(volumeId),
			items
		}));
	});

	const downloadedGroups = $derived.by(() => {
		const groups = new SvelteMap<string, typeof manager.downloadedChapters>();

		for (const ch of manager.downloadedChapters) {
			if (!groups.has(ch.chapter.volumeId)) groups.set(ch.chapter.volumeId, []);
			groups.get(ch.chapter.volumeId)!.push(ch);
		}

		return Array.from(groups.entries()).map(([volumeId, items]) => ({
			volumeId,
			volume: volumesMap.get(volumeId),
			items
		}));
	});
</script>

<svelte:head>
	<title>Менеджер загрузок | Hedgehog.inc</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto">
	<div class="mb-8">
		<PageHeader
			title={segmentTitle('downloads')!}
			description="Менеджер загрузок. Здесь вы можете управлять сохраненными аудиокнигами для оффлайн-прослушивания."
		>
			{#snippet icon()}
				<HardDriveDownload class="w-8 h-8 text-primary" />
			{/snippet}
		</PageHeader>
	</div>

	<!-- Активная очередь -->
	<section class="mb-10">
		<div class="flex flex-wrap items-center justify-between gap-4 mb-4">
			<h2 class="text-xl font-semibold">Активные загрузки и очередь</h2>
			{#if activeGroups.length > 0}
				<Button variant="destructive-ghost" size="sm" onclick={() => manager.cancelAllQueued()}>
					<XCircle class="w-4 h-4 mr-2" />
					Очистить очередь
				</Button>
			{/if}
		</div>

		{#if activeGroups.length === 0}
			<Empty.Root class="border">
				<Empty.Title>Очередь пуста</Empty.Title>
				<Empty.Description>Нет активных или запланированных загрузок.</Empty.Description>
			</Empty.Root>
		{:else}
			<Accordion.Root type="multiple" class="w-full bg-card rounded-xl border shadow-sm">
				{#each activeGroups as group (group.volumeId)}
					<DownloadVolumeGroup
						{group}
						mode="active"
						onCancelVolume={() => manager.cancelVolumeQueue(group.volumeId)}
						onCancelChapter={(chapterId) => manager.cancelDownload(chapterId)}
						onDeleteChapter={(chapterId) => manager.deleteDownload(chapterId)}
					/>
				{/each}
			</Accordion.Root>
		{/if}
	</section>

	<!-- Сохраненные тома -->
	<section>
		<h2 class="text-xl font-semibold mb-4">Сохраненные тома</h2>

		{#if downloadedGroups.length === 0}
			<Empty.Root class="border">
				<Empty.Title>Нет загрузок</Empty.Title>
				<Empty.Description>У вас пока нет полностью скачанных глав.</Empty.Description>
			</Empty.Root>
		{:else}
			<Accordion.Root type="multiple" class="w-full bg-card rounded-xl border shadow-sm">
				{#each downloadedGroups as group (group.volumeId)}
					<DownloadVolumeGroup
						{group}
						mode="downloaded"
						onCancelVolume={() =>
							group.items.forEach(({ chapter }) => manager.deleteDownload(chapter.id))}
						onCancelChapter={(chapterId) => manager.cancelDownload(chapterId)}
						onDeleteChapter={(chapterId) => manager.deleteDownload(chapterId)}
					/>
				{/each}
			</Accordion.Root>
		{/if}
	</section>
</div>
