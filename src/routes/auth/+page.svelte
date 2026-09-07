<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { LogOut } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import BoostyLoginModal from '$lib/components/auth/BoostyLoginModal.svelte';
	import UserAvatar from '$lib/components/header/UserAvatar.svelte';
	import { authClient } from '$lib/client/authClient';
	import { signOutAndRedirect, useSession } from '$lib/client/session.svelte';
	import { AUTH_PROVIDERS, type AuthProvider } from '$lib/client/providers';

	const session = useSession();

	let isSubmitting = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let errorModalOpen = $state(false);
	let boostyModalOpen = $state(false);

	const from = $derived.by(() => {
		const raw = page.url.searchParams.get('from') ?? resolve('/');
		// Страница входа — туда возвращаться нельзя (цикл). Уводим на главную.
		if (raw === resolve('/auth')) return resolve('/');
		return raw;
	});

	// Если провайдер вернул нас с ошибкой (отмена авторизации, access_denied
	// и т.п.) — показываем модальное окно с сообщением.
	$effect(() => {
		if (session.isPending) return;
		if (session.user) return;
		const params = page.url.searchParams;
		const err = params.get('error') ?? params.get('error_description');
		if (err) {
			errorMessage =
				err === 'access_denied'
					? 'Вы отменили авторизацию. Вход не выполнен.'
					: decodeURIComponent(err).replace(/^[A-Za-z_]+:\s*/, '');
			errorModalOpen = true;
			// Чистим URL от параметров ошибки, чтобы при повторном визите
			// модалка не открывалась снова.
			const url = new URL(window.location.href);
			url.searchParams.delete('error');
			url.searchParams.delete('error_description');
			url.searchParams.delete('provider');
			window.history.replaceState({}, '', url);
		}
	});

	function showError(message: string) {
		errorMessage = message;
		errorModalOpen = true;
	}

	async function startOAuth(provider: AuthProvider) {
		if (isSubmitting) return;
		// Boosty — не OAuth: наш сервер сам вызывает приватный API входа по
		// телефону+SMS (send-code/confirm-code), юзер ничего не вводит кроме
		// телефона и кода.
		if (provider.id === 'boosty') {
			boostyModalOpen = true;
			return;
		}
		isSubmitting = provider.id;
		errorMessage = null;
		try {
			// Лучше-auth сам создаёт состояние и редиректит на страницу провайдера:
			// Telegram -> oauth.telegram.org (OIDC), Discord -> discord.com (OAuth2).
			const result = (await authClient.signIn.social({
				provider: provider.id,
				callbackURL: from
			})) as unknown as {
				data?: { url?: string; redirect?: boolean } | null;
				error?: { message?: string } | null;
			};
			if (result.error) {
				showError(result.error.message || 'Не удалось войти');
				isSubmitting = null;
				return;
			}
			const url = result.data?.url;
			if (url) {
				window.location.href = url;
				return;
			}
			isSubmitting = null;
		} catch {
			showError('Не удалось войти');
			isSubmitting = null;
		}
	}
</script>

<div class="flex min-h-full items-center justify-center p-6">
	<div class="w-full max-w-sm space-y-6">
		<div class="space-y-2 text-center">
			<h1 class="text-2xl font-bold tracking-tight">Вход в аккаунт</h1>
			<p class="text-sm text-muted-foreground">
				Войдите через Telegram или Discord, чтобы синхронизировать прогресс прослушивания, закладки
				и загрузки между устройствами.
			</p>
		</div>

		{#if session.user}
			<div class="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-5 text-center">
				<div class="flex justify-center">
					<UserAvatar user={session.user} size="lg" />
				</div>
				<div>
					<p class="font-semibold">{session.user.name}</p>
				</div>
				<Button variant="outline" class="w-full" onclick={signOutAndRedirect}>
					<LogOut class="h-4 w-4" />
					Выйти
				</Button>
			</div>
			<p class="text-center text-xs text-muted-foreground">
				Управлять способами входа можно на
				<a href={resolve('/profile')} class="underline underline-offset-2 hover:text-foreground"
					>странице профиля</a
				>.
			</p>
		{:else}
			<div class="space-y-3">
				{#each AUTH_PROVIDERS as provider (provider.id)}
					{@const Icon = provider.icon}
					<Button
						size="lg"
						class="w-full gap-2.5 border-0 py-3 text-white shadow-sm transition hover:brightness-110"
						style="background-color: {provider.brandColor};"
						disabled={isSubmitting !== null}
						onclick={() => startOAuth(provider)}
					>
						<Icon class="h-5 w-5 shrink-0" />
						{#if isSubmitting === provider.id}
							Подключение…
						{:else}
							Войти через {provider.label}
						{/if}
					</Button>
				{/each}

				<p class="text-center text-xs text-muted-foreground">
					Входя через Telegram, вы соглашаетесь на передачу имени, username и фото профиля. Входя
					через Discord — на передачу имени и аватара.
				</p>
			</div>
		{/if}
	</div>

	<!-- Модалка об ошибке авторизации -->
	<BaseModal
		bind:open={errorModalOpen}
		title="Не удалось войти"
		description={errorMessage ?? ''}
		showCloseButton={true}
		onClose={() => (errorModalOpen = false)}
	>
		{#snippet footer()}
			<Button variant="outline" class="w-full" onclick={() => (errorModalOpen = false)}>
				Понятно
			</Button>
		{/snippet}
	</BaseModal>

	<!-- Вход через Boosty: телефон + SMS-код -->
	<BoostyLoginModal
		bind:open={boostyModalOpen}
		title="Вход через Boosty"
		description="Войдите по номеру телефона: получите SMS-код и подтвердите — аккаунт привяжется автоматически."
		onClose={() => (boostyModalOpen = false)}
		callbackURL={from}
	/>
</div>
