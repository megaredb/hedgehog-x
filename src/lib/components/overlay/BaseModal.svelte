<script lang="ts" module>
	let bodyLockCount = 0;
	let originalOverflow = '';
	let originalPaddingRight = '';

	function lockBodyScroll() {
		if (typeof document === 'undefined') return;
		if (bodyLockCount === 0) {
			const body = document.body;
			const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
			originalOverflow = body.style.overflow;
			originalPaddingRight = body.style.paddingRight;
			body.style.overflow = 'hidden';
			if (scrollbarGap > 0) body.style.paddingRight = scrollbarGap + 'px';
		}
		bodyLockCount += 1;
	}

	function unlockBodyScroll() {
		if (typeof document === 'undefined') return;
		bodyLockCount = Math.max(0, bodyLockCount - 1);
		if (bodyLockCount === 0) {
			document.body.style.overflow = originalOverflow;
			document.body.style.paddingRight = originalPaddingRight;
		}
	}
</script>

<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		open: boolean;
		title?: string;
		description?: string;
		widthClass?: string;
		/** Whether to show close button. Defaults to true. */
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

	$effect(() => {
		if (!isOpen) return;
		lockBodyScroll();
		return () => unlockBodyScroll();
	});
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
