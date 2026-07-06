<script lang="ts">
	import { signIn } from '$lib/client/auth';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { LoaderCircle } from '@lucide/svelte';

	let loading = $state(false);

	async function loginWithPasskey() {
		loading = true;
		try {
			await signIn.passkey();
		} catch (e) {
			console.error(e);
		} finally {
			loading = false;
		}
	}

	async function loginWithDiscord() {
		loading = true;
		try {
			await signIn.social({
				provider: 'discord',
				callbackURL: '/'
			});
		} catch (e) {
			console.error(e);
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex items-center justify-center min-h-screen p-4 bg-background">
	<Card.Root class="w-full max-w-sm shadow-lg">
		<Card.Header class="space-y-1">
			<Card.Title class="text-2xl font-bold text-center">Вход</Card.Title>
			<Card.Description class="text-center">Выберите удобный способ авторизации</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<Button
				variant="outline"
				class="w-full font-medium"
				onclick={loginWithPasskey}
				disabled={loading}
			>
				{#if loading}
					<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Войти по Passkey
			</Button>

			<div class="relative">
				<div class="absolute inset-0 flex items-center">
					<span class="w-full border-t border-border"></span>
				</div>
				<div class="relative flex justify-center text-xs uppercase">
					<span class="bg-card px-2 text-muted-foreground">Или</span>
				</div>
			</div>

			<Button
				class="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium"
				onclick={loginWithDiscord}
				disabled={loading}
			>
				{#if loading}
					<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Войти через Discord
			</Button>
		</Card.Content>
	</Card.Root>
</div>
