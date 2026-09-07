<script lang="ts">
	import { useDownloads } from '$lib/client/downloads/downloadManager.svelte';
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import { Trash2, XCircle, HardDriveDownload, Clock } from '@lucide/svelte';
	import * as Accordion from '$lib/components/ui/accordion';
	import { Item } from '$lib/components/ui/item';
	import { Empty } from '$lib/components/ui/empty';
	import { resolve } from '$app/paths';
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
	<div class="flex items-center gap-3 mb-2">
		<HardDriveDownload class="w-8 h-8 text-primary" />
		<h1 class="text-3xl font-bold tracking-tight">Загрузки</h1>
	</div>
	<p class="text-muted-foreground mb-8">
		Менеджер загрузок. Здесь вы можете управлять сохраненными аудиокнигами для
		оффлайн-прослушивания.
	</p>

	<!-- Активная очередь -->
	<section class="mb-10">
		<div class="flex flex-wrap items-center justify-between gap-4 mb-4">
			<h2 class="text-xl font-semibold">Активные загрузки и очередь</h2>
			{#if activeGroups.length > 0}
				<Button
					variant="ghost"
					size="sm"
					class="text-destructive hover:text-destructive hover:bg-destructive/10"
					onclick={() => manager.cancelAllQueued()}
				>
					<XCircle class="w-4 h-4 mr-2" />
					Очистить очередь
				</Button>
			{/if}
		</div>

		{#if activeGroups.length === 0}
			<Empty class="border">
				<h3 class="text-lg font-semibold">Очередь пуста</h3>
				<p class="text-sm text-muted-foreground mt-2">Нет активных или запланированных загрузок.</p>
			</Empty>
		{:else}
			<Accordion.Root type="multiple" class="w-full bg-card rounded-xl border shadow-sm">
				{#each activeGroups as group (group.volumeId)}
					<Accordion.Item value={group.volumeId}>
						<Accordion.Trigger class="hover:no-underline hover:bg-muted/30 px-4 transition-colors">
							<div class="flex items-center gap-4 w-full">
								{#if group.volume?.coverUrl}
									<img
										src={group.volume.coverUrl}
										alt="Cover"
										class="w-10 h-10 rounded-md object-cover shadow-sm"
									/>
								{/if}
								<div class="flex-1 text-left min-w-0">
									<a
										href={group.volume
											? resolve(`/books/${group.volume.bookId}/${group.volume.id}`)
											: '#'}
										class="font-semibold text-base hover:underline truncate block text-foreground"
										onclick={(e) => e.stopPropagation()}
									>
										{group.volume?.title || 'Неизвестный том'}
									</a>
									<p class="text-xs text-muted-foreground mt-0.5">
										{group.items.length}
										{group.items.length === 1 ? 'глава' : 'глав'} в очереди
									</p>
								</div>
								<Button
									variant="outline"
									size="sm"
									class="text-destructive hover:bg-destructive hover:text-destructive-foreground mr-2 shrink-0 transition-colors"
									onclick={(e) => {
										e.stopPropagation();
										manager.cancelVolumeQueue(group.volumeId);
									}}
								>
									Отменить том
								</Button>
							</div>
						</Accordion.Trigger>
						<Accordion.Content class="p-4 pt-1 bg-muted/5 border-t">
							<div class="flex flex-col gap-2 mt-2">
								{#each group.items as { chapter, download } (chapter.id)}
									<Item
										class="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/10 transition-colors"
									>
										<div class="flex-1 min-w-0 pr-4">
											<p class="font-medium truncate text-sm">{chapter.title}</p>
											{#if download.status === 'downloading'}
												{@const stats = manager.getProgress(chapter.id)}
												<div class="flex items-center gap-3 mt-1.5">
													<Progress value={stats.percentage} class="h-1.5 flex-1" />
													<span class="text-xs font-mono text-primary w-12 text-right">
														{stats.percentage}%
													</span>
												</div>
											{:else}
												<p class="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
													<Clock class="w-3.5 h-3.5" /> В очереди
												</p>
											{/if}
										</div>
										<Button
											variant="ghost"
											size="icon"
											class="shrink-0 text-muted-foreground hover:text-destructive"
											title="Отменить главу"
											onclick={() => manager.cancelDownload(chapter.id)}
										>
											<XCircle class="w-4.5 h-4.5" />
										</Button>
									</Item>
								{/each}
							</div>
						</Accordion.Content>
					</Accordion.Item>
				{/each}
			</Accordion.Root>
		{/if}
	</section>

	<!-- Сохраненные тома -->
	<section>
		<h2 class="text-xl font-semibold mb-4">Сохраненные тома</h2>

		{#if downloadedGroups.length === 0}
			<Empty class="border">
				<h3 class="text-lg font-semibold">Нет загрузок</h3>
				<p class="text-sm text-muted-foreground mt-2">У вас пока нет полностью скачанных глав.</p>
			</Empty>
		{:else}
			<Accordion.Root type="multiple" class="w-full bg-card rounded-xl border shadow-sm">
				{#each downloadedGroups as group (group.volumeId)}
					<Accordion.Item value={group.volumeId}>
						<Accordion.Trigger class="hover:no-underline hover:bg-muted/30 px-4 transition-colors">
							<div class="flex items-center gap-4 w-full">
								{#if group.volume?.coverUrl}
									<img
										src={group.volume.coverUrl}
										alt="Cover"
										class="w-10 h-10 rounded-md object-cover shadow-sm"
									/>
								{/if}
								<div class="flex-1 text-left min-w-0">
									<a
										href={group.volume
											? resolve(`/books/${group.volume.bookId}/${group.volume.id}`)
											: '#'}
										class="font-semibold text-base hover:underline truncate block text-foreground"
										onclick={(e) => e.stopPropagation()}
									>
										{group.volume?.title || 'Неизвестный том'}
									</a>
									<p class="text-xs mt-0.5 text-green-600 font-medium">
										Доступно оффлайн: {group.items.length}
										{group.items.length === 1 ? 'глава' : 'глав'}
									</p>
								</div>
								<Button
									variant="outline"
									size="sm"
									class="text-destructive hover:bg-destructive hover:text-destructive-foreground mr-2 shrink-0 transition-colors"
									onclick={(e) => {
										e.stopPropagation();
										// Отменить все скачанные главы в томе
										group.items.forEach(({ chapter }) => {
											manager.deleteDownload(chapter.id);
										});
									}}
								>
									Удалить том
								</Button>
							</div>
						</Accordion.Trigger>
						<Accordion.Content class="p-4 pt-1 bg-muted/5 border-t">
							<div class="flex flex-col gap-2 mt-2">
								{#each group.items as { chapter } (chapter.id)}
									{@const stats = manager.getProgress(chapter.id)}
									<Item
										class="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/10 transition-colors"
									>
										<div class="flex-1 min-w-0 pr-4">
											<p class="font-medium truncate text-sm">{chapter.title}</p>
											<p class="text-xs text-muted-foreground mt-1">
												Размер: {stats.totalBytes > 0
													? (stats.totalBytes / (1024 * 1024)).toFixed(2) + ' МБ'
													: 'Неизвестно'}
											</p>
										</div>
										<Button
											variant="ghost"
											size="icon"
											class="shrink-0 text-muted-foreground hover:text-destructive"
											title="Удалить главу"
											onclick={() => manager.deleteDownload(chapter.id)}
										>
											<Trash2 class="w-4.5 h-4.5" />
										</Button>
									</Item>
								{/each}
							</div>
						</Accordion.Content>
					</Accordion.Item>
				{/each}
			</Accordion.Root>
		{/if}
	</section>
</div>
