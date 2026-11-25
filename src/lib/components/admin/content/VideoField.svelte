<script lang="ts">
	import { Expand, FolderOpen, Video, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import MediaLightbox from './MediaLightbox.svelte';
	import R2FilePicker from './R2FilePicker.svelte';
	import type { MediaLibraryFile } from '$lib/server/storage/r2';

	interface Props {
		urlField: string;
		value?: string | null;
		label?: string;
		hint?: string;
	}

	let {
		urlField,
		value = $bindable(null),
		label = 'Видеофон',
		hint = 'WebM или MP4, до 100 МБ'
	}: Props = $props();

	let pickerOpen = $state(false);
	let lightboxOpen = $state(false);
	let selectedUrl = $state(value ?? '');

	$effect(() => {
		const next = value ?? '';
		if (next !== selectedUrl) selectedUrl = next;
	});

	const preview = $derived(selectedUrl);

	function selectFile(file: MediaLibraryFile) {
		selectedUrl = file.url;
		value = file.url;
	}

	function clearSelection() {
		selectedUrl = '';
		value = null;
	}

	function fileLabel(url: string): string {
		if (!url) return '';
		try {
			const parsed = new URL(url, 'http://local');
			return decodeURIComponent(parsed.pathname.split('/').pop() ?? '') || url;
		} catch {
			return url;
		}
	}
</script>

<div class="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3">
	<div class="flex items-start gap-3">
		<div
			class="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-muted/40"
		>
			{#if preview}
				<button
					type="button"
					class="group relative h-full w-full cursor-zoom-in"
					title="Открыть видео"
					onclick={() => (lightboxOpen = true)}
				>
					<video
						src={preview}
						class="h-full w-full object-cover"
						muted
						playsinline
						preload="metadata"
					></video>
					<span
						class="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100"
					>
						<Expand class="h-4 w-4" />
					</span>
				</button>
			{:else}
				<Video class="h-5 w-5 text-muted-foreground" />
			{/if}
		</div>
		<div class="min-w-0 flex-1 space-y-2">
			<Label class="text-xs font-semibold">{label}</Label>
			<div class="flex flex-wrap items-center gap-1.5">
				<Button
					type="button"
					size="sm"
					variant="outline"
					class="gap-1.5"
					onclick={() => (pickerOpen = true)}
				>
					<FolderOpen class="h-3.5 w-3.5" />
					{preview ? 'Заменить в R2' : 'Выбрать в R2'}
				</Button>
				{#if preview}
					<Button
						type="button"
						size="icon-xs"
						variant="ghost"
						title="Убрать видео"
						aria-label="Убрать видео"
						onclick={clearSelection}
					>
						<X class="h-3.5 w-3.5" />
					</Button>
				{/if}
			</div>
			<p class="truncate text-[11px] text-muted-foreground">
				{preview ? fileLabel(preview) : hint || 'Видео выбирается из R2 storage.'}
			</p>
			<input type="hidden" name={urlField} value={selectedUrl} />
		</div>
	</div>
</div>

<MediaLightbox bind:open={lightboxOpen} src={preview || null} title={label} kind="video" />
<R2FilePicker bind:open={pickerOpen} type="video" onSelect={selectFile} />
