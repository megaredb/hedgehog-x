<script lang="ts">
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import BoostyLogin from '$lib/components/auth/BoostyLogin.svelte';

	let {
		open = $bindable(false),
		title,
		description,
		onClose,
		callbackURL = '/'
	}: {
		open?: boolean;
		title?: string;
		description?: string;
		onClose?: () => void;
		callbackURL?: string;
	} = $props();
</script>

<BaseModal bind:open {title} {description} showCloseButton={true} {onClose}>
	<BoostyLogin {callbackURL} />
</BaseModal>
