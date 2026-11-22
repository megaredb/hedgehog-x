<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import ConfirmModal from '$lib/components/overlay/ConfirmModal.svelte';

	interface Props {
		id: string;
		title?: string;
		description?: string;
		action?: string;
		buttonLabel?: string;
		text?: string;
		onDeleted?: () => void;
		onError?: (message: string) => void;
	}

	let {
		id,
		title = 'Удалить запись?',
		description = 'Это действие нельзя отменить.',
		action = '?/delete',
		buttonLabel = 'Удалить',
		text = '',
		onDeleted,
		onError
	}: Props = $props();

	let open = $state(false);
	let pending = $state(false);
	let formEl: HTMLFormElement | null = $state(null);

	const submit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			if (result.type === 'success') {
				open = false;
				await update({ reset: false });
				onDeleted?.();
			} else if (result.type === 'failure') {
				const data = result.data as { error?: string } | undefined;
				onError?.(data?.error ?? 'Не удалось удалить запись');
				await update({ reset: false });
			} else {
				onError?.('Ошибка сервера при удалении');
			}
		};
	};

	function confirm() {
		if (pending) return;
		formEl?.requestSubmit();
	}
</script>

{#if text}
	<Button
		type="button"
		variant="destructive"
		size="sm"
		class="gap-1.5"
		onclick={() => (open = true)}
	>
		<Trash2 class="h-3.5 w-3.5" />
		{text}
	</Button>
{:else}
	<Button
		type="button"
		variant="ghost"
		size="icon-sm"
		class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
		title="Удалить"
		aria-label="Удалить"
		onclick={() => (open = true)}
	>
		<Trash2 class="h-3.5 w-3.5" />
	</Button>
{/if}

<form bind:this={formEl} method="POST" {action} use:enhance={submit} class="hidden">
	<input type="hidden" name="id" value={id} />
</form>

<ConfirmModal
	bind:open
	{title}
	{description}
	confirmLabel={buttonLabel}
	confirming={pending}
	onConfirm={confirm}
	onCancel={() => (open = false)}
/>
