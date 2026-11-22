<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto, replaceState as replaceShallowState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { audioStore } from '$lib/audio-store.svelte';
	import {
		db,
		type OfflineBook,
		type OfflineBookmark,
		type OfflineChapter,
		type OfflineVolume
	} from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import type { Track } from '$lib/html-audio.js';
	import { parseShareParams } from '$lib/components/share/share.js';
	import * as Tabs from '$lib/components/ui/tabs';
	import VolumeHeader from '$lib/components/volume/VolumeHeader.svelte';
	import VolumeChaptersTab from '$lib/components/volume/VolumeChaptersTab.svelte';
	import VolumeIllustrationsTab from '$lib/components/volume/VolumeIllustrationsTab.svelte';
	import VolumeBookmarksTab from '$lib/components/volume/VolumeBookmarksTab.svelte';
	import TelegramComments from '$lib/components/comments/TelegramComments.svelte';
	import VolumeCompletionModal from '$lib/components/volume/VolumeCompletionModal.svelte';
	import { OpenGraphMeta, formatVolumeOgTitle } from '$lib/components/seo';
	import {
		Bookmark as BookmarkIcon,
		Headphones,
		Image as ImageIcon,
		MessageSquare
	} from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { strings } from '$lib/constants/strings';

	let { data } = $props();

	type VolumeTab = 'chapters' | 'bookmarks' | 'illustrations' | 'comments';
	const queryTab = page.url.searchParams.get('tab');
	let activeTab = $state<VolumeTab>(
		queryTab === 'bookmarks' || queryTab === 'illustrations' || queryTab === 'comments'
			? queryTab
			: 'chapters'
	);
	let selectedVersionId = $state(page.url.searchParams.get('version') ?? 'default');
	let isCompletionModalOpen = $state(false);

	const volumeQuery = useDexie(
		() => db.volumes.get(data.volumeId),
		() => undefined,
		() => [data.volumeId]
	);

	const chaptersQuery = useDexie(
		() => db.chapters.where('volumeId').equals(data.volumeId).sortBy('chapterNumber'),
		() => [],
		() => [data.volumeId]
	);

	const allBookVolumesQuery = useDexie(
		() => db.volumes.where('bookId').equals(data.bookId).sortBy('volumeNumber'),
		() => [] as OfflineVolume[],
		() => [data.bookId]
	);

	const bookQuery = useDexie(
		() => db.books.get(data.bookId),
		() => undefined,
		() => [data.bookId]
	);

	const serverData = $derived(
		data as typeof data & {
			book?: OfflineBook;
			volumes?: OfflineVolume[];
			volume?: OfflineVolume;
			chapters?: OfflineChapter[];
		}
	);
	const volume = $derived(volumeQuery.data ?? serverData.volume);
	const chapters = $derived(
		chaptersQuery.data.length > 0 ? chaptersQuery.data : (serverData.chapters ?? [])
	);
	const volumeBookmarksQuery = useDexie(
		() => {
			const chapterIds = chapters.map((chapter) => chapter.id);
			if (chapterIds.length === 0) return Promise.resolve([] as OfflineBookmark[]);
			return db.bookmarks.where('chapterId').anyOf(chapterIds).toArray();
		},
		() => [] as OfflineBookmark[],
		() => chapters.map((chapter) => chapter.id).join('|')
	);
	const book = $derived(bookQuery.data ?? serverData.book);
	const allBookVolumes = $derived(
		allBookVolumesQuery.data.length > 0 ? allBookVolumesQuery.data : (serverData.volumes ?? [])
	);
	const volumeBookmarks = $derived(volumeBookmarksQuery.data);
	const audioVersions = $derived(data.audioVersions ?? []);
	const chapterVersions = $derived(data.chapterVersions ?? []);
	const chapterVersionLikes = $derived(data.chapterVersionLikes ?? []);
	const hasAlternativeVersions = $derived(
		chapterVersions.some((version) => version.versionId !== 'default')
	);
	const versionOptions = $derived([
		{ id: 'default', label: 'Новая версия', description: 'Текущая озвучка' },
		...(hasAlternativeVersions
			? audioVersions
					.filter((version) => version.id !== 'default')
					.map((version) => ({
						id: version.id,
						label: version.id === 'old' ? 'Старая версия' : version.label,
						description: version.description ?? ''
					}))
			: [])
	]);

	function handleVersionChange(versionId: string) {
		if (versionId === selectedVersionId) return;
		selectedVersionId = versionId;
	}

	$effect(() => {
		if (!versionOptions.some((version) => version.id === selectedVersionId)) {
			selectedVersionId = 'default';
		}
	});

	let lastWrittenUrl = $state(page.url.pathname + page.url.search + page.url.hash);

	$effect(() => {
		const current = new URL(window.location.href);
		const next = new URL(current);
		if (activeTab === 'chapters') next.searchParams.delete('tab');
		else next.searchParams.set('tab', activeTab);
		if (selectedVersionId === 'default') next.searchParams.delete('version');
		else next.searchParams.set('version', selectedVersionId);
		const target = next.pathname + next.search + next.hash;
		if (target === lastWrittenUrl) return;
		lastWrittenUrl = target;
		// Tab/version changes are client state. Update the query shallowly instead
		// of running a full SvelteKit navigation and reloading the page data.
		replaceShallowState(target, page.state);
	});

	// Handle deep links from bookmarks/history/downloads: ?chapter=...&version=...
	let handledChapterAnchor = '';
	$effect(() => {
		if (chaptersQuery.isLoading || chapters.length === 0) return;
		const chapterId =
			page.url.searchParams.get('chapter') || page.url.hash.replace(/^#chapter-/, '');
		const versionId = page.url.searchParams.get('version');
		if (!chapterId) return;
		if (versionId && versionOptions.some((version) => version.id === versionId)) {
			selectedVersionId = versionId;
		}
		const key = `${chapterId}:${versionId ?? selectedVersionId}`;
		if (handledChapterAnchor === key) return;
		handledChapterAnchor = key;
		activeTab = 'chapters';
		setTimeout(() => {
			document.getElementById(`chapter-${chapterId}`)?.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});
		}, 100);
	});

	// Handle `?ch={chapterId}&t={seconds}` URL query parameters on initial load
	let handledUrlParamsForVolumeId: string | null = null;

	$effect(() => {
		if (chaptersQuery.isLoading || chapters.length === 0 || !volume) return;
		if (handledUrlParamsForVolumeId === data.volumeId) return;

		const { chapterId, timestamp } = parseShareParams(page.url.searchParams);
		if (!chapterId) return;

		const targetIndex = chapters.findIndex((c) => c.id === chapterId);
		if (targetIndex === -1) return;

		handledUrlParamsForVolumeId = data.volumeId;
		const targetChapter = chapters[targetIndex];
		const seekTime = timestamp && timestamp > 0 ? timestamp : 0;

		const tracks: Track[] = chapters.map((c) => ({
			id: c.id,
			url: c.audioUrl,
			title: c.title,
			duration: c.durationSeconds,
			artwork: volume.coverUrl,
			album: volume.title,
			volumeId: volume.id,
			bookId: data.bookId,
			startTime: c.id === targetChapter.id ? seekTime : 0
		}));

		if (audioStore.currentTrack?.id === targetChapter.id) {
			if (seekTime > 0) {
				audioStore.seek(seekTime, false);
			}
			return;
		}

		audioStore.setQueueAndPlay(tracks, targetIndex);
	});

	// Next volume in this book series
	const nextVolume = $derived.by(() => {
		if (!volume) return null;
		return allBookVolumes.find((v) => v.volumeNumber === volume.volumeNumber + 1) || null;
	});

	// Latest chapter of the volume that has a Telegram discussion post linked
	const latestChapterWithTelegram = $derived.by(() => {
		return (
			chapters
				.slice()
				.reverse()
				.find((c) => !!c.telegramPostUrl) || null
		);
	});

	// Track dismissed volume completions to prevent unwanted popup reappearance
	const dismissedVolumeIds = new SvelteSet<string>();
	let lastTriggeredCompletedAt = 0;

	// Open completion modal ONLY when the last chapter of this volume actively finishes playing
	$effect(() => {
		const completedAt = audioStore.lastCompletedTrackAt;
		if (!completedAt || completedAt <= lastTriggeredCompletedAt) return;
		lastTriggeredCompletedAt = completedAt;

		if (chapters.length === 0) return;
		const lastChapter = chapters[chapters.length - 1];

		if (
			audioStore.lastCompletedTrackId === lastChapter.id &&
			!dismissedVolumeIds.has(data.volumeId)
		) {
			isCompletionModalOpen = true;
		}
	});

	async function handlePlayNextVolume() {
		if (!nextVolume) return;
		dismissedVolumeIds.add(data.volumeId);
		isCompletionModalOpen = false;
		await goto(resolve(`/books/${data.bookId}/${nextVolume.id}`));
	}

	const ogTitle = $derived(formatVolumeOgTitle(volume?.title, book?.title, 'Hedgehog X'));

	const audioOgUrl = $derived.by(() => {
		if (audioStore.currentTrack?.volumeId === volume?.id && audioStore.currentTrack?.url) {
			return audioStore.currentTrack.url;
		}
		return chapters[0]?.audioUrl || null;
	});
