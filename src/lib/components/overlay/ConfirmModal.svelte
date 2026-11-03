<script lang="ts">
	import BaseModal from './BaseModal.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		/** Confirm button label */
		confirmLabel?: string;
		/** Cancel button label */
		cancelLabel?: string;
		/** Accent style for cancel button. Defaults to true */
		accentCancel?: boolean;
		/** Confirming loading state */
		confirming?: boolean;
		/** Confirm button disabled state */
		confirmDisabled?: boolean;
		/** Whether to show close button */
		showCloseButton?: boolean;
		onConfirm?: () => void;
		onCancel?: () => void;
		children?: import('svelte').Snippet;
	}

	let {
		open: isOpen = $bindable(),
		title,
		description,
		confirmLabel = 'Подтвердить',
		cancelLabel = 'Отмена',
		accentCancel = true,
		confirming = false,
		confirmDisabled = false,
		showCloseButton = true,
		onConfirm,
		onCancel,
		children
	}: Props = $props();
</script>

<BaseModal open={isOpen} {title} {description} {showCloseButton} onClose={onCancel}>
	{#if children}
		{@render children()}
	{/if}

	{#snippet footer()}
		<Button
			variant={accentCancel ? 'default' : 'outline'}
			data-slot="confirm-cancel"
			disabled={confirming}
			onclick={onCancel}
		>
			{cancelLabel}
		</Button>
		<Button
			variant="outline"
			data-slot="confirm-ok"
			disabled={confirming || confirmDisabled}
			onclick={onConfirm}
		>
			{#if confirming}
				Подождите…
			{:else}
				{confirmLabel}
			{/if}
		</Button>
	{/snippet}
</BaseModal>
