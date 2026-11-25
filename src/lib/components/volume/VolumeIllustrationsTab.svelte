<script lang="ts">
	import { db, type OfflineIllustration, type OfflineProgress } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import ImageLightbox from '$lib/components/ui/lightbox/ImageLightbox.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import BlurhashImage from '$lib/components/common/BlurhashImage.svelte';
	import { Image as ImageIcon, Lock, ZoomIn } from '@lucide/svelte';
	import { audioStore } from '$lib/audio-store.svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { isBroadcastProgressKey, splitAudioVersionKey } from '$lib/audio-version';
	import { isIllustrationChapterLocked } from '$lib/volume/illustration-lock';

	interface Props {
		volumeId: string;
		timings?: Array<{
			chapterId: string;
			illustrationId: string;
			showAtSeconds: number;
		}>;
		serverProgress?: Array<{
			chapterId: string;
			versionId: string;
			progressSeconds: number;
			isCompleted: boolean | null;
		}>;
	}

	let { volumeId, timings = [], serverProgress = [] }: Props = $props();

	const illustrationsQuery = useDexie(
		() => db.illustrations.where('volumeId').equals(volumeId).sortBy('sortOrder'),
		() => [] as OfflineIllustration[],
		() => [volumeId]
	);

	let selectedIllustration = $state<OfflineIllustration | null>(null);
	let isLightboxOpen = $state(false);

	const progressQuery = useDexie(
		() => db.progress.toArray(),
		() => [] as OfflineProgress[],
		() => []
	);

	const playedChapterIds = $derived.by(() => {
		const played = new SvelteSet<string>();
		for (const saved of serverProgress) {
			if (saved.isCompleted || saved.progressSeconds > 0) played.add(saved.chapterId);
		}
		for (const saved of progressQuery.data) {
			if (saved.broadcastId || isBroadcastProgressKey(saved.chapterId)) continue;
			if (!saved.isCompleted && saved.progressSeconds <= 0) continue;
			played.add(saved.baseChapterId ?? splitAudioVersionKey(saved.chapterId).chapterId);
		}
		const currentChapterId = String(audioStore.currentTrack?.id ?? '');
		if (currentChapterId && (audioStore.currentTime > 0 || audioStore.isPlaying)) {
			played.add(currentChapterId);
		}
		return played;
	});
	const currentTiming = $derived.by(() => {
		const chapterId = String(audioStore.currentTrack?.id ?? '');
		const map = new SvelteMap<string, number>();
		if (!chapterId) return map;
		for (const timing of timings) {
			if (timing.chapterId === chapterId) map.set(timing.illustrationId, timing.showAtSeconds);
		}
		return map;
	});
	function isChapterLocked(item: OfflineIllustration): boolean {
		return isIllustrationChapterLocked(item.id, timings, playedChapterIds);
	}

	function isTimingLocked(item: OfflineIllustration): boolean {
		const showAt = currentTiming.get(item.id);
		return showAt !== undefined && showAt > audioStore.currentTime;
	}

	function isLocked(item: OfflineIllustration): boolean {
		return isChapterLocked(item) || isTimingLocked(item);
	}

	function lockLabel(item: OfflineIllustration): string {
		return isChapterLocked(item) ? 'Сначала прослушайте главу' : 'Откроется по таймингу';
	}

	function openLightbox(item: OfflineIllustration) {
		if (isLocked(item)) return;
		selectedIllustration = item;
		isLightboxOpen = true;
	}
</script>

<div class="py-2">
	{#if illustrationsQuery.isLoading}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
			{#each Array.from({ length: 6 }, (_, k) => k) as idx (idx)}
				<div class="space-y-2">
					<Skeleton class="aspect-3/4 w-full rounded-2xl" />
					<Skeleton class="mx-auto h-4 w-3/4" />
				</div>
			{/each}
		</div>
	{:else if illustrationsQuery.data.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center"
		>
			<ImageIcon class="mb-3 h-10 w-10 text-muted-foreground/60" />
			<h3 class="text-base font-semibold text-foreground">Иллюстраций пока нет</h3>
			<p class="mt-1 max-w-sm text-xs text-muted-foreground">
				Для этого тома ещё не добавлены официальные иллюстрации.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each illustrationsQuery.data as ill (ill.id)}
				<div
					role="button"
					tabindex="0"
					onclick={() => openLightbox(ill)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							openLightbox(ill);
						}
					}}
					class="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary {isLocked(
						ill
					)
						? 'cursor-not-allowed'
						: ''}"
				>
					<div class="relative aspect-3/4 w-full overflow-hidden bg-muted">
						<BlurhashImage
							src={ill.imageUrl}
							blurhash={ill.blurhash}
							alt={ill.caption || 'Иллюстрация'}
							class="absolute inset-0 {isLocked(ill) ? 'blur-xl' : ''}"
							imgClass="transition-transform duration-500 group-hover:scale-105"
							loading="lazy"
						/>
						{#if !isLocked(ill)}
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
						{/if}
						{#if isLocked(ill)}<div class="absolute inset-0 flex items-center justify-center">
								<div
									class="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-medium text-white backdrop-blur-md"
								>
									<Lock class="h-3 w-3" />
									{lockLabel(ill)}
								</div>
							</div>{/if}
					</div>

					{#if ill.caption}
						<div class="p-3">
							<p
								class="line-clamp-2 text-xs leading-snug font-medium text-foreground {isLocked(ill)
									? 'blur-[5px]'
									: ''}"
							>
								{ill.caption}
							</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if selectedIllustration}
	<ImageLightbox
		bind:open={isLightboxOpen}
		src={selectedIllustration.imageUrl}
		alt={selectedIllustration.caption || 'Иллюстрация'}
		caption={selectedIllustration.caption}
	/>
{/if}