</script>

<OpenGraphMeta
	title={ogTitle}
	description={volume?.description || 'Слушайте аудиокнигу онлайн на Hedgehog X'}
	image={volume?.coverUrl}
	type="music.album"
	audio={audioOgUrl}
/>

<main class="layout-content mx-auto max-w-5xl py-4 md:py-8">
	<!-- Volume header -->
	<VolumeHeader
		{volume}
		{chapters}
		{book}
		bookId={data.bookId}
		isLoading={volumeQuery.isLoading}
		{chapterVersions}
	/>

	<!-- Volume tab navigation: Chapters / Illustrations / Discussion -->
	<Tabs.Root bind:value={activeTab} class="w-full">
		<div class="mb-5 flex flex-col gap-2.5 lg:flex-row lg:items-center">
			<Tabs.List
				class="order-1 grid w-full grid-cols-4 gap-0.5 rounded-xl bg-muted/60 p-0.5 sm:gap-1 sm:p-1 lg:order-1 lg:flex-1"
			>
				<Tabs.Trigger
					value="chapters"
					class="w-full min-w-0 justify-center gap-1 px-1 text-[10px] leading-tight sm:gap-1.5 sm:px-2 sm:text-sm"
				>
					<Headphones class="hidden h-4 w-4 shrink-0 sm:block" />
					<span class="truncate">{strings.volume.chaptersTab} ({chapters.length})</span>
				</Tabs.Trigger>
				<Tabs.Trigger
					value="bookmarks"
					class="w-full min-w-0 justify-center gap-1 px-1 text-[10px] leading-tight sm:gap-1.5 sm:px-2 sm:text-sm"
				>
					<BookmarkIcon class="hidden h-4 w-4 shrink-0 sm:block" />
					<span class="truncate">{strings.volume.bookmarksTab} ({volumeBookmarks.length})</span>
				</Tabs.Trigger>
				<Tabs.Trigger
					value="illustrations"
					class="w-full min-w-0 justify-center gap-1 px-1 text-[10px] leading-tight sm:gap-1.5 sm:px-2 sm:text-sm"
				>
					<ImageIcon class="hidden h-4 w-4 shrink-0 sm:block" />
					<span class="truncate">{strings.volume.illustrationsTab}</span>
				</Tabs.Trigger>
				<Tabs.Trigger
					value="comments"
					class="w-full min-w-0 justify-center gap-1 px-1 text-[10px] leading-tight sm:gap-1.5 sm:px-2 sm:text-sm"
				>
					<MessageSquare class="hidden h-4 w-4 shrink-0 sm:block" />
					<span class="truncate">{strings.volume.commentsTab}</span>
				</Tabs.Trigger>
			</Tabs.List>

			{#if versionOptions.length > 1}
				<div
					class="order-2 flex w-full items-center gap-1 rounded-xl border border-border/60 bg-card/60 p-1 lg:order-2 lg:w-auto lg:shrink-0"
					role="radiogroup"
					aria-label="Версия озвучки"
				>
					{#each versionOptions as version (version.id)}
						<button
							type="button"
							role="radio"
							aria-checked={selectedVersionId === version.id}
							class="h-8 flex-1 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden lg:flex-none {selectedVersionId ===
							version.id
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
							onclick={() => handleVersionChange(version.id)}
							title={version.description}
						>
							{version.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Tab 1: Chapters -->
		<Tabs.Content value="chapters" class="outline-none">
			<VolumeChaptersTab
				{volume}
				{chapters}
				bookId={data.bookId}
				isLoading={chaptersQuery.isLoading}
				{selectedVersionId}
				{chapterVersions}
				{chapterVersionLikes}
			/>
		</Tabs.Content>

		<!-- Tab 2: Bookmarks -->
		<Tabs.Content value="bookmarks" class="outline-none">
			<VolumeBookmarksTab
				bookmarks={volumeBookmarks}
				{chapters}
				{volume}
				{book}
				bookId={data.bookId}
				{chapterVersions}
			/>
		</Tabs.Content>

		<!-- Tab 3: Illustrations -->
		<Tabs.Content value="illustrations" class="outline-none">
			<VolumeIllustrationsTab volumeId={data.volumeId} />
		</Tabs.Content>

		<!-- Tab 3: Volume Discussion -->
		<Tabs.Content value="comments" class="outline-none">
			<div class="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
				<div class="mb-4 flex items-center justify-between">
					<div>
						<h2 class="text-lg font-bold text-foreground">{strings.volume.discussionTitle}</h2>
						{#if latestChapterWithTelegram}
							<p class="text-xs text-muted-foreground">
								{strings.volume.discussionSubtitle(
									latestChapterWithTelegram.chapterNumber,
									latestChapterWithTelegram.title
								)}
							</p>
						{/if}
					</div>
				</div>
				<TelegramComments discussion={latestChapterWithTelegram?.telegramPostUrl} />
			</div>
		</Tabs.Content>
	</Tabs.Root>
</main>

<!-- Volume completion modal -->
<VolumeCompletionModal
	bind:open={isCompletionModalOpen}
	currentVolume={volume}
	{nextVolume}
	onPlayNextVolume={handlePlayNextVolume}
/>
