<script lang="ts">
	import { Check, Copy, CreditCard, ExternalLink, QrCode } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import BoostyIcon from '$lib/components/ui/brand-icons/BoostyIcon.svelte';
	import TonIcon from '$lib/components/ui/brand-icons/TonIcon.svelte';
	import { strings } from '$lib/constants/strings';

	const SBER_PAY_URL = 'https://messenger.online.sberbank.ru/sl/2zRK0Js6nn0sbAhuy';
	const CARD_NUMBER = strings.support.cardNumber;
	const TON_ADDRESS = strings.support.cryptoAddress;

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
	<!-- Subscription platform (Boosty) -->
	<div class="grid grid-cols-1 gap-4">
		<a
			href="https://boosty.to/hedgehoginc"
			target="_blank"
			rel="noopener noreferrer"
			class="group flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-orange-500/50 hover:bg-orange-500/5 hover:shadow-md"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600"
				>
					<BoostyIcon size={22} class="text-orange-600" />
				</div>
				<div>
					<p class="font-semibold text-foreground transition-colors group-hover:text-orange-600">
						{strings.support.boostyTitle}
					</p>
					<p class="text-xs text-muted-foreground">{strings.support.boostyDesc}</p>
				</div>
			</div>
			<ExternalLink
				class="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
			/>
		</a>
	</div>

	<!-- Bank transfer & card -->
	<Card.Root class="overflow-hidden border border-border/60 bg-card/60 shadow-sm">
		<Card.Header class="pb-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<CreditCard class="h-5 w-5 text-primary" />
					<Card.Title class="text-base font-semibold"
						>{strings.support.cardTransferTitle}</Card.Title
					>
				</div>
				<Button
					variant="ghost"
					size="sm"
					class="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
					aria-label={strings.support.cardQrAriaLabel}
					onclick={() => openQr('bank')}
				>
					<QrCode class="h-3.5 w-3.5" />
					<span>{strings.support.qrCodeBtn}</span>
				</Button>
			</div>
			<Card.Description class="text-xs">
				{strings.support.bankQrSubtitle}
			</Card.Description>
		</Card.Header>
		<Card.Content class="pt-0">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<!-- Group card number and copy button tightly together -->
				<div
					class="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/50 p-1.5 sm:p-2"
				>
					<span
						class="px-2 font-mono text-sm font-medium tracking-wider text-foreground select-all sm:text-base"
					>
						{CARD_NUMBER}
					</span>
					<Button
						variant="secondary"
						size="sm"
						class="h-8 shrink-0 gap-1.5 text-xs font-medium"
						onclick={() => copyToClipboard(CARD_NUMBER, 'card')}
					>
						{#if copiedCard}
							<Check class="h-3.5 w-3.5 text-green-600" />
							<span class="text-green-600">{strings.support.copied}</span>
						{:else}
							<Copy class="h-3.5 w-3.5" />
							<span>{strings.support.copyCardShort}</span>
						{/if}
					</Button>
				</div>

				<!-- Direct bank pay action -->
				<Button
					href={SBER_PAY_URL}
					target="_blank"
					rel="noopener noreferrer"
					size="sm"
					class="w-full gap-1.5 bg-[#21a038] text-white hover:bg-[#1b842e] sm:w-auto"
				>
					<ExternalLink class="h-4 w-4" />
					<span>{strings.support.sberPayAction}</span>
				</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- TON Crypto -->
	<Card.Root class="overflow-hidden border border-border/60 bg-card/60 shadow-sm">
		<Card.Header class="pb-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<TonIcon size={20} class="text-sky-500" />
					<Card.Title class="text-base font-semibold">{strings.support.cryptoTitle}</Card.Title>
				</div>
				<Button
					variant="ghost"
					size="sm"
					class="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
					aria-label={strings.support.tonQrAriaLabel}
					onclick={() => openQr('ton')}
				>
					<QrCode class="h-3.5 w-3.5" />
					<span>{strings.support.qrCodeBtn}</span>
				</Button>
			</div>
			<Card.Description class="text-xs">
				{strings.support.cryptoSubtitle}
			</Card.Description>
		</Card.Header>
		<Card.Content class="pt-0">
			<div class="flex flex-col gap-3">
				<div
					class="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/50 p-1.5 sm:p-2"
				>
					<p class="px-2 font-mono text-xs break-all text-foreground select-all">
						{TON_ADDRESS}
					</p>
					<Button
						variant="secondary"
						size="sm"
						class="h-8 shrink-0 gap-1.5 text-xs font-medium"
						onclick={() => copyToClipboard(TON_ADDRESS, 'ton')}
					>
						{#if copiedTon}
							<Check class="h-3.5 w-3.5 text-green-600" />
							<span class="text-green-600">{strings.support.copied}</span>
						{:else}
							<Copy class="h-3.5 w-3.5" />
							<span>{strings.support.copyCrypto}</span>
						{/if}
					</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- Modal Dialog for enlarged QR code -->
<Dialog.Root bind:open={qrModalOpen}>
	<Dialog.Content class="text-center sm:max-w-xs">
		<Dialog.Header>
			<Dialog.Title>
				{qrModalType === 'bank'
					? strings.support.qrModalBankTitle
					: strings.support.qrModalTonTitle}
			</Dialog.Title>
			<Dialog.Description class="text-xs">
				{qrModalType === 'bank' ? strings.support.qrModalBankDesc : strings.support.qrModalTonDesc}
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
