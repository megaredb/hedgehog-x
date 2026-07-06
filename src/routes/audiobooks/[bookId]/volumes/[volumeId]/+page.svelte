<script lang="ts">
	import { player, type Track } from '$lib/client/player.svelte';
	import { downloadManager } from '$lib/client/download.svelte';
	import { localDb } from '$lib/client/db';
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowLeft,
		Play,
		Pause,
		Download,
		Heart,
		Layers,
		Music,
		Trash2,
		MessageSquare,
		Clock,
		CheckCircle2
	} from '@lucide/svelte';
	import { liveQuery } from 'dexie';
	import { formatTime } from '$lib/utils';

	let { data } = $props();
	const book = $derived(data.book);
	const volume = $derived(data.volume);
	const chapters = $derived(data.chapters);

	// Tabs: 'chapters' | 'comments'
	let activeTab = $state<'chapters' | 'comments'>('chapters');

	// Local reactive map of downloaded chapters using Dexie liveQuery
	let offlineChaptersMap = $state<
		Record<
			string,
			{
				chapterId: string;
				status: 'downloading' | 'completed' | 'failed';
				size: number;
				filePath: string;
			}
		>
	>({});

	$effect(() => {
		const query = liveQuery(() =>
			localDb.offlineChapters.where('bookId').equals(book.id).toArray()
		);
		const subscription = query.subscribe((list) => {
			const map: Record<
				string,
				{
					chapterId: string;
					status: 'downloading' | 'completed' | 'failed';
					size: number;
					filePath: string;
				}
			> = {};
			for (const item of list) {
				map[item.chapterId] = {
					chapterId: item.chapterId,
					status: item.status,
					size: item.size,
					filePath: item.filePath
				};
			}
			offlineChaptersMap = map;
		});
		return () => subscription.unsubscribe();
	});

	// Local reactive map of listening progress using Dexie liveQuery
	let progressMap = $state<Record<string, { currentTime: number; duration: number }>>({});
	$effect(() => {
		const query = liveQuery(() => localDb.progress.where('bookId').equals(book.id).toArray());
		const subscription = query.subscribe((list) => {
			const map: Record<string, { currentTime: number; duration: number }> = {};
			for (const item of list) {
				map[item.chapterId] = { currentTime: item.currentTime, duration: item.duration };
			}
			progressMap = map;
		});
		return () => subscription.unsubscribe();
	});

	interface ChapterData {
		id: string;
		chapterNumber: number;
		title: string;
		audioUrl: string;
		durationSeconds: number;
		telegramPostUrl: string | null;
	}

	function formatDuration(seconds: number): string {
		return formatTime(seconds);
	}

	// Prepare track for player
	function mapToTrack(chapter: ChapterData): Track {
		return {
			chapterId: chapter.id,
			bookId: book.id,
			volumeId: volume.id,
			title: chapter.title,
			audioUrl: chapter.audioUrl,
			bookTitle: book.title,
			bookAuthor: book.bookAuthor || 'Автор',
			coverUrl: volume.coverUrl || book.coverUrl,
			durationInDb: chapter.durationSeconds,
			themeColor: book.themeColor
		};
	}

	function playChapter(chapter: ChapterData) {
		const tracks = chapters.map((c) => mapToTrack(c));
		const index = chapters.findIndex((c) => c.id === chapter.id);
		player.setQueue(tracks, index, true);
	}

	function playAll() {
		if (chapters.length === 0) return;
		const tracks = chapters.map((c) => mapToTrack(c));
		player.setQueue(tracks, 0, true);
	}

	// Download operations
	async function handleDownload(chapter: ChapterData) {
		await downloadManager.downloadChapter(
			{
				id: chapter.id,
				title: chapter.title,
				audioUrl: chapter.audioUrl,
				durationSeconds: chapter.durationSeconds
			},
			book.id
		);
	}

	async function handleDeleteDownload(chapter: ChapterData) {
		await downloadManager.deleteChapter(chapter.id, chapter.audioUrl);
	}

	async function handleDownloadAll() {
		for (const chapter of chapters) {
			// Avoid double-downloading if already done or downloading
			const isDownloaded = offlineChaptersMap[chapter.id]?.status === 'completed';
			const isDownloading = downloadManager.activeDownloads[chapter.id];
			if (!isDownloaded && !isDownloading) {
				handleDownload(chapter);
			}
		}
	}
