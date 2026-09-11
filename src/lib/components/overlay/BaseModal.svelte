<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		open: boolean;
		title?: string;
		description?: string;
		widthClass?: string;
		/** Показывать ли «крестик» закрытия. По умолчанию true. */
		showCloseButton?: boolean;
		onClose?: () => void;
		children?: import('svelte').Snippet;
		header?: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	}

	let {
		open: isOpen = $bindable(),
		title,
		description,
		widthClass = 'sm:max-w-md',
		showCloseButton = true,
		onClose,
		children,
		header,
		footer
	}: Props = $props();
</script>

<Dialog.Root
	bind:open={isOpen}
	onOpenChange={(o) => {
		if (!o) onClose?.();
	}}
>
	<Dialog.Content
		data-slot="modal"
		class={cn('w-full min-w-0 overflow-hidden break-words', widthClass)}
		{showCloseButton}
	>
		{#if header}
			{@render header()}
		{:else if title}
			<Dialog.Header class="min-w-0">
				<Dialog.Title class="break-words">{title}</Dialog.Title>
				{#if description}
					<Dialog.Description class="break-words">{description}</Dialog.Description>
				{/if}
			</Dialog.Header>
		{/if}

		{#if children}
			<div class="modal-body min-w-0">{@render children()}</div>
		{/if}

		{#if footer}
			<Dialog.Footer class="min-w-0 gap-2">{@render footer()}</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
