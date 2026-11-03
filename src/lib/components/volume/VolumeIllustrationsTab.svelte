<script lang="ts">
	import { db, type OfflineIllustration } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import ImageLightbox from '$lib/components/ui/lightbox/ImageLightbox.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Image as ImageIcon, ZoomIn } from '@lucide/svelte';

	interface Props {
		volumeId: string;
	}

	let { volumeId }: Props = $props();

	const illustrationsQuery = useDexie(
		() => db.illustrations.where('volumeId').equals(volumeId).sortBy('sortOrder'),
		() => [] as OfflineIllustration[],
		() => [volumeId]
	);

	let selectedIllustration = $state<OfflineIllustration | null>(null);
	let isLightboxOpen = $state(false);

	function openLightbox(item: OfflineIllustration) {
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
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					role="button"
					tabindex="0"
					onclick={() => openLightbox(ill)}
					class="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				>
					<div class="relative aspect-3/4 w-full overflow-hidden bg-muted">
						<img
							src={ill.imageUrl}
							alt={ill.caption || 'Иллюстрация'}
							class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
							loading="lazy"
						/>
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
					</div>

					{#if ill.caption}
						<div class="p-3">
							<p class="line-clamp-2 text-xs leading-snug font-medium text-foreground">
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
