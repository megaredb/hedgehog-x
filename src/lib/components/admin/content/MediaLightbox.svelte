<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		open?: boolean;
		src: string | null;
		title?: string;
		kind?: 'image' | 'video';
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		src,
		title = 'Просмотр',
		kind = 'image',
		onClose
	}: Props = $props();
</script>

<BaseModal
	bind:open
	{title}
	widthClass="sm:max-w-5xl"
	onClose={() => {
		open = false;
		onClose?.();
	}}
>
	{#if src}
		<div
			class="flex min-h-40 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-black/40"
		>
			{#if kind === 'video'}
				<video {src} class="max-h-[75vh] w-full object-contain" controls autoplay playsinline>
					<track kind="captions" />
				</video>
			{:else}
				<img {src} alt={title} class="max-h-[75vh] w-full object-contain" />
			{/if}
		</div>
	{:else}
		<p class="py-10 text-center text-sm text-muted-foreground">Нет файла для просмотра.</p>
	{/if}
	{#snippet footer()}
		{#if src}
			<Button href={src} target="_blank" rel="noreferrer" variant="outline" class="gap-1.5">
				<ExternalLink class="h-3.5 w-3.5" />
				Открыть оригинал
			</Button>
		{/if}
		<Button variant="ghost" onclick={() => (open = false)}>Закрыть</Button>
	{/snippet}
</BaseModal>
