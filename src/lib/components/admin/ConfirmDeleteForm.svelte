<script lang="ts">
	import { enhance } from '$app/forms';
	import { Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import ConfirmModal from '$lib/components/overlay/ConfirmModal.svelte';

	let {
		id,
		title = 'Удалить запись?',
		description = 'Это действие нельзя отменить.',
		action = '?/delete'
	}: { id: string; title?: string; description?: string; action?: string } = $props();

	let open = $state(false);
	let formEl: HTMLFormElement | null = $state(null);

	function confirm() {
		open = false;
		formEl?.requestSubmit();
	}
</script>

<Button
	type="button"
	variant="ghost"
	size="icon"
	class="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
	title="Удалить"
	onclick={() => (open = true)}
>
	<Trash2 class="h-3.5 w-3.5" />
</Button>

<form bind:this={formEl} method="POST" {action} use:enhance class="hidden">
	<input type="hidden" name="id" value={id} />
</form>

<ConfirmModal
	bind:open
	{title}
	{description}
	confirmLabel="Удалить"
	onConfirm={confirm}
	onCancel={() => (open = false)}
/>
