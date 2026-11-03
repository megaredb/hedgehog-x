<script lang="ts">
	import { Check, Copy, CreditCard, ExternalLink, QrCode, Coins } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';

	const CARD_NUMBER = '4817 7603 3434 7832';
	const TON_ADDRESS = 'UQDoqpcudSDCZGqKWCoLDT008_BNhSKBUao_G5MZR9jcpf-i';

	let copiedCard = $state(false);
	let copiedTon = $state(false);
	let qrModalOpen = $state(false);
	let qrModalType = $state<'bank' | 'ton'>('bank');

	async function copyToClipboard(text: string, type: 'card' | 'ton') {
		try {
			await navigator.clipboard.writeText(text.replace(/\s+/g, ''));
			if (type === 'card') {
				copiedCard = true;
				setTimeout(() => (copiedCard = false), 2000);
			} else {
				copiedTon = true;
				setTimeout(() => (copiedTon = false), 2000);
			}
		} catch {
			// Fallback if clipboard API is restricted
		}
	}

	function openQr(type: 'bank' | 'ton') {
		qrModalType = type;
		qrModalOpen = true;
	}
</script>

<div class="space-y-6">
	<!-- Платформы подписки (Boosty, Lava.top) -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<a
			href="https://boosty.to/hedgehoginc"
			target="_blank"
			rel="noopener noreferrer"
			class="group flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-orange-500/50 hover:bg-orange-500/5 hover:shadow-md"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 font-bold text-orange-600"
				>
					B
				</div>
				<div>
					<p class="font-semibold text-foreground transition-colors group-hover:text-orange-600">
						Boosty
					</p>
					<p class="text-xs text-muted-foreground">Ежемесячная подписка и донаты</p>
				</div>
			</div>
			<ExternalLink
				class="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
			/>
		</a>

		<a
			href="https://app.lava.top/hedgehoginc"
			target="_blank"
			rel="noopener noreferrer"
			class="group flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-violet-500/50 hover:bg-violet-500/5 hover:shadow-md"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 font-bold text-violet-600"
				>
					L
				</div>
				<div>
					<p class="font-semibold text-foreground transition-colors group-hover:text-violet-600">
						Lava.top
					</p>
					<p class="text-xs text-muted-foreground">Подписка картами всего мира</p>
				</div>
			</div>
			<ExternalLink
				class="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
			/>
		</a>
	</div>

	<!-- Банковский перевод и карта -->
	<Card.Root class="overflow-hidden border border-border/60 bg-card/60 shadow-sm">
		<Card.Header class="pb-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<CreditCard class="h-5 w-5 text-primary" />
					<Card.Title class="text-base font-semibold">Перевод по карте</Card.Title>
				</div>
				<Button
					variant="ghost"
					size="sm"
					class="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
					onclick={() => openQr('bank')}
				>
					<QrCode class="h-3.5 w-3.5" />
					<span>QR-код</span>
				</Button>
			</div>
			<Card.Description class="text-xs">
				Банковский перевод. Отсканируйте QR-код или нажмите на него
			</Card.Description>
		</Card.Header>
		<Card.Content class="pt-0">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/50 p-3">
					<span class="font-mono text-base font-medium tracking-wider text-foreground select-all">
						{CARD_NUMBER}
					</span>
				</div>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						class="w-full gap-1.5 sm:w-auto"
						onclick={() => copyToClipboard(CARD_NUMBER, 'card')}
					>
						{#if copiedCard}
							<Check class="h-4 w-4 text-green-600" />
							<span class="text-green-600">Скопировано!</span>
						{:else}
							<Copy class="h-4 w-4" />
							<span>Скопировать карту</span>
						{/if}
					</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Криптовалюта TON -->
	<Card.Root class="overflow-hidden border border-border/60 bg-card/60 shadow-sm">
		<Card.Header class="pb-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Coins class="h-5 w-5 text-sky-500" />
					<Card.Title class="text-base font-semibold">Криптовалюта (Сеть TON)</Card.Title>
				</div>
				<Button
					variant="ghost"
					size="sm"
					class="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
					onclick={() => openQr('ton')}
				>
					<QrCode class="h-3.5 w-3.5" />
					<span>QR-код</span>
				</Button>
			</div>
			<Card.Description class="text-xs">
				Поддерживаются любые кошельки в сети The Open Network (TON, USDT-TON)
			</Card.Description>
		</Card.Header>
		<Card.Content class="pt-0">
			<div class="flex flex-col gap-3">
				<div class="overflow-x-auto rounded-lg border border-border/40 bg-muted/50 p-3">
					<p class="font-mono text-xs break-all text-foreground select-all">
						{TON_ADDRESS}
					</p>
				</div>
				<div class="flex justify-end">
					<Button
						variant="outline"
						size="sm"
						class="w-full gap-1.5 sm:w-auto"
						onclick={() => copyToClipboard(TON_ADDRESS, 'ton')}
					>
						{#if copiedTon}
							<Check class="h-4 w-4 text-green-600" />
							<span class="text-green-600">Скопировано!</span>
						{:else}
							<Copy class="h-4 w-4" />
							<span>Скопировать адрес</span>
						{/if}
					</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- Модальное окно для увеличенного просмотра QR-кода -->
<Dialog.Root bind:open={qrModalOpen}>
	<Dialog.Content class="text-center sm:max-w-xs">
		<Dialog.Header>
			<Dialog.Title>
				{qrModalType === 'bank' ? 'QR-код банковского перевода' : 'QR-код TON'}
			</Dialog.Title>
			<Dialog.Description class="text-xs">
				{qrModalType === 'bank'
					? 'Отсканируйте камерой смартфона или в приложении банка'
					: 'Отсканируйте кошельком Tonkeeper / Telegram Wallet'}
			</Dialog.Description>
		</Dialog.Header>
		<div class="my-4 flex items-center justify-center rounded-xl border bg-white p-4 shadow-inner">
			<img
				src={qrModalType === 'bank' ? '/qr/bank-qr.svg' : '/qr/ton-qr.svg'}
				alt="QR Code"
				class="h-48 w-48 object-contain"
			/>
		</div>
	</Dialog.Content>
</Dialog.Root>
