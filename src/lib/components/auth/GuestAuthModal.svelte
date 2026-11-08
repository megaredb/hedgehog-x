<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Heart, LogIn } from '@lucide/svelte';

	interface Props {
		open: boolean;
		title?: string;
		description?: string;
		from?: string;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		title = 'Требуется авторизация',
		description = 'Войдите в аккаунт, чтобы ставить лайки и синхронизировать избранное и историю прослушивания на всех ваших устройствах.',
		from,
		onClose
	}: Props = $props();

	function handleLogin() {
		open = false;
		const redirectPath =
			from || (typeof window !== 'undefined' ? page.url.pathname + page.url.search : resolve('/'));
		goto(resolve(`${resolve('/auth')}?from=${encodeURIComponent(redirectPath)}` as '/'));
	}

	function handleCancel() {
		open = false;
		onClose?.();
	}
</script>

<BaseModal bind:open {title} {description} onClose={handleCancel}>
	<div class="flex flex-col items-center justify-center gap-3 py-4 text-center">
		<div
			class="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 shadow-inner"
		>
			<Heart class="h-7 w-7 fill-rose-500/20 text-rose-500" />
		</div>
		<p class="text-xs text-muted-foreground sm:text-sm">
			Лайки сохраняются в вашем профиле и помогают другим слушателям находить лучшие тома и главы.
		</p>
	</div>

	{#snippet footer()}
		<Button variant="outline" onclick={handleCancel}>Отмена</Button>
		<Button variant="default" class="gap-1.5" onclick={handleLogin}>
			<LogIn class="h-4 w-4" />
			<span>Войти</span>
		</Button>
	{/snippet}
</BaseModal>
