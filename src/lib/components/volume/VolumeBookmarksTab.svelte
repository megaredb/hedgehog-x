<script lang="ts">
	import { audioStore } from '$lib/audio-store.svelte';
	import type { OfflineBook, OfflineBookmark, OfflineChapter, OfflineVolume } from '$lib/client/db';
	import { bookmarkService } from '$lib/client/services/bookmarkService';
	import { Button } from '$lib/components/ui/button';
	import ConfirmModal from '$lib/components/overlay/ConfirmModal.svelte';
	import { formatDuration } from '$lib/utils/time';
	import { Bookmark, BookOpen, Clock, Play, Quote, Trash2 } from '@lucide/svelte';

	interface ChapterAudioVersion {
		chapterId: string;
		versionId: string;
		title: string;
		audioUrl: string;
		durationSeconds: number;
	}

	interface Props {
		bookmarks: OfflineBookmark[];
		chapters: OfflineChapter[];
		volume: OfflineVolume | undefined;
		book?: OfflineBook;
		bookId: string;
		chapterVersions?: ChapterAudioVersion[];
	}

	let { bookmarks, chapters, volume, book, bookId, chapterVersions = [] }: Props = $props();

	let bookmarkToDelete = $state<OfflineBookmark | null>(null);
	let isDeleteModalOpen = $state(false);

	const sortedBookmarks = $derived(
		[...bookmarks].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
	);
	const chapterMap = $derived(new Map(chapters.map((chapter) => [chapter.id, chapter])));

	function formatDate(timestamp: number): string {
		if (!timestamp) return '';
		return new Date(timestamp).toLocaleDateString('ru-RU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function handlePlayBookmark(bookmark: OfflineBookmark) {
		const index = chapters.findIndex((chapter) => chapter.id === bookmark.chapterId);
		if (index === -1) return;
		const versionId = bookmark.versionId ?? 'default';
		const currentVersion =
			typeof audioStore.currentTrack?.versionId === 'string'
				? audioStore.currentTrack.versionId
				: 'default';

		if (audioStore.currentTrack?.id === bookmark.chapterId && currentVersion === versionId) {
			audioStore.setClipRange(bookmark.timestampSeconds, bookmark.endTimestampSeconds);
			audioStore.seek(bookmark.timestampSeconds);
			if (!audioStore.isPlaying) audioStore.play();
			return;
		}

		if (versionId !== 'default') {
			const version = chapterVersions.find(
				(item) => item.chapterId === bookmark.chapterId && item.versionId === versionId
			);
			const chapter = chapters[index];
			if (!version) return;
			audioStore.setQueueAndPlay(
				[
					{
						id: chapter.id,
						title: version.title,
						url: version.audioUrl,
						duration: version.durationSeconds,
						versionId,
						artwork: volume?.coverUrl,
						album: volume?.title,
						artist: book?.title || 'Hedgehog X',
						volumeId: volume?.id,
						bookId,
						startTime: bookmark.timestampSeconds
					}
				],
				0
			);
			audioStore.setClipRange(bookmark.timestampSeconds, bookmark.endTimestampSeconds);
			return;
		}

		const tracks = chapters.map((chapter) => ({
			id: chapter.id,
			url: chapter.audioUrl,
			title: chapter.title,
			duration: chapter.durationSeconds,
			versionId: 'default',
			artwork: volume?.coverUrl,
			album: volume?.title,
			artist: book?.title || 'Hedgehog X',
			volumeId: volume?.id,
			bookId,
			startTime: chapter.id === bookmark.chapterId ? bookmark.timestampSeconds : 0
		}));

		audioStore.setQueueAndPlay(tracks, index);
		audioStore.setClipRange(bookmark.timestampSeconds, bookmark.endTimestampSeconds);
	}

	function openDeleteModal(bookmark: OfflineBookmark) {
		bookmarkToDelete = bookmark;
		isDeleteModalOpen = true;
	}

	async function confirmDelete() {
		if (!bookmarkToDelete) return;
		await bookmarkService.deleteBookmark(bookmarkToDelete.id);
		isDeleteModalOpen = false;
		bookmarkToDelete = null;
	}
</script>

<div
	class="overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm"
>
	{#if sortedBookmarks.length === 0}
		<div class="flex flex-col items-center justify-center px-6 py-14 text-center">
			<div
				class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground"
			>
				<Bookmark class="h-7 w-7" />
			</div>
			<h2 class="text-base font-semibold">В этом томе пока нет закладок</h2>
			<p class="mt-1.5 max-w-md text-sm text-muted-foreground">
				Добавляйте закладки во время прослушивания — они появятся здесь и будут привязаны к этому
				тому.
			</p>
		</div>
	{:else}
		<ul class="divide-y divide-border/40">
			{#each sortedBookmarks as bookmark (bookmark.id)}
				{@const chapter = chapterMap.get(bookmark.chapterId)}
				<li class="p-4 sm:p-5">
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex min-w-0 items-start gap-3">
							{#if volume?.coverUrl}
								<img
									src={volume.coverUrl}
									alt={volume.title}
									width={48}
									height={64}
									loading="lazy"
									class="h-16 w-12 shrink-0 rounded-lg object-cover shadow-sm"
								/>
							{:else}
								<div
									class="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
								>
									<BookOpen class="h-5 w-5" />
								</div>
							{/if}

							<div class="min-w-0 flex-1 space-y-1">
								<div class="flex flex-wrap items-center gap-2">
									<span
										class="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"
									>
										<Clock class="h-3 w-3" />
										<span>
											{formatDuration(bookmark.timestampSeconds)}
											{#if bookmark.endTimestampSeconds}
												– {formatDuration(bookmark.endTimestampSeconds)}
											{/if}
										</span>
									</span>
									{#if bookmark.createdAt}
										<span class="text-xs text-muted-foreground/70">
											{formatDate(bookmark.createdAt)}
										</span>
									{/if}
									<span class="text-xs text-muted-foreground/70">
										{bookmark.versionId === 'default' || !bookmark.versionId
											? 'Новая версия'
											: 'Старая версия'}
									</span>
								</div>

								<h3 class="truncate text-sm font-semibold text-foreground sm:text-base">
									{chapter?.title || 'Глава'}
								</h3>
								<p class="truncate text-xs text-muted-foreground">
									{volume?.title || 'Том'}
								</p>

								{#if bookmark.note}
									<div
										class="mt-1.5 flex items-start gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-foreground/90"
									>
										<Quote class="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
										<span class="line-clamp-2 italic">{bookmark.note}</span>
									</div>
								{/if}
							</div>
						</div>

						<div class="flex shrink-0 items-center justify-end gap-2">
							<Button
								size="sm"
								class="gap-1.5 rounded-xl font-medium"
								onclick={() => handlePlayBookmark(bookmark)}
							>
								<Play class="h-3.5 w-3.5 fill-current" />
								<span>Перейти</span>
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
								onclick={() => openDeleteModal(bookmark)}
								title="Удалить закладку"
								aria-label="Удалить закладку"
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<ConfirmModal
	bind:open={isDeleteModalOpen}
	title="Удалить закладку?"
	description="Закладка будет удалена с этого устройства и синхронизирована с сервером."
	confirmLabel="Удалить"
	onCancel={() => {
		isDeleteModalOpen = false;
		bookmarkToDelete = null;
	}}
	onConfirm={confirmDelete}
/>