</script>

<div class="max-w-5xl mx-auto px-4 py-8 space-y-8">
	<!-- Back link -->
	<div class="flex">
		<Button
			href="/audiobooks/{book.id}"
			variant="ghost"
			size="sm"
			class="gap-1.5 text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
			Назад к томам книги
		</Button>
	</div>

	<!-- Volume Details Header -->
	<section
		class="flex flex-col md:flex-row gap-6 md:gap-8 items-start border-b border-border/40 pb-8"
	>
		<div
			class="w-48 h-48 md:w-52 md:h-52 rounded-xl overflow-hidden bg-muted shadow-lg border border-border/30 shrink-0"
		>
			{#if volume.coverUrl || book.coverUrl}
				<img
					src={volume.coverUrl || book.coverUrl}
					alt={volume.title}
					class="w-full h-full object-cover"
				/>
			{:else}
				<div class="w-full h-full flex items-center justify-center text-primary/40">
					<Layers class="h-16 w-16" />
				</div>
			{/if}
		</div>

		<div class="space-y-4 flex-1 w-full">
			<div class="space-y-2">
				<span
					class="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full"
				>
					Том {volume.volumeNumber}
				</span>
				<h1 class="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight mt-2">
					{volume.title}
				</h1>
				<p class="text-sm text-muted-foreground">Книга: {book.title}</p>
			</div>

			<!-- Action panel -->
			<div class="flex flex-wrap items-center gap-3 pt-2">
				<Button
					size="sm"
					class="gap-1.5 font-medium"
					onclick={playAll}
					disabled={chapters.length === 0}
				>
					<Play class="h-4 w-4 fill-current" />
					Слушать всё
				</Button>

				<Button
					variant="outline"
					size="sm"
					class="gap-1.5"
					onclick={handleDownloadAll}
					disabled={chapters.length === 0}
				>
					<Download class="h-4 w-4" />
					Скачать все главы
				</Button>

				<Button variant="ghost" size="icon" class="h-9 w-9 rounded-full border">
					<Heart class="h-4 w-4" />
				</Button>
			</div>
		</div>
	</section>

	<!-- Tabs Navigation -->
	<div class="flex items-center gap-4 border-b border-border/40 pb-2">
		<button
			class="pb-2 text-sm font-semibold border-b-2 transition-all outline-none"
			class:border-primary={activeTab === 'chapters'}
			class:text-primary={activeTab === 'chapters'}
			class:border-transparent={activeTab !== 'chapters'}
			class:text-muted-foreground={activeTab !== 'chapters'}
			onclick={() => (activeTab = 'chapters')}
		>
			Главы ({chapters.length})
		</button>
		<button
			class="pb-2 text-sm font-semibold border-b-2 transition-all outline-none"
			class:border-primary={activeTab === 'comments'}
			class:text-primary={activeTab === 'comments'}
			class:border-transparent={activeTab !== 'comments'}
			class:text-muted-foreground={activeTab !== 'comments'}
			onclick={() => (activeTab = 'comments')}
		>
			Комментарии Telegram
		</button>
	</div>

	<!-- Tab Contents -->
	{#if activeTab === 'chapters'}
		<div class="space-y-3">
			{#if chapters.length > 0}
				{#each chapters as chapter (chapter.id)}
					{@const activeDl = downloadManager.activeDownloads[chapter.id]}
					{@const offlineState = offlineChaptersMap[chapter.id]}
					{@const isPlayingThis = player.currentTrack?.chapterId === chapter.id && player.isPlaying}

					<div
						class="flex items-center justify-between p-4 bg-card/60 backdrop-blur-sm border border-border/30 hover:border-primary/20 rounded-xl transition-all duration-200 group gap-4"
					>
						<!-- Left: Play button and chapter info -->
						<div class="flex items-center gap-4 min-w-0 flex-1">
							<Button
								variant={isPlayingThis ? 'default' : 'secondary'}
								size="icon"
								class="h-10 w-10 shrink-0 rounded-full"
								onclick={() => (isPlayingThis ? player.toggle() : playChapter(chapter))}
							>
								{#if isPlayingThis}
									<Pause class="h-4.5 w-4.5 fill-current" />
								{:else}
									<Play class="h-4.5 w-4.5 fill-current ml-0.5" />
								{/if}
							</Button>

							<div class="min-w-0 space-y-1">
								<h4
									class="text-sm font-bold truncate leading-snug group-hover:text-primary transition-colors"
								>
									Глава {chapter.chapterNumber}: {chapter.title}
								</h4>
								<div class="flex items-center gap-3 text-xs text-muted-foreground mt-1">
									<span class="flex items-center gap-1">
										<Clock class="h-3.5 w-3.5" />
										{formatDuration(chapter.durationSeconds)}
									</span>
								</div>

								<!-- Listening Progress Bar -->
								{#if progressMap[chapter.id] && progressMap[chapter.id].currentTime > 0}
									{@const p = progressMap[chapter.id]}
									{@const percent = Math.min(
										100,
										Math.round((p.currentTime / (p.duration || chapter.durationSeconds)) * 100)
									)}
									<div class="h-1 bg-muted rounded-full overflow-hidden mt-2 w-full max-w-[150px]">
										<div class="h-full bg-primary" style="width: {percent}%"></div>
									</div>
								{/if}
							</div>
						</div>

						<!-- Right: Download status and actions -->
						<div class="flex items-center gap-2">
							{#if activeDl}
								<!-- Downloading Progress -->
								<div
									class="flex items-center gap-2 text-xs font-semibold text-primary font-mono bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 select-none"
								>
									<div
										class="w-2.5 h-2.5 rounded-full border-2 border-primary border-t-transparent animate-spin"
									></div>
									<span>{activeDl.progress}%</span>
								</div>
							{:else if offlineState?.status === 'completed'}
								<!-- Downloaded -->
								<div class="flex items-center gap-1">
									<span
										class="text-xs text-green-500 font-medium flex items-center gap-1 select-none mr-1 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full"
									>
										<CheckCircle2 class="h-3.5 w-3.5 fill-current" />
										Оффлайн
									</span>
									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
										onclick={() => handleDeleteDownload(chapter)}
										aria-label="Удалить из памяти"
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							{:else}
								<!-- Ready to download -->
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 border"
									onclick={() => handleDownload(chapter)}
									aria-label="Скачать для оффлайн"
								>
									<Download class="h-4 w-4" />
								</Button>
							{/if}
						</div>
					</div>
				{/each}
			{:else}
				<div
					class="bg-muted/40 border border-border/20 rounded-xl p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2"
				>
					<Music class="h-4 w-4" />
					У этого тома пока нет аудиозаписей глав.
				</div>
			{/if}
		</div>
	{:else}
		<!-- Comments tab (Widget placeholder) -->
		<div class="space-y-6">
			{#if chapters.length > 0 && chapters[chapters.length - 1].telegramPostUrl}
				<div class="bg-card/40 backdrop-blur-sm border border-border/40 rounded-xl p-6 space-y-4">
					<div class="flex items-center gap-2 text-primary">
						<MessageSquare class="h-5 w-5" />
						<h3 class="font-bold">Комментарии из Telegram</h3>
					</div>
					<p class="text-xs text-muted-foreground max-w-md leading-relaxed">
						Обсуждения привязаны к посту последней главы тома в Telegram-канале.
					</p>

					<!-- Render comments placeholder/widget if telegram link exists -->
					<div class="border-t border-border/40 pt-4 text-xs font-mono text-muted-foreground">
						Ссылка на пост: <a
							href={chapters[chapters.length - 1].telegramPostUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary hover:underline"
							>{chapters[chapters.length - 1].telegramPostUrl}</a
						>
					</div>
				</div>
			{:else}
				<div
					class="bg-muted/40 border border-border/20 rounded-xl p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2"
				>
					<MessageSquare class="h-4 w-4" />
					Комментарии в Telegram не настроены для этого тома.
				</div>
			{/if}
		</div>
	{/if}
</div>
