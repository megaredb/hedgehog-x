<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { audioStore } from '$lib/audio-store.svelte';
	import { db, type OfflineVolume } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import type { Track } from '$lib/html-audio.js';
	import { parseShareParams } from '$lib/components/share/share.js';
	import * as Tabs from '$lib/components/ui/tabs';
	import VolumeHeader from '$lib/components/volume/VolumeHeader.svelte';
	import VolumeChaptersTab from '$lib/components/volume/VolumeChaptersTab.svelte';
	import VolumeIllustrationsTab from '$lib/components/volume/VolumeIllustrationsTab.svelte';
	import TelegramComments from '$lib/components/comments/TelegramComments.svelte';
	import VolumeCompletionModal from '$lib/components/volume/VolumeCompletionModal.svelte';
	import { OpenGraphMeta, formatVolumeOgTitle } from '$lib/components/seo';
	import { Headphones, Image as ImageIcon, MessageSquare } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { strings } from '$lib/constants/strings';

	let { data } = $props();

	let activeTab = $state<'chapters' | 'illustrations' | 'comments'>('chapters');
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

	const volume = $derived(volumeQuery.data);
	const chapters = $derived(chaptersQuery.data);
	const book = $derived(bookQuery.data);

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
		if (seekTime > 0) {
			setTimeout(() => {
				audioStore.seek(seekTime, false);
			}, 150);
		}
	});

	// Next volume in this book series
	const nextVolume = $derived.by(() => {
		if (!volume) return null;
		return allBookVolumesQuery.data.find((v) => v.volumeNumber === volume.volumeNumber + 1) || null;
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
	<VolumeHeader {volume} {chapters} {book} bookId={data.bookId} isLoading={volumeQuery.isLoading} />

	<!-- Volume tab navigation: Chapters / Illustrations / Discussion -->
	<Tabs.Root bind:value={activeTab} class="w-full">
		<Tabs.List class="mx-auto mb-6 grid w-full max-w-md grid-cols-3 rounded-xl bg-muted/60 p-1">
			<Tabs.Trigger value="chapters" class="gap-1.5 text-xs sm:text-sm">
				<Headphones class="h-4 w-4" />
				<span>{strings.volume.chaptersTab} ({chapters.length})</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="illustrations" class="gap-1.5 text-xs sm:text-sm">
				<ImageIcon class="h-4 w-4" />
				<span>{strings.volume.illustrationsTab}</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="comments" class="gap-1.5 text-xs sm:text-sm">
				<MessageSquare class="h-4 w-4" />
				<span>{strings.volume.commentsTab}</span>
			</Tabs.Trigger>
		</Tabs.List>

		<!-- Tab 1: Chapters -->
		<Tabs.Content value="chapters" class="outline-none">
			<VolumeChaptersTab
				{volume}
				{chapters}
				bookId={data.bookId}
				isLoading={chaptersQuery.isLoading}
			/>
		</Tabs.Content>

		<!-- Tab 2: Illustrations -->
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
