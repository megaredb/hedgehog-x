<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { useDownloads } from '$lib/client/downloads/downloadManager.svelte';
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import { Trash2, XCircle, HardDriveDownload, Clock } from '@lucide/svelte';
	import * as Accordion from '$lib/components/ui/accordion';
	import { Item } from '$lib/components/ui/item';
	import { Empty } from '$lib/components/ui/empty';
	import { PaginationBar } from '$lib/components/ui/pagination';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';
	import { formatBytes } from '$lib/utils/format';

	const manager = useDownloads();

	const volumesQuery = useDexie(
		() => db.volumes.toArray(),
		() => [],
		() => []
	);
	const volumesMap = $derived(new SvelteMap(volumesQuery.data.map((v) => [v.id, v])));
	const booksQuery = useDexie(
		() => db.books.toArray(),
		() => [],
		() => []
	);
	const booksMap = $derived(new SvelteMap(booksQuery.data.map((book) => [book.id, book])));
	const audioVersionsQuery = useDexie(
		() => db.chapterAudioVersions.toArray(),
		() => [],
		() => []
	);
	const chaptersQuery = useDexie(
		() => db.chapters.toArray(),
		() => [],
		() => []
	);
	const alternativeVolumeIds = $derived(
		new Set(
			audioVersionsQuery.data
				.filter((version) => version.versionId !== 'default')
				.map((version) => chaptersQuery.data.find((chapter) => chapter.id === version.chapterId))
				.filter((chapter): chapter is NonNullable<typeof chapter> => Boolean(chapter))
				.map((chapter) => chapter.volumeId)
		)
	);
	function hasMultipleVersions(volumeId: string): boolean {
		return alternativeVolumeIds.has(volumeId);
	}

	const activeGroups = $derived.by(() => {
		const groups = new SvelteMap<
			string,
			{ volumeId: string; versionId: string; items: typeof manager.queuedChapters }
		>();

		// Add active downloads first
		const add = (ch: (typeof manager.queuedChapters)[number]) => {
			const volumeId = ch.download.volumeId || ch.chapter.volumeId;
			const versionId = ch.download.versionId ?? 'default';
			const key = volumeId + ':' + versionId;
			if (!groups.has(key)) groups.set(key, { volumeId, versionId, items: [] });
			groups.get(key)!.items.push(ch);
		};

		for (const ch of manager.downloadingChapters) add(ch);
		for (const ch of manager.queuedChapters) add(ch);

		return Array.from(groups.values()).map((group) => {
			const volume = volumesMap.get(group.volumeId);
			return { ...group, volume, book: volume ? booksMap.get(volume.bookId) : undefined };
		});
	});

	const downloadedGroups = $derived.by(() => {
		const groups = new SvelteMap<
			string,
			{ volumeId: string; versionId: string; items: typeof manager.downloadedChapters }
		>();

		for (const ch of manager.downloadedChapters) {
			const volumeId = ch.download.volumeId || ch.chapter.volumeId;
			const versionId = ch.download.versionId ?? 'default';
			const key = volumeId + ':' + versionId;
			if (!groups.has(key)) groups.set(key, { volumeId, versionId, items: [] });
			groups.get(key)!.items.push(ch);
		}

		return Array.from(groups.values()).map((group) => {
			const volume = volumesMap.get(group.volumeId);
			return { ...group, volume, book: volume ? booksMap.get(volume.bookId) : undefined };
		});
	});

	function downloadedVersionsForVolume(volumeId: string): number {
		return new Set(
			downloadedGroups
				.filter((group) => group.volumeId === volumeId)
				.map((group) => group.versionId)
		).size;
	}

	let downloadedPage = $state(1);
	let downloadedPageSize = $state(5);

	const paginatedDownloadedGroups = $derived(
		downloadedGroups.slice(
			(downloadedPage - 1) * downloadedPageSize,
			downloadedPage * downloadedPageSize
		)
	);
</script>

