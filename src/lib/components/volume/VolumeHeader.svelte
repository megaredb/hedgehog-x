<script lang="ts">
	import { audioStore } from '$lib/audio-store.svelte';
	import { db, type OfflineVolume, type OfflineChapter, type OfflineBook } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import { useSession } from '$lib/client/session.svelte';
	import { likeService } from '$lib/client/services/likeService';
	import GuestAuthModal from '$lib/components/auth/GuestAuthModal.svelte';
	import ShareModal from '$lib/components/share/ShareModal.svelte';
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
		Sparkles,
		Heart
	} from '@lucide/svelte';
	import { useDownloads } from '$lib/client/downloads/downloadManager.svelte';

	interface Props {
		volume: OfflineVolume | undefined;
		chapters: OfflineChapter[];
		book?: OfflineBook;
		bookId?: string;
		isLoading?: boolean;
	}

	let { volume, chapters, book, bookId, isLoading = false }: Props = $props();

	const session = useSession();
	const manager = useDownloads();

	let isLightboxOpen = $state(false);
	let isGuestModalOpen = $state(false);
	let isShareModalOpen = $state(false);
	let accentColor = $state('59 130 246');

	const targetBookId = $derived(book?.id || bookId || volume?.bookId);
	const liveBookQuery = useDexie(
		() => (targetBookId ? db.books.get(targetBookId) : Promise.resolve(undefined)),
		() => undefined,
		() => targetBookId
	);
	const activeBook = $derived(book ?? liveBookQuery.data);

	const volumeLikeQuery = useDexie(
		() => (volume?.id ? db.volumeLikes.get(volume.id) : Promise.resolve(undefined)),
		() => undefined,
		() => volume?.id
	);
	const isLiked = $derived(!!volumeLikeQuery.data);

	const liveVolumeQuery = useDexie(
		() => (volume?.id ? db.volumes.get(volume.id) : Promise.resolve(undefined)),
		() => undefined,
		() => volume?.id
	);
	const likesCount = $derived(liveVolumeQuery.data?.likesCount ?? volume?.likesCount ?? 0);

	async function handleToggleLike() {
		if (!volume?.id) return;
		if (!session.user) {
			isGuestModalOpen = true;
			return;
		}
		await likeService.toggleVolumeLike(volume.id, likesCount);
	}

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

	function handleShare() {
		isShareModalOpen = true;
	}
</script>

<div
	class="relative mb-8 overflow-hidden rounded-3xl border bg-card p-6 shadow-sm transition-all duration-500 {isPlayingThisVolume
		? 'border-primary/40 shadow-md ring-1 ring-primary/20'
		: 'border-border/60'}"
	style="--vol-accent: {accentColor};"
