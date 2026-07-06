<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { downloadManager } from '$lib/client/download.svelte';
	import { localDb, type OfflineChapter } from '$lib/client/db';
	import {
		History,
		Heart,
		Download,
		Trash2,
		LogIn,
		Layers,
		Music,
		HardDrive
	} from '@lucide/svelte';
	import { liveQuery } from 'dexie';

	let { data } = $props();

	// Tabs: 'history' | 'liked' | 'downloads'
	let activeTab = $state<'history' | 'liked' | 'downloads'>('history');

	// Local offline chapters list using Dexie liveQuery
	let offlineChapters = $state<OfflineChapter[]>([]);

	$effect(() => {
		const query = liveQuery(() =>
			localDb.offlineChapters.where('status').equals('completed').toArray()
		);
		const subscription = query.subscribe((list: OfflineChapter[]) => {
			offlineChapters = list;
		});
		return () => subscription.unsubscribe();
	});

	// Calculate total size of downloads in MB
	const totalSizeMb = $derived.by(() => {
		const totalBytes = offlineChapters.reduce((acc, curr) => acc + (curr.size || 0), 0);
		return (totalBytes / (1024 * 1024)).toFixed(1);
	});

	function formatTime(seconds: number): string {
		if (isNaN(seconds) || seconds === null) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60)
			.toString()
			.padStart(2, '0');
		return `${mins}:${secs}`;
	}

	async function handleDeleteAll() {
		for (const chapter of offlineChapters) {
			await downloadManager.deleteChapter(chapter.chapterId, chapter.filePath);
		}
	}

	async function handleDeleteItem(chapterId: string, url: string) {
		await downloadManager.deleteChapter(chapterId, url);
	}
</script>