<svelte:head>
	<title>Менеджер загрузок | Hedgehog.inc</title>
	<meta name="description" content="Скачанные главы аудиокниг для офлайн-прослушивания." />
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

	<!-- Active download queue -->
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
				{#each activeGroups as group (group.volumeId + ':' + group.versionId)}
					<Accordion.Item value={`${group.volumeId}:${group.versionId}`}>
						<div class="flex items-center gap-2 px-4 py-3">
							<div class="flex min-w-0 flex-1 items-center gap-4">
								{#if group.volume?.coverUrl}
									<a
										href={`/books/${group.volume.bookId}/${group.volume.id}`}
										aria-label="Перейти к тому"
									>
										<img
											src={group.volume.coverUrl}
											alt="Cover"
											class="h-10 w-10 rounded-md object-cover shadow-sm"
										/>
									</a>
								{/if}
								<div class="min-w-0 flex-1 text-left">
									<a
										href={group.volume
											? resolve(`/books/${group.volume.bookId}/${group.volume.id}`)
											: '#'}
										class="block w-fit max-w-full truncate text-base font-semibold text-foreground hover:underline"
										onclick={(e) => e.stopPropagation()}
									>
										{group.volume?.title || 'Том ' + group.volumeId}
									</a>
									{#if group.book}
										<a
											href={`/books/${group.book.id}#volumes`}
											onclick={(e) => e.stopPropagation()}
											class="mt-0.5 block w-fit max-w-full truncate text-[11px] text-muted-foreground hover:text-foreground hover:underline"
										>
											{group.book.title}
										</a>
									{/if}
									<p class="mt-0.5 text-xs text-muted-foreground">
										{group.items.length}
										{group.items.length === 1 ? 'глава' : 'глав'} в очереди
									</p>
									{#if group.versionId !== 'default' || hasMultipleVersions(group.volumeId)}
										<span
											class="mt-1 inline-flex w-fit rounded-md border px-2 py-0.5 text-[11px] font-semibold {group.versionId ===
											'default'
												? 'border-primary/30 bg-primary/10 text-primary'
												: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'}"
										>
											{group.versionId === 'default' ? 'Новая версия' : 'Старая версия'}
										</span>
									{/if}
								</div>
								<Button
									variant="outline"
									size="sm"
									class="hover:text-destructive-foreground mr-2 shrink-0 text-destructive transition-colors hover:bg-destructive"
									onclick={(e) => {
										e.stopPropagation();
										manager.cancelVolumeVersion(group.volumeId, group.versionId);
									}}
								>
									Отменить том
								</Button>
							</div>
							<Accordion.Trigger
								class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								title="Показать главы"
								aria-label="Показать главы"
							/>
						</div>
						<Accordion.Content class="border-t bg-muted/5 p-3 pt-0">
							<div class="mt-1 flex flex-col gap-2">
								{#each group.items as { chapter, download } (download.chapterId)}
									<Item
										class="flex items-center justify-between rounded-lg border bg-background p-3 transition-colors hover:bg-muted/10"
									>
										<div class="min-w-0 flex-1 pr-4">
											<a
												href={`/books/${group.book?.id ?? group.volume?.bookId}/${group.volumeId}?chapter=${encodeURIComponent(download.baseChapterId ?? chapter.id)}&version=${encodeURIComponent(download.versionId ?? 'default')}`}
												class="inline-block w-fit max-w-full truncate text-sm font-medium hover:text-primary hover:underline"
												>{download.title || chapter.title}</a
											>
											{#if download.status === 'downloading'}
												{@const stats = manager.getProgress(download.chapterId)}
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
											onclick={() => manager.cancelDownload(download.chapterId)}
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

	<!-- Saved offline volumes -->
	<section>
		<h2 class="mb-4 text-xl font-semibold">Сохраненные тома</h2>

		{#if downloadedGroups.length === 0}
			<Empty class="border">
				<h3 class="text-lg font-semibold">Нет загрузок</h3>
				<p class="mt-2 text-sm text-muted-foreground">У вас пока нет полностью скачанных глав.</p>
			</Empty>
		{:else}
			<Accordion.Root type="multiple" class="w-full rounded-xl border bg-card shadow-sm">
				{#each paginatedDownloadedGroups as group (group.volumeId + ':' + group.versionId)}
					<Accordion.Item value={`${group.volumeId}:${group.versionId}`}>
						<div class="flex items-center gap-2 px-4 py-3">
							<div class="flex min-w-0 flex-1 items-center gap-4">
								{#if group.volume?.coverUrl}
									<a
										href={`/books/${group.volume.bookId}/${group.volume.id}`}
										aria-label="Перейти к тому"
									>
										<img
											src={group.volume.coverUrl}
											alt="Cover"
											class="h-10 w-10 rounded-md object-cover shadow-sm"
										/>
									</a>
								{/if}
								<div class="min-w-0 flex-1 text-left">
									<a
										href={group.volume
											? resolve(`/books/${group.volume.bookId}/${group.volume.id}`)
											: '#'}
										class="block w-fit max-w-full truncate text-base font-semibold text-foreground hover:underline"
										onclick={(e) => e.stopPropagation()}
									>
										{group.volume?.title || 'Том ' + group.volumeId}
									</a>
									{#if group.book}
										<a
											href={`/books/${group.book.id}#volumes`}
											onclick={(e) => e.stopPropagation()}
											class="mt-0.5 block w-fit max-w-full truncate text-[11px] text-muted-foreground hover:text-foreground hover:underline"
										>
											{group.book.title}
										</a>
									{/if}
									<p class="mt-0.5 text-xs font-medium text-green-600">
										Доступно оффлайн: {group.items.length}
										{group.items.length === 1 ? 'глава' : 'глав'}
									</p>
									{#if group.versionId !== 'default' || hasMultipleVersions(group.volumeId)}
										<span
											class="mt-1 inline-flex w-fit rounded-md border px-2 py-0.5 text-[11px] font-semibold {group.versionId ===
											'default'
												? 'border-primary/30 bg-primary/10 text-primary'
												: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'}"
										>
											{group.versionId === 'default' ? 'Новая версия' : 'Старая версия'}
										</span>
									{/if}
								</div>
								<Button
									variant="outline"
									size="sm"
									class="hover:text-destructive-foreground mr-2 shrink-0 text-destructive transition-colors hover:bg-destructive"
									onclick={(e) => {
										e.stopPropagation();
										// Cancel and remove all downloaded chapters for volume
										group.items.forEach(({ download }) => {
											manager.deleteDownload(download.chapterId);
										});
									}}
								>
									{downloadedVersionsForVolume(group.volumeId) > 1 ? 'Удалить версию' : 'Удалить'}
								</Button>
							</div>
							<Accordion.Trigger
								class="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								title="Показать главы"
								aria-label="Показать главы"
							/>
						</div>
						<Accordion.Content class="border-t bg-muted/5 p-3 pt-0">
							<div class="mt-1 flex flex-col gap-2">
								{#each group.items as { chapter, download } (download.chapterId)}
									{@const stats = manager.getProgress(download.chapterId)}
									<Item
										class="flex items-center justify-between rounded-lg border bg-background p-3 transition-colors hover:bg-muted/10"
									>
										<div class="min-w-0 flex-1 pr-4">
											<a
												href={`/books/${group.book?.id ?? group.volume?.bookId}/${group.volumeId}?chapter=${encodeURIComponent(download.baseChapterId ?? chapter.id)}&version=${encodeURIComponent(download.versionId ?? 'default')}`}
												class="inline-block w-fit max-w-full truncate text-sm font-medium hover:text-primary hover:underline"
												>{download.title || chapter.title}</a
											>
											<p class="mt-1 text-xs text-muted-foreground">
												Размер: {stats.totalBytes > 0
													? formatBytes(stats.totalBytes)
													: 'Неизвестно'}
											</p>
										</div>
										<Button
											variant="ghost"
											size="icon"
											class="shrink-0 text-muted-foreground hover:text-destructive"
											title="Удалить главу"
											onclick={() => manager.deleteDownload(download.chapterId)}
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

			{#if downloadedGroups.length > 0}
				<PaginationBar
					totalItems={downloadedGroups.length}
					bind:currentPage={downloadedPage}
					bind:pageSize={downloadedPageSize}
				/>
			{/if}
		{/if}
	</section>
</div>
