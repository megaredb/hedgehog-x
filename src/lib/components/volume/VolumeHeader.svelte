<script lang="ts">
	import { audioStore } from '$lib/audio-store.svelte';
	import type { OfflineVolume, OfflineChapter } from '$lib/client/db';
	import { extractAverageColor } from '$lib/utils/color';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Badge } from '$lib/components/ui/badge';
	import ImageLightbox from '$lib/components/ui/lightbox/ImageLightbox.svelte';
	import {
		Share2,
		Check,
		XCircle,
		Download as DownloadIcon,
		ZoomIn,
		Music,
		Sparkles
	} from '@lucide/svelte';
	import { useDownloads } from '$lib/client/downloads/downloadManager.svelte';

	interface Props {
		volume: OfflineVolume | undefined;
		chapters: OfflineChapter[];
		isLoading?: boolean;
	}

	let { volume, chapters, isLoading = false }: Props = $props();

	const manager = useDownloads();

	let isLightboxOpen = $state(false);
	let accentColor = $state('59 130 246');
	let copiedShare = $state(false);

	const isPlayingThisVolume = $derived(
		audioStore.isPlaying && audioStore.currentTrack?.volumeId === volume?.id
	);

	const isVolumeDownloading = $derived(
		chapters.some((c) => manager.isDownloading(c.id) || manager.isQueued(c.id))
	);
	const isFullyDownloaded = $derived(
		chapters.length > 0 && chapters.every((c) => manager.isDownloaded(c.id))
	);
	const downloadProgress = $derived.by(() => {
		const total = chapters.length;
		const current = chapters.filter((c) => manager.isDownloaded(c.id)).length;
		return { current, total };
	});

	$effect(() => {
		if (volume?.coverUrl) {
			extractAverageColor(volume.coverUrl).then((c) => {
				accentColor = c.rgbString;
			});
		}
	});

	async function handleShare() {
		const shareData = {
			title: volume?.title ? `${volume.title} | Hedgehog X` : 'Hedgehog X',
			text: volume?.description || 'Слушайте аудиокнигу на Hedgehog X',
			url: typeof window !== 'undefined' ? window.location.href : ''
		};

		if (typeof navigator !== 'undefined' && navigator.share) {
			try {
				await navigator.share(shareData);
				return;
			} catch {
				// User cancelled or share failed, fallback to clipboard
			}
		}

		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			await navigator.clipboard.writeText(window.location.href);
			copiedShare = true;
			setTimeout(() => (copiedShare = false), 2000);
		}
	}
</script>

<div
	class="relative mb-8 overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-500"
	style="--vol-accent: {accentColor};"
>
	<!-- Фоновый мягкий градиент от цвета обложки -->
	<div
		class="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl transition-opacity duration-700"
		style="background: radial-gradient(circle, rgb(var(--vol-accent) / 0.22) 0%, transparent 70%);"
	></div>

	<div
		class="relative z-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left"
	>
		<!-- Обложка тома с анимированным градиентом при воспроизведении -->
		<div class="group relative shrink-0">
			<!-- Анимированная переливающаяся аура при воспроизведении -->
			{#if isPlayingThisVolume}
				<div
					class="absolute -inset-1.5 animate-pulse rounded-2xl opacity-90 blur-md transition-all duration-700"
					style="background: linear-gradient(135deg, rgb(var(--vol-accent)), #ec4899, #8b5cf6, rgb(var(--vol-accent))); background-size: 300% 300%; animation: gradient-flow 4s ease infinite, pulse 3s infinite;"
				></div>
			{/if}

			{#if isLoading}
				<Skeleton class="aspect-2/3 w-36 rounded-2xl shadow-md sm:w-48" />
			{:else if volume?.coverUrl}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					role="button"
					tabindex="0"
					onclick={() => (isLightboxOpen = true)}
					class="relative cursor-pointer overflow-hidden rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-102 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					title="Нажмите, чтобы приблизить обложку"
				>
					<img
						src={volume.coverUrl}
						alt={volume.title}
						class="aspect-2/3 w-36 object-cover sm:w-48"
					/>
					<!-- Оверлей при наведении с лупой -->
					<div
						class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					>
						<div
							class="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md"
						>
							<ZoomIn class="h-3.5 w-3.5" />
							<span>Увеличить</span>
						</div>
					</div>

					<!-- Индикатор играющего тома -->
					{#if isPlayingThisVolume}
						<div
							class="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md"
						>
							<Music class="h-3 w-3 animate-bounce text-primary" />
							<span>ИГРАЕТ</span>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Метаданные тома -->
		<div class="flex flex-1 flex-col justify-between">
			<div>
				<div class="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
					<Badge variant="outline" class="text-xs font-semibold">
						Том {volume?.volumeNumber ?? 1}
					</Badge>
					{#if volume?.status === 'completed'}
						<Badge
							variant="secondary"
							class="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-600"
						>
							Завершен
						</Badge>
					{:else}
						<Badge
							variant="secondary"
							class="border-amber-500/20 bg-amber-500/10 text-xs text-amber-600"
						>
							Выходит
						</Badge>
					{/if}
					{#if isPlayingThisVolume}
						<Badge
							variant="secondary"
							class="animate-pulse gap-1 border-primary/20 bg-primary/10 text-xs text-primary"
						>
							<Sparkles class="h-3 w-3" />
							<span>Сейчас играет</span>
						</Badge>
					{/if}
				</div>

				<h1 class="text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-4xl">
					{volume?.title || 'Загрузка...'}
				</h1>

				{#if volume?.description}
					<p class="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
						{volume.description}
					</p>
				{/if}
			</div>

			<!-- Панель быстрых действий -->
			<div class="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
				<!-- Кнопка Скачать все / Отменить -->
				{#if volume}
					{#if isVolumeDownloading}
						<Button
							variant="destructive"
							size="sm"
							class="gap-1.5 shadow-sm"
							onclick={() => manager.cancelVolumeQueue(volume.id)}
						>
							<XCircle class="h-4 w-4" />
							<span>Отменить ({downloadProgress.current}/{downloadProgress.total})</span>
						</Button>
					{:else if isFullyDownloaded}
						<div
							class="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-600"
						>
							<Check class="h-4 w-4" />
							<span>Все главы скачаны</span>
						</div>
					{:else if chapters.length > 0}
						<Button
							variant="outline"
							size="sm"
							class="gap-1.5 shadow-sm"
							onclick={() => manager.enqueueVolume(volume.id, chapters)}
						>
							<DownloadIcon class="h-4 w-4" />
							<span>Скачать весь том ({chapters.length})</span>
						</Button>
					{/if}
				{/if}

				<!-- Кнопка Поделиться -->
				<Button
					variant="ghost"
					size="sm"
					class="gap-1.5 text-muted-foreground hover:text-foreground"
					onclick={handleShare}
				>
					{#if copiedShare}
						<Check class="h-4 w-4 text-green-600" />
						<span class="text-green-600">Ссылка скопирована!</span>
					{:else}
						<Share2 class="h-4 w-4" />
						<span>Поделиться</span>
					{/if}
				</Button>
			</div>
		</div>
	</div>
</div>

<!-- Модальное окно увеличения обложки тома -->
{#if volume?.coverUrl}
	<ImageLightbox
		bind:open={isLightboxOpen}
		src={volume.coverUrl}
		alt={volume.title}
		caption="{volume.title} • Обложка тома {volume.volumeNumber}"
	/>
{/if}

<style>
	@keyframes gradient-flow {
		0% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0% 50%;
		}
	}
</style>
