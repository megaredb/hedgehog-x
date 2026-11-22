<script lang="ts">
	import { Video } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	interface Props {
		fileField: string;
		urlField: string;
		value?: string | null;
		label?: string;
		hint?: string;
	}

	let {
		fileField,
		urlField,
		value = null,
		label = 'Видеофон',
		hint = 'WebM или MP4, до 100 МБ'
	}: Props = $props();

	let objectUrl = $state<string | null>(null);
	let fileName = $state('');
	let preview = $derived(objectUrl ?? value ?? '');

	$effect(() => {
		const url = objectUrl;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	function formatBytes(bytes: number): string {
		if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
		const megabytes = bytes / (1024 * 1024);
		if (megabytes >= 1) return megabytes.toFixed(megabytes >= 10 ? 0 : 1) + ' МБ';
		return Math.max(1, Math.round(bytes / 1024)) + ' КБ';
	}

	function handleFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		if (file) {
			objectUrl = URL.createObjectURL(file);
			fileName = file.name + ' · ' + formatBytes(file.size);
		} else {
			objectUrl = null;
			fileName = '';
		}
	}
</script>

<div class="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3">
	<div class="flex items-start gap-3">
		<div
			class="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-muted/40"
		>
			{#if preview}
				<video
					src={preview}
					class="h-full w-full object-cover"
					muted
					playsinline
					controls
					preload="metadata"
				></video>
			{:else}
				<Video class="h-5 w-5 text-muted-foreground" />
			{/if}
		</div>
		<div class="min-w-0 flex-1 space-y-2">
			<Label class="text-xs font-semibold">{label}</Label>
			<input
				name={fileField}
				type="file"
				accept="video/webm,video/mp4,video/quicktime"
				class="block w-full cursor-pointer text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
				onchange={handleFile}
			/>
			<p class="text-[11px] text-muted-foreground">
				{fileName || hint}
			</p>
		</div>
	</div>

	<div class="space-y-1">
		<Label class="text-[11px] text-muted-foreground">Или прямой URL</Label>
		<Input name={urlField} value={value ?? ''} placeholder="https://..." class="h-8 text-xs" />
	</div>
</div>
