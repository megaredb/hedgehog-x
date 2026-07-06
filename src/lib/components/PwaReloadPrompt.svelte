<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { RefreshCw, X } from '@lucide/svelte';
	import { onDestroy } from 'svelte';

	let intervalId: ReturnType<typeof setInterval>;
	let visibilityHandler: () => void;

	const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
		onRegisteredSW(swUrl: string, r: ServiceWorkerRegistration | undefined) {
			console.log('Service Worker registered at:', swUrl);
			if (r) {
				const checkForUpdate = async () => {
					if (r.installing || !navigator) return;
					if ('connection' in navigator && !navigator.onLine) return;
					const resp = await fetch(swUrl, {
						cache: 'no-store',
						headers: {
							cache: 'no-store',
							'cache-control': 'no-cache'
						}
					});
					if (resp?.status === 200) await r.update();
				};

				// Check for updates every 60 seconds
				intervalId = setInterval(checkForUpdate, 60000);

				// Also check when the user returns to the tab
				visibilityHandler = () => {
					if (document.visibilityState === 'visible') {
						checkForUpdate();
					}
				};
				document.addEventListener('visibilitychange', visibilityHandler);
			}
		},
		onRegisterError(error: unknown) {
			console.error('Service Worker registration error:', error);
		}
	});

	function close() {
		$offlineReady = false;
		$needRefresh = false;
	}

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
		if (visibilityHandler && typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', visibilityHandler);
		}
	});
</script>

{#if $needRefresh || $offlineReady}
	<div class="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5">
		<Card.Root class="border-primary/20 bg-background/95 backdrop-blur shadow-xl">
			<Card.Header class="p-4 pb-2 space-y-1">
				<div class="flex items-start justify-between gap-3">
					<Card.Title class="text-sm font-semibold">
						{#if $needRefresh}
							Доступно обновление!
						{:else}
							Приложение готово к оффлайн работе!
						{/if}
					</Card.Title>
					<Button variant="ghost" size="icon" class="h-6 w-6 -mr-1 -mt-1" onclick={close}>
						<X class="h-4 w-4" />
					</Button>
				</div>
				<Card.Description class="text-xs">
					{#if $needRefresh}
						Нажмите «Обновить», чтобы применить изменения.
					{:else}
						Вы можете пользоваться приложением без интернета.
					{/if}
				</Card.Description>
			</Card.Header>

			{#if $needRefresh}
				<Card.Content class="p-4 pt-0">
					<Button
						variant="default"
						size="sm"
						class="w-full flex items-center justify-center gap-1.5"
						onclick={() => updateServiceWorker(true)}
					>
						<RefreshCw class="h-3.5 w-3.5" />
						Обновить
					</Button>
				</Card.Content>
			{/if}
		</Card.Root>
	</div>
{/if}
