<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Info, LogOut } from '@lucide/svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button } from '$lib/components/ui/button';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import BoostyLoginModal from '$lib/components/auth/BoostyLoginModal.svelte';
	import UserAvatar from '$lib/components/header/UserAvatar.svelte';
	import { authClient } from '$lib/client/authClient';
	import { signOutAndRedirect, useSession } from '$lib/client/session.svelte';
	import { AUTH_PROVIDERS, type AuthProvider } from '$lib/client/providers';
	import { segmentTitle } from '$lib/route-titles';

	const session = useSession();

	let isSubmitting = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let errorModalOpen = $state(false);
	let boostyModalOpen = $state(false);

	const from = $derived.by(() => {
		const raw = page.url.searchParams.get('from');
		// Разрешаем только внутренние относительные пути: начинается с "/",
		// но не с "//" (иначе это protocol-relative внешний URL). Всё остальное
		// (абсолютные URL, javascript: и т.п.) уводим на главную.
		const safe = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : resolve('/');
		// Страница входа — туда возвращаться нельзя (цикл). Уводим на главную.
		if (safe === resolve('/auth')) return resolve('/');
		return safe;
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

<svelte:head>
	<title>{segmentTitle('auth')} — HEDGEHOG.INC</title>
</svelte:head>

<div class="flex min-h-full items-center justify-center p-6">
	<div class="w-full max-w-sm space-y-6">
		<div class="space-y-2 text-center">
			<h1 class="text-2xl font-bold tracking-tight">Вход в аккаунт</h1>
			<p class="text-sm text-muted-foreground">
				Войдите через одну из платформ, чтобы синхронизировать прогресс прослушивания, закладки и
				загрузки между устройствами.
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
					<Tooltip.Root>
						<Tooltip.Trigger
							class="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<Info class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
							О передаче данных при входе
						</Tooltip.Trigger>
						<Tooltip.Content
							side="top"
							sideOffset={8}
							class="flex w-[20rem] max-w-[min(20rem,calc(100vw-1rem))] flex-col items-start gap-2 rounded-lg border border-border/60 bg-popover px-4 py-3 text-left text-sm leading-relaxed text-popover-foreground shadow-lg"
							arrowClasses="bg-popover fill-popover"
						>
							<p class="inline-flex items-center gap-1.5 font-semibold">
								<Info class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
								Передача данных при входе
							</p>
							<p class="text-popover-foreground">
								Входя через платформу, вы соглашаетесь на передачу и хранение в профиле следующих
								данных.
							</p>
							<ul class="space-y-1 text-sm">
								<li>
									<span class="font-medium text-popover-foreground">Telegram</span>
									<span class="text-muted-foreground"> — имя, username и аватар</span>
								</li>
								<li>
									<span class="font-medium text-popover-foreground">Discord</span>
									<span class="text-muted-foreground"> — имя, username и аватар</span>
								</li>
								<li>
									<span class="font-medium text-popover-foreground">Boosty</span>
									<span class="text-muted-foreground"> — имя и аватар</span>
								</li>
							</ul>
							<div class="border-t border-border/60 pt-2">
								<p class="text-xs text-muted-foreground">
									Номер телефона Boosty используется только для входа — мы его не сохраняем.
								</p>
							</div>
						</Tooltip.Content>
					</Tooltip.Root>
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