>
	<!-- Soft radial background glow matching cover accent -->
	<div
		class="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl transition-opacity duration-700"
		style="background: radial-gradient(circle, rgb(var(--vol-accent) / 0.22) 0%, transparent 70%);"
	></div>

	<!-- Iridescent gradient and floating orbs while playing this volume -->
	{#if isPlayingThisVolume}
		<div
			class="volume-iridescent-bg pointer-events-none absolute inset-0 opacity-20 transition-opacity duration-1000 dark:opacity-30"
		></div>

		<div class="pointer-events-none absolute inset-0 overflow-hidden">
			<div
				class="volume-orb volume-orb-1"
				style="background: radial-gradient(circle, rgb(var(--vol-accent) / 0.45) 0%, transparent 70%);"
			></div>
			<div
				class="volume-orb volume-orb-2"
				style="background: radial-gradient(circle, rgba(236, 72, 153, 0.35) 0%, transparent 70%);"
			></div>
			<div
				class="volume-orb volume-orb-3"
				style="background: radial-gradient(circle, rgba(139, 92, 246, 0.35) 0%, transparent 70%);"
			></div>
		</div>
	{/if}

	<div
		class="relative z-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left"
	>
		<!-- Volume cover with animated gradient when playing -->
		<div class="group relative shrink-0">
			<!-- Animated iridescent aura while playing -->
			{#if isPlayingThisVolume}
				<div
					class="absolute -inset-1.5 scale-105 animate-pulse rounded-2xl opacity-90 blur-md transition-transform duration-500"
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
					class="relative cursor-pointer overflow-hidden rounded-2xl shadow-lg transition-transform duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary {isPlayingThisVolume
						? 'scale-105 shadow-xl'
						: 'group-hover:scale-102'}"
					title="Нажмите, чтобы приблизить обложку"
				>
					<img
						src={volume.coverUrl}
						alt={volume.title}
						class="aspect-2/3 w-36 object-cover sm:w-48"
					/>
					<!-- Hover overlay with zoom icon -->
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

					<!-- Playing volume indicator -->
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

		<!-- Volume metadata -->
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

			<!-- Quick action panel -->
			<div class="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
				<!-- Download all / Cancel button -->
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

				<!-- Share button -->
				<Button
					variant="ghost"
					size="sm"
					class="gap-1.5 text-muted-foreground hover:text-foreground"
					onclick={handleShare}
					aria-label="Поделиться томом или таймкодом"
				>
					<Share2 class="h-4 w-4" />
					<span>Поделиться</span>
				</Button>

				<!-- Volume like button -->
				{#if volume}
					<Button
						variant={isLiked ? 'secondary' : 'outline'}
						size="sm"
						class="gap-1.5 shadow-sm transition-colors {isLiked
							? 'border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400'
							: 'text-muted-foreground hover:text-foreground'}"
						onclick={handleToggleLike}
						aria-label={isLiked ? 'Убрать лайк' : 'Поставить лайк'}
						title={isLiked ? 'Убрать лайк' : 'Поставить лайк'}
					>
						<Heart
							class="h-4 w-4 transition-transform active:scale-125 {isLiked
								? 'fill-rose-500 text-rose-500'
								: ''}"
						/>
						<span class="font-medium">{likesCount}</span>
					</Button>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Lightbox modal for enlarged volume cover -->
{#if volume?.coverUrl}
	<ImageLightbox
		bind:open={isLightboxOpen}
		src={volume.coverUrl}
		alt={volume.title}
		caption="{volume.title} • Обложка тома {volume.volumeNumber}"
	/>
{/if}

<!-- Guest authorization modal on like attempt -->
<GuestAuthModal bind:open={isGuestModalOpen} />

<!-- Share modal for volume / chapter timestamp -->
<ShareModal
	bind:open={isShareModalOpen}
	book={activeBook}
	{volume}
	{chapters}
	currentChapterId={audioStore.currentTrack?.volumeId === volume?.id
		? String(audioStore.currentTrack?.id)
		: undefined}
	currentTime={audioStore.currentTrack?.volumeId === volume?.id ? audioStore.currentTime : 0}
/>

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

	@keyframes gradient-shimmer {
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

	@keyframes float-orb {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(25px, -20px) scale(1.1);
		}
	}

	.volume-iridescent-bg {
		background: linear-gradient(
			-45deg,
			rgb(var(--vol-accent) / 0.3),
			rgba(236, 72, 153, 0.25),
			rgba(139, 92, 246, 0.25),
			rgba(59, 130, 246, 0.25),
			rgb(var(--vol-accent) / 0.3)
		);
		background-size: 300% 300%;
		animation: gradient-shimmer 7s ease infinite;
	}

	.volume-orb {
		position: absolute;
		border-radius: 9999px;
		filter: blur(40px);
		will-change: transform;
		pointer-events: none;
	}

	.volume-orb-1 {
		top: -20%;
		right: -10%;
		width: 260px;
		height: 260px;
		animation: float-orb 10s ease-in-out infinite;
	}

	.volume-orb-2 {
		bottom: -20%;
		left: 15%;
		width: 220px;
		height: 220px;
		animation: float-orb 14s ease-in-out infinite reverse;
	}

	.volume-orb-3 {
		top: 25%;
		right: 30%;
		width: 180px;
		height: 180px;
		animation: float-orb 8s ease-in-out infinite 2s;
	}
</style>
