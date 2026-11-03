<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { audioStore } from '$lib/audio-store.svelte';
	import { db, type OfflineVolume } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import VolumeHeader from '$lib/components/volume/VolumeHeader.svelte';
	import VolumeChaptersTab from '$lib/components/volume/VolumeChaptersTab.svelte';
	import VolumeIllustrationsTab from '$lib/components/volume/VolumeIllustrationsTab.svelte';
	import TelegramComments from '$lib/components/comments/TelegramComments.svelte';
	import VolumeCompletionModal from '$lib/components/volume/VolumeCompletionModal.svelte';
	import { Headphones, Image as ImageIcon, MessageSquare } from '@lucide/svelte';

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

	const volume = $derived(volumeQuery.data);
	const chapters = $derived(chaptersQuery.data);

	// Следующий том в этой книге
	const nextVolume = $derived.by(() => {
		if (!volume) return null;
		return allBookVolumesQuery.data.find((v) => v.volumeNumber === volume.volumeNumber + 1) || null;
	});

	// Последняя глава тома с привязанным Telegram-постом
	const latestChapterWithTelegram = $derived.by(() => {
		return (
			chapters
				.slice()
				.reverse()
				.find((c) => !!c.telegramPostUrl) || null
		);
	});

	// Проверяем, играет ли последняя глава этого тома и завершилась ли она
	$effect(() => {
		if (chapters.length === 0) return;
		const lastChapter = chapters[chapters.length - 1];

		// Если текущий трек — последняя глава, и он только что завершился (время подошло к концу)
		if (
			audioStore.currentTrack?.id === lastChapter.id &&
			audioStore.duration > 0 &&
			audioStore.currentTime >= audioStore.duration - 1 &&
			!audioStore.isPlaying
		) {
			isCompletionModalOpen = true;
		}
	});

	async function handlePlayNextVolume() {
		if (!nextVolume) return;
		isCompletionModalOpen = false;
		await goto(resolve(`/books/${data.bookId}/${nextVolume.id}`));
	}
</script>

<svelte:head>
	<title>{volume?.title || 'Том'} | Аудиокнига | Hedgehog X</title>
	<meta name="description" content={volume?.description || 'Слушайте аудиокнигу на Hedgehog X'} />

	<!-- OpenGraph мета-теги -->
	<meta property="og:title" content="{volume?.title || 'Аудиокнига'} | Hedgehog X" />
	<meta
		property="og:description"
		content={volume?.description || 'Слушайте аудиокнигу онлайн на Hedgehog X'}
	/>
	<meta property="og:image" content={volume?.coverUrl || '/logo.webp'} />
	<meta property="og:type" content="music.album" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main class="layout-content mx-auto max-w-5xl py-4 md:py-8">
	<!-- Вынесенная шапка тома -->
	<VolumeHeader {volume} {chapters} isLoading={volumeQuery.isLoading} />

	<!-- Навигация по табам тома: Главы / Иллюстрации / Обсуждение -->
	<Tabs.Root bind:value={activeTab} class="w-full">
		<Tabs.List class="mx-auto mb-6 grid w-full max-w-md grid-cols-3 rounded-xl bg-muted/60 p-1">
			<Tabs.Trigger value="chapters" class="gap-1.5 text-xs sm:text-sm">
				<Headphones class="h-4 w-4" />
				<span>Главы ({chapters.length})</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="illustrations" class="gap-1.5 text-xs sm:text-sm">
				<ImageIcon class="h-4 w-4" />
				<span>Иллюстрации</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="comments" class="gap-1.5 text-xs sm:text-sm">
				<MessageSquare class="h-4 w-4" />
				<span>Обсуждение</span>
			</Tabs.Trigger>
		</Tabs.List>

		<!-- Вкладка 1: Главы -->
		<Tabs.Content value="chapters" class="outline-none">
			<VolumeChaptersTab
				{volume}
				{chapters}
				bookId={data.bookId}
				isLoading={chaptersQuery.isLoading}
			/>
		</Tabs.Content>

		<!-- Вкладка 2: Иллюстрации -->
		<Tabs.Content value="illustrations" class="outline-none">
			<VolumeIllustrationsTab volumeId={data.volumeId} />
		</Tabs.Content>

		<!-- Вкладка 3: Обсуждение тома (по последней главе) -->
		<Tabs.Content value="comments" class="outline-none">
			<div class="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
				<div class="mb-4 flex items-center justify-between">
					<div>
						<h2 class="text-lg font-bold text-foreground">Обсуждение тома</h2>
						{#if latestChapterWithTelegram}
							<p class="text-xs text-muted-foreground">
								Комментарии последней выпущенной главы ({latestChapterWithTelegram.chapterNumber}: {latestChapterWithTelegram.title})
							</p>
						{/if}
					</div>
				</div>
				<TelegramComments discussion={latestChapterWithTelegram?.telegramPostUrl} />
			</div>
		</Tabs.Content>
	</Tabs.Root>
</main>

<!-- Плашка завершения тома -->
<VolumeCompletionModal
	bind:open={isCompletionModalOpen}
	currentVolume={volume}
	{nextVolume}
	onPlayNextVolume={handlePlayNextVolume}
/>