<div class="max-w-4xl mx-auto px-4 py-8 space-y-8">
	<!-- Page Header -->
	<div>
		<h1 class="text-3xl font-extrabold tracking-tight">Моя библиотека</h1>
		<p class="text-sm text-muted-foreground mt-1">
			Ваша история прослушивания, избранное и оффлайн-загрузки.
		</p>
	</div>

	<!-- Navigation Tabs -->
	<div class="flex items-center gap-4 border-b border-border/40 pb-2">
		<button
			class="pb-2 text-sm font-semibold border-b-2 transition-all outline-none flex items-center gap-1.5"
			class:border-primary={activeTab === 'history'}
			class:text-primary={activeTab === 'history'}
			class:border-transparent={activeTab !== 'history'}
			class:text-muted-foreground={activeTab !== 'history'}
			onclick={() => (activeTab = 'history')}
		>
			<History class="h-4 w-4" />
			История
		</button>
		<button
			class="pb-2 text-sm font-semibold border-b-2 transition-all outline-none flex items-center gap-1.5"
			class:border-primary={activeTab === 'liked'}
			class:text-primary={activeTab === 'liked'}
			class:border-transparent={activeTab !== 'liked'}
			class:text-muted-foreground={activeTab !== 'liked'}
			onclick={() => (activeTab = 'liked')}
		>
			<Heart class="h-4 w-4" />
			Избранное
		</button>
		<button
			class="pb-2 text-sm font-semibold border-b-2 transition-all outline-none flex items-center gap-1.5"
			class:border-primary={activeTab === 'downloads'}
			class:text-primary={activeTab === 'downloads'}
			class:border-transparent={activeTab !== 'downloads'}
			class:text-muted-foreground={activeTab !== 'downloads'}
			onclick={() => (activeTab = 'downloads')}
		>
			<Download class="h-4 w-4" />
			Загрузки
		</button>
	</div>

	<!-- Tab Contents -->
	{#if activeTab === 'history'}
		<!-- Listening History -->
		<div class="space-y-4">
			{#if data.isGuest}
				<!-- Guest History Alert/Indicator -->
				<div
					class="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-4 text-xs flex items-center justify-between"
				>
					<span
						>Вы используете гостевой режим. Ваша история хранится локально на этом устройстве.
						Войдите, чтобы синхронизировать прогресс.</span
					>
					<Button
						href="/login"
						size="sm"
						class="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-black">Войти</Button
					>
				</div>
			{/if}

			{#if data.history.length > 0}
				<div class="grid gap-3">
					{#each data.history as h (h.chapterId)}
						<div
							class="flex items-center justify-between p-4 bg-card/60 backdrop-blur-sm border border-border/30 rounded-xl gap-4"
						>
							<div class="flex items-center gap-4 min-w-0 flex-1">
								<div class="w-12 h-12 rounded bg-muted overflow-hidden shrink-0">
									{#if h.coverUrl}
										<img src={h.coverUrl} alt={h.bookTitle} class="w-full h-full object-cover" />
									{:else}
										<Music class="h-6 w-6 text-primary/40 m-auto mt-3" />
									{/if}
								</div>
								<div class="min-w-0">
									<h4 class="text-sm font-bold truncate">{h.chapterTitle}</h4>
									<p class="text-xs text-muted-foreground truncate mt-0.5">
										Книга: {h.bookTitle} &middot; Том {h.volumeNumber} &middot; Глава {h.chapterNumber}
									</p>
								</div>
							</div>

							<div class="text-right shrink-0 flex items-center gap-3">
								<div class="text-xs">
									<span class="font-mono font-semibold text-primary"
										>{formatTime(h.progressSeconds)}</span
									>
									<span class="text-muted-foreground"> / {formatTime(h.durationSeconds)}</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center py-16 space-y-4 text-muted-foreground text-sm">
					<History class="h-10 w-10 mx-auto opacity-40 animate-pulse" />
					<p>История прослушивания пока пуста.</p>
				</div>
			{/if}
		</div>
	{:else if activeTab === 'liked'}
		<!-- Liked Volumes -->
		<div class="space-y-4">
			{#if data.isGuest}
				<div
					class="border border-border/40 bg-card rounded-2xl p-12 text-center space-y-4 max-w-md mx-auto"
				>
					<Heart class="h-12 w-12 text-muted-foreground mx-auto animate-pulse" />
					<div class="space-y-1">
						<h3 class="font-bold text-lg">Избранное недоступно</h3>
						<p class="text-xs text-muted-foreground">
							Войдите с помощью Passkey или Discord, чтобы сохранять книги в Избранное.
						</p>
					</div>
					<Button href="/login" size="sm" class="gap-1.5 h-9">
						<LogIn class="h-4 w-4" />
						Войти на сайт
					</Button>
				</div>
			{:else}
				{#if data.likedVolumes.length > 0}
					<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
						{#each data.likedVolumes as volume (volume.volumeId)}
							<Card.Root
								class="overflow-hidden border border-border/40 hover:border-primary/40 shadow-sm transition-all duration-300 group"
							>
								<a
									href="/audiobooks/{volume.bookId}/volumes/{volume.volumeId}"
									class="outline-none block"
								>
									<div class="aspect-video bg-muted relative">
										{#if volume.coverUrl}
											<img
												src={volume.coverUrl}
												alt={volume.volumeTitle}
												class="w-full h-full object-cover"
											/>
										{:else}
											<div class="w-full h-full flex items-center justify-center text-primary/40">
												<Layers class="h-12 w-12" />
											</div>
										{/if}
									</div>
									<div class="p-4 space-y-1">
										<h3
											class="font-bold text-base leading-snug group-hover:text-primary transition-colors line-clamp-1"
										>
											{volume.volumeTitle}
										</h3>
										<p class="text-xs text-muted-foreground">
											Книга: {volume.bookTitle}
										</p>
									</div>
								</a>
							</Card.Root>
						{/each}
					</div>
				{:else}
					<div class="text-center py-16 space-y-4 text-muted-foreground text-sm">
						<Heart class="h-10 w-10 mx-auto opacity-40 animate-pulse" />
						<p>Вы пока не добавили ни одного тома в избранное.</p>
					</div>
				{/if}
			{/if}
		</div>
	{:else if activeTab === 'downloads'}
		<!-- Downloads Manager -->
		<div class="space-y-6">
			<!-- Storage space info -->
			<div
				class="bg-card/40 backdrop-blur-sm border border-border/40 p-4 rounded-xl flex items-center justify-between gap-4"
			>
				<div class="flex items-center gap-3">
					<HardDrive class="h-5 w-5 text-primary" />
					<div class="text-xs">
						<p class="font-bold text-foreground">Занято аудиофайлами</p>
						<p class="text-muted-foreground mt-0.5">Размер сохраненного кэша: {totalSizeMb} МБ</p>
					</div>
				</div>
				{#if offlineChapters.length > 0}
					<Button
						variant="ghost"
						size="sm"
						class="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 text-xs font-semibold"
						onclick={handleDeleteAll}
					>
						<Trash2 class="h-3.5 w-3.5 mr-1" />
						Очистить память
					</Button>
				{/if}
			</div>

			{#if offlineChapters.length > 0}
				<div class="grid gap-3">
					{#each offlineChapters as chapter (chapter.chapterId)}
						<div
							class="flex items-center justify-between p-4 bg-card/60 backdrop-blur-sm border border-border/30 rounded-xl gap-4"
						>
							<div class="flex items-center gap-3 min-w-0 flex-1">
								<div class="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
									<Music class="h-5 w-5 text-primary/60 animate-pulse" />
								</div>
								<div class="min-w-0">
									<h4 class="text-sm font-bold truncate leading-snug">Глава</h4>
									<p class="text-xs text-muted-foreground truncate mt-0.5">
										Размер: {(chapter.size / (1024 * 1024)).toFixed(1)} МБ &middot; Скачано оффлайн
									</p>
								</div>
							</div>

							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
								onclick={() => handleDeleteItem(chapter.chapterId, chapter.filePath)}
								aria-label="Удалить файл"
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center py-16 space-y-4 text-muted-foreground text-sm">
					<Download class="h-10 w-10 mx-auto opacity-40 animate-pulse" />
					<p>
						Нет скачанных глав. Скачивайте главы на страницах томов для прослушивания без интернета.
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
