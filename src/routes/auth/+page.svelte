<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Send } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { authClient } from '$lib/client/authClient';
	import { useSession } from '$lib/client/session.svelte';

	const session = useSession();

	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);

	async function signInWithTelegram() {
		if (isSubmitting) return;
		isSubmitting = true;
		errorMessage = null;

		const from = page.url.searchParams.get('from') ?? '/';

		try {
			const result = await authClient.signInWithTelegramOIDC({
				callbackURL: from
			});

			if (result.error) {
				errorMessage = result.error.message || 'Не удалось войти через Telegram';
				isSubmitting = false;
				return;
			}

			// better-auth сам редиректит на страницу авторизации Telegram (oauth.telegram.org)
			const socialSignIn = result.data as { url?: string; redirect?: boolean } | null;
			if (socialSignIn?.url) {
				window.location.href = socialSignIn.url;
				return;
			}

			isSubmitting = false;
		} catch {
			errorMessage = 'Не удалось войти через Telegram';
			isSubmitting = false;
		}
	}

	async function signOut() {
		await authClient.signOut();
		await session.refetch();
		await goto(resolve('/'));
	}
</script>

<div class="flex min-h-full items-center justify-center p-6">
	<div class="w-full max-w-sm space-y-6">
		<div class="space-y-2 text-center">
			<h1 class="text-2xl font-bold tracking-tight">Вход в аккаунт</h1>
			<p class="text-sm text-muted-foreground">
				Войдите через Telegram, чтобы синхронизировать прогресс прослушивания, закладки и загрузки
				между устройствами.
			</p>
		</div>

		{#if session.user}
			<div class="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-5 text-center">
				<div
					class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
				>
					{#if session.user.image}
						<img
							src={session.user.image}
							alt={session.user.name}
							class="h-14 w-14 rounded-full object-cover"
						/>
					{:else}
						<span class="text-lg font-bold">{session.user.name?.charAt(0).toUpperCase()}</span>
					{/if}
				</div>
				<div>
					<p class="font-semibold">{session.user.name}</p>
					<p class="text-xs text-muted-foreground">{session.user.email}</p>
				</div>
				<Button variant="outline" class="w-full" onclick={signOut} disabled={isSubmitting}>
					Выйти
				</Button>
			</div>
		{:else}
			<div class="space-y-3">
				<Button
					class="w-full gap-2 py-3"
					size="lg"
					onclick={signInWithTelegram}
					disabled={isSubmitting}
				>
					<Send class="h-5 w-5" />
					{#if isSubmitting}
						Подключение к Telegram…
					{:else}
						Войти через Telegram
					{/if}
				</Button>

				{#if errorMessage}
					<p class="text-sm text-destructive">{errorMessage}</p>
				{/if}

				<p class="text-center text-xs text-muted-foreground">
					Нажимая «Войти», вы соглашаетесь на передачу имени, username и фото профиля из Telegram.
					Ваш номер телефона остаётся скрытым.
				</p>
			</div>
		{/if}
	</div>
</div>
