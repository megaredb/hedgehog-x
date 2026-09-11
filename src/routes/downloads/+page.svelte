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

<div class="mx-auto max-w-4xl p-6">
	<div class="mb-2 flex items-center gap-3">
		<HardDriveDownload class="h-8 w-8 text-primary" />
		<h1 class="text-3xl font-bold tracking-tight">Загрузки</h1>
	</div>
	<p class="mb-8 text-muted-foreground">
		Менеджер загрузок. Здесь вы можете управлять сохраненными аудиокнигами для
		оффлайн-прослушивания.
	</p>

	<!-- Активная очередь -->
	<section class="mb-10">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-4">
			<h2 class="text-xl font-semibold">Активные загрузки и очередь</h2>
			{#if activeGroups.length > 0}
				<Button
					variant="ghost"
					size="sm"
					class="text-destructive hover:bg-destructive/10 hover:text-destructive"
					onclick={() => manager.cancelAllQueued()}
				>
					<XCircle class="mr-2 h-4 w-4" />
					Очистить очередь
				</Button>
			{/if}
		</div>

		{#if activeGroups.length === 0}
			<Empty class="border">
				<h3 class="text-lg font-semibold">Очередь пуста</h3>
				<p class="mt-2 text-sm text-muted-foreground">Нет активных или запланированных загрузок.</p>
			</Empty>
		{:else}
			<Accordion.Root type="multiple" class="w-full rounded-xl border bg-card shadow-sm">
				{#each activeGroups as group (group.volumeId)}
					<Accordion.Item value={group.volumeId}>
						<Accordion.Trigger class="px-4 transition-colors hover:bg-muted/30 hover:no-underline">
							<div class="flex w-full items-center gap-4">
								{#if group.volume?.coverUrl}
									<img
										src={group.volume.coverUrl}
										alt="Cover"
										class="h-10 w-10 rounded-md object-cover shadow-sm"
									/>
								{/if}
								<div class="min-w-0 flex-1 text-left">
									<a
										href={group.volume
											? resolve(`/books/${group.volume.bookId}/${group.volume.id}`)
											: '#'}
										class="block truncate text-base font-semibold text-foreground hover:underline"
										onclick={(e) => e.stopPropagation()}
									>
										{group.volume?.title || 'Неизвестный том'}
									</a>
									<p class="mt-0.5 text-xs text-muted-foreground">
										{group.items.length}
										{group.items.length === 1 ? 'глава' : 'глав'} в очереди
									</p>
								</div>
								<Button
									variant="outline"
									size="sm"
									class="hover:text-destructive-foreground mr-2 shrink-0 text-destructive transition-colors hover:bg-destructive"
									onclick={(e) => {
										e.stopPropagation();
										manager.cancelVolumeQueue(group.volumeId);
									}}
								>
									Отменить том
								</Button>
							</div>
						</Accordion.Trigger>
						<Accordion.Content class="border-t bg-muted/5 p-4 pt-1">
							<div class="mt-2 flex flex-col gap-2">
								{#each group.items as { chapter, download } (chapter.id)}
									<Item
										class="flex items-center justify-between rounded-lg border bg-background p-3 transition-colors hover:bg-muted/10"
									>
										<div class="min-w-0 flex-1 pr-4">
											<p class="truncate text-sm font-medium">{chapter.title}</p>
											{#if download.status === 'downloading'}
												{@const stats = manager.getProgress(chapter.id)}
												<div class="mt-1.5 flex items-center gap-3">
													<Progress value={stats.percentage} class="h-1.5 flex-1" />
													<span class="w-12 text-right font-mono text-xs text-primary">
														{stats.percentage}%
													</span>
												</div>
											{:else}
												<p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
													<Clock class="h-3.5 w-3.5" /> В очереди
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
											<XCircle class="h-4.5 w-4.5" />
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
		<h2 class="mb-4 text-xl font-semibold">Сохраненные тома</h2>

		{#if downloadedGroups.length === 0}
			<Empty class="border">
				<h3 class="text-lg font-semibold">Нет загрузок</h3>
				<p class="mt-2 text-sm text-muted-foreground">У вас пока нет полностью скачанных глав.</p>
			</Empty>
		{:else}
			<Accordion.Root type="multiple" class="w-full rounded-xl border bg-card shadow-sm">
				{#each downloadedGroups as group (group.volumeId)}
					<Accordion.Item value={group.volumeId}>
						<Accordion.Trigger class="px-4 transition-colors hover:bg-muted/30 hover:no-underline">
							<div class="flex w-full items-center gap-4">
								{#if group.volume?.coverUrl}
									<img
										src={group.volume.coverUrl}
										alt="Cover"
										class="h-10 w-10 rounded-md object-cover shadow-sm"
									/>
								{/if}
								<div class="min-w-0 flex-1 text-left">
									<a
										href={group.volume
											? resolve(`/books/${group.volume.bookId}/${group.volume.id}`)
											: '#'}
										class="block truncate text-base font-semibold text-foreground hover:underline"
										onclick={(e) => e.stopPropagation()}
									>
										{group.volume?.title || 'Неизвестный том'}
									</a>
									<p class="mt-0.5 text-xs font-medium text-green-600">
										Доступно оффлайн: {group.items.length}
										{group.items.length === 1 ? 'глава' : 'глав'}
									</p>
								</div>
								<Button
									variant="outline"
									size="sm"
									class="hover:text-destructive-foreground mr-2 shrink-0 text-destructive transition-colors hover:bg-destructive"
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
						<Accordion.Content class="border-t bg-muted/5 p-4 pt-1">
							<div class="mt-2 flex flex-col gap-2">
								{#each group.items as { chapter } (chapter.id)}
									{@const stats = manager.getProgress(chapter.id)}
									<Item
										class="flex items-center justify-between rounded-lg border bg-background p-3 transition-colors hover:bg-muted/10"
									>
										<div class="min-w-0 flex-1 pr-4">
											<p class="truncate text-sm font-medium">{chapter.title}</p>
											<p class="mt-1 text-xs text-muted-foreground">
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
											<Trash2 class="h-4.5 w-4.5" />
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
