<script lang="ts">
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import VolumeForm from './VolumeForm.svelte';

	interface Props {
		bookId: string;
		bookTitle: string;
		onClose: () => void;
		onSaved: (volumeId: string) => void;
	}

	let { bookId, bookTitle, onClose, onSaved }: Props = $props();
	let open = $state(true);

	function close() {
		open = false;
		onClose();
	}
</script>

<BaseModal
	bind:open
	title="Новый том"
	description={bookTitle}
	widthClass="sm:max-w-2xl"
	onClose={close}
>
	<div class="max-h-[74vh] overflow-y-auto pr-1">
		<VolumeForm
			{bookId}
			onSaved={(volumeId) => {
				open = false;
				onSaved(volumeId);
			}}
		/>
	</div>
</BaseModal>
