<script lang="ts">
	import { audioStore } from '$lib/audio-store.svelte';
	import { db } from '$lib/client/db';
	import Download from '$lib/components/audio/Download.svelte';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';

	const chapterQuery = useDexie(
		async () => {
			const id = audioStore.currentTrack?.id;
			if (!id) return undefined;
			return await db.chapters.get(String(id));
		},
		() => undefined,
		() => [audioStore.currentTrack?.id]
	);

	let currentChapter = $derived(
		chapterQuery.data ||
			(audioStore.currentTrack
				? {
						id: String(audioStore.currentTrack.id),
						volumeId: String(audioStore.currentTrack.volumeId ?? ''),
						chapterNumber: 0,
						title: audioStore.currentTrack.title ?? '',
						audioUrl: audioStore.currentTrack.url,
						durationSeconds: audioStore.currentTrack.duration ?? 0,
						likesCount: 0
					}
				: undefined)
	);
</script>

{#if currentChapter}
	<Download chapter={currentChapter} size="icon" variant="outline" />
{/if}
