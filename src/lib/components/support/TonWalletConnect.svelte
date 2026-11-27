<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Check, Copy, LogOut, Loader2, Wallet } from '@lucide/svelte';
	import type { ConnectedWallet, TonConnectUI } from '@tonconnect/ui';

	let { manifestUrl = '' }: { manifestUrl?: string } = $props();

	type Status = 'loading' | 'ready' | 'opening' | 'error';
	let status = $state<Status>('loading');
	let wallet = $state<ConnectedWallet | null>(null);
	let error = $state('');
	let copied = $state(false);
	let tonConnect = $state<TonConnectUI | null>(null);
	let unsubscribe: (() => void) | null = null;

	function manifestCandidates(): string[] {
		const configured = manifestUrl.trim();
		const origin = `${window.location.origin}/tonconnect-manifest.json`;
		const isLocal =
			window.location.hostname === 'localhost' ||
			window.location.hostname === '127.0.0.1' ||
			window.location.hostname === '[::1]';
		const preferConfigured =
			configured.startsWith('https:') && location.protocol === 'http:' && !isLocal;
		return [
			...new Set([
				...(preferConfigured ? [configured] : []),
				origin,
				...(configured ? [configured] : [])
			])
		];
	}

	async function resolveManifestUrl(): Promise<string> {
		const candidates = manifestCandidates();
		for (const candidate of candidates) {
			try {
				const response = await fetch(candidate, { cache: 'no-store' });
				if (!response.ok) continue;
				const manifest = (await response.json()) as { url?: unknown; iconUrl?: unknown };
				if (typeof manifest.url === 'string' && typeof manifest.iconUrl === 'string')
					return candidate;
			} catch {
				// Try the next manifest URL.
			}
		}
		return candidates[0] ?? `${window.location.origin}/tonconnect-manifest.json`;
	}

	function errorText(value: unknown): string {
		const message =
			value instanceof Error
				? value.message
				: typeof value === 'string'
					? value
					: 'Не удалось подключить кошелёк.';
		if (/manifest/i.test(message)) {
			return 'Не удалось загрузить TON Connect manifest. Проверьте, что сайт открыт через HTTPS-прокси Tuna Desktop.';
		}
		return message || 'Не удалось подключить кошелёк.';
	}

	onMount(() => {
		let cancelled = false;
		void (async () => {
			try {
				const { THEME, TonConnectUI: TonConnectUIClass } = await import('@tonconnect/ui');
				if (cancelled) return;
				const client = new TonConnectUIClass({
					manifestUrl: await resolveManifestUrl(),
					language: 'ru',
					analytics: { mode: 'off' },
					uiPreferences: { theme: THEME.DARK }
				});
				if (cancelled) {
					void client.disconnect();
					return;
				}
				tonConnect = client;
				unsubscribe = client.onStatusChange(
					(next) => {
						wallet = next;
						status = 'ready';
					},
					(nextError) => {
						error = errorText(nextError);
						status = 'error';
					}
				);
				await client.connectionRestored;
				if (!cancelled) {
					wallet = client.wallet as ConnectedWallet | null;
					status = 'ready';
				}
			} catch (initError) {
				if (!cancelled) {
					error = errorText(initError);
					status = 'error';
				}
			}
		})();
		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	});

	async function connect() {
		if (!tonConnect) return;
		error = '';
		status = 'opening';
		try {
			if (tonConnect.connected) await tonConnect.disconnect();
			await tonConnect.openModal();
			status = 'ready';
		} catch (connectError) {
			error = errorText(connectError);
			status = 'error';
		}
	}

	async function disconnect() {
		if (!tonConnect) return;
		try {
			await tonConnect.disconnect();
			wallet = null;
		} catch (disconnectError) {
			error = errorText(disconnectError);
		}
	}

	async function copyAddress() {
		if (!wallet?.account.address) return;
		try {
			await navigator.clipboard.writeText(wallet.account.address);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Clipboard access may be unavailable.
		}
	}

	function shortAddress(address: string): string {
		return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
	}

	function networkName(chain: string): string {
		if (chain === '-239') return 'TON Mainnet';
		if (chain === '-3') return 'TON Testnet';
		return chain;
	}
</script>

<div class="rounded-xl border border-border/60 bg-muted/20 p-4">
	<div class="flex items-start gap-3">
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500"
		>
			<Wallet class="h-5 w-5" />
		</div>
		<div class="min-w-0 flex-1">
			<h2 class="text-sm font-semibold">Крипто-кошелёк</h2>
			<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
				{#if wallet}
					Кошелёк подключён. Привязка к аккаунту и платежи пока не выполняются.
				{:else}
					Подключите TON-кошелёк через TON Connect. Это только вход — без привязки к аккаунту и
					оплаты.
				{/if}
			</p>
		</div>
		{#if wallet}
			<span
				class="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
			>
				Подключён
			</span>
		{/if}
	</div>

	{#if wallet}
		<div class="mt-4 rounded-lg border border-border/50 bg-background/60 p-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div class="min-w-0">
					<p class="font-mono text-sm font-semibold">{shortAddress(wallet.account.address)}</p>
					<p class="mt-0.5 text-[11px] text-muted-foreground">
						{wallet.device.appName || 'TON-кошелёк'} · {networkName(wallet.account.chain)}
					</p>
				</div>
				<div class="flex gap-1">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-8 gap-1.5 px-2 text-xs"
						onclick={copyAddress}
					>
						{#if copied}<Check class="h-3.5 w-3.5" />Скопировано{:else}<Copy
								class="h-3.5 w-3.5"
							/>Копировать{/if}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
						onclick={disconnect}
					>
						<LogOut class="h-3.5 w-3.5" />Отключить
					</Button>
				</div>
			</div>
			<Button type="button" variant="outline" size="sm" class="mt-3 w-full" onclick={connect}>
				Сменить кошелёк
			</Button>
		</div>
	{:else}
		<Button
			type="button"
			class="mt-4 w-full gap-2"
			disabled={status === 'loading' || status === 'opening' || !tonConnect}
			onclick={connect}
		>
			{#if status === 'loading' || status === 'opening'}<Loader2
					class="h-4 w-4 animate-spin"
				/>{/if}
			{status === 'loading' ? 'Загрузка TON Connect…' : 'Подключить TON-кошелёк'}
		</Button>
	{/if}

	{#if error}
		<p class="mt-2 text-xs leading-relaxed text-destructive">{error}</p>
	{/if}

	<p class="mt-3 text-[10px] leading-relaxed text-muted-foreground">
		Для подключения с телефона сайт должен быть открыт по HTTPS через Tuna Desktop. При первом
		переходе нажмите «Посетить». На компьютере можно использовать кошелёк в браузере.
	</p>
</div>
