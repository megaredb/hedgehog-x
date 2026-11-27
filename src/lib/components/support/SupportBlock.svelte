<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { CreditCard, ExternalLink, Wallet } from '@lucide/svelte';
	import BoostyIcon from '$lib/components/ui/brand-icons/BoostyIcon.svelte';
	import TelegramIcon from '$lib/components/ui/brand-icons/TelegramIcon.svelte';
	import TelegramWalletCard from '$lib/components/support/TelegramWalletCard.svelte';
	import CryptoWalletCard from '$lib/components/support/CryptoWalletCard.svelte';
	import SupportCardModal from '$lib/components/support/SupportCardModal.svelte';
	import { strings } from '$lib/constants/strings';
	import {
		CRYPTO_NETWORK_COLORS,
		CRYPTO_NETWORK_LABELS,
		DEFAULT_SUPPORT_SETTINGS,
		type CryptoCoin,
		type SiteSupportSettings
	} from '$lib/types/site';

	let { support = DEFAULT_SUPPORT_SETTINGS }: { support?: SiteSupportSettings } = $props();

	type PaymentData = {
		qrValue: string;
		copyValue: string;
		copyLabel: string;
		title: string;
		hint: string;
		colorFrom: string;
		colorTo: string;
		colorMid?: string;
		colorEnd?: string;
		accent: string;
		flat?: boolean;
		light?: boolean;
		marqueeRepeat?: number;
		coins?: CryptoCoin[];
		centerLogo?: 'gram' | 'network';
		network?: import('$lib/types/site').CryptoNetwork;
	};

	const telegramColors = {
		from: '#0b84ff',
		mid: '#2d9cff',
		end: '#087cf5',
		accent: '#55b7ff'
	};

	let copiedCard = $state<string | null>(null);
	let paymentOpen = $state(false);
	let payment = $state<PaymentData>({
		qrValue: '',
		copyValue: '',
		copyLabel: 'Копировать',
		title: 'QR-код',
		hint: 'Скопируйте значение или сканируйте QR-код.',
		colorFrom: '#0b84ff',
		colorTo: '#087cf5',
		accent: '#55b7ff'
	});

	async function copyCardNumber(number: string) {
		try {
			await navigator.clipboard.writeText(number.replace(/\s+/g, ''));
		} catch {
			// Clipboard may be restricted.
		}
		copiedCard = number;
		setTimeout(() => (copiedCard = null), 2000);
	}

	function openTelegramWallet() {
		if (!support.telegramWalletAddress) return;
		payment = {
			qrValue: support.telegramWalletAddress,
			copyValue: support.telegramWalletAddress,
			copyLabel: 'Копировать адрес',
			title: 'Telegram',
			hint: 'Скопируйте этот адрес или сканируйте QR-код.',
			colorFrom: telegramColors.from,
			colorMid: telegramColors.mid,
			colorEnd: telegramColors.end,
			colorTo: telegramColors.mid,
			accent: telegramColors.accent,
			marqueeRepeat: 2,
			centerLogo: 'gram'
		};
		paymentOpen = true;
	}

	function openWallet(wallet: (typeof support.wallets)[number]) {
		const palette = CRYPTO_NETWORK_COLORS[wallet.network];
		payment = {
			qrValue: wallet.address,
			copyValue: wallet.address,
			copyLabel: 'Копировать адрес',
			title: CRYPTO_NETWORK_LABELS[wallet.network],
			hint: 'Скопируйте адрес или сканируйте QR-код.',
			colorFrom: palette.card,
			colorTo: palette.card,
			accent: palette.accent,
			flat: true,
			light: true,
			marqueeRepeat: 2,
			coins: wallet.coins,
			centerLogo: 'network',
			network: wallet.network
		};
		paymentOpen = true;
	}

	function openBankCard(card: (typeof support.cards)[number]) {
		payment = {
			qrValue: card.payUrl || card.number,
			copyValue: card.number,
			copyLabel: 'Копировать номер карты',
			title: card.label || 'Банковская карта',
			hint: 'Скопируйте номер карты или сканируйте QR-код.',
			colorFrom: card.colorFrom || '#0f172a',
			colorTo: card.colorTo || '#312e81',
			accent: card.colorTo || '#312e81',
			marqueeRepeat: 3
		};
		paymentOpen = true;
	}
</script>

<div class="space-y-10">
	<!-- Subscription platform (Boosty) -->
	{#if support.boostyEnabled && support.boostyUrl}
		<div class="grid grid-cols-1 gap-4">
			<a
				href={support.boostyUrl}
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
							{support.boostyTitle}
						</p>
						<p class="text-xs text-muted-foreground">{support.boostyDescription}</p>
					</div>
				</div>
				<ExternalLink
					class="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
				/>
			</a>
		</div>
	{/if}

	<!-- Telegram and crypto -->
	<div class="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-20">
		{#if support.telegramWalletEnabled && support.telegramWalletAddress}
			<section class="w-full sm:w-80">
				<div class="mb-3 flex items-center gap-2">
					<TelegramIcon class="h-5 w-5 text-sky-500" size={20} />
					<h2 class="text-base font-semibold">Telegram</h2>
				</div>
				<button
					type="button"
					onclick={openTelegramWallet}
					class="group block w-full text-left transition hover:brightness-105"
					aria-label="Открыть Telegram"
				>
					<TelegramWalletCard />
				</button>
			</section>
		{/if}

		{#if support.wallets.filter((wallet) => wallet.enabled && wallet.address).length > 0}
			<section class="w-full sm:w-80">
				<div class="mb-3 flex items-center gap-2">
					<Wallet class="h-5 w-5 text-sky-500" />
					<h2 class="text-base font-semibold">{strings.support.cryptoTitle}</h2>
				</div>
				<div class="space-y-4">
					{#each support.wallets as wallet, walletIndex (`${wallet.network}-${wallet.address}-${walletIndex}`)}
						{#if wallet.enabled && wallet.address}
							<button
								type="button"
								onclick={() => openWallet(wallet)}
								class="block w-full text-left transition hover:brightness-105"
								aria-label="Открыть QR-код кошелька"
							>
								<CryptoWalletCard {wallet} />
							</button>
						{/if}
					{/each}
				</div>
			</section>
		{/if}
	</div>

	<!-- Bank cards -->
	{#if support.cards.filter((card) => card.enabled && (card.number || card.payUrl)).length > 0}
		<div class="space-y-3">
			<div class="flex items-center gap-2">
				<CreditCard class="h-5 w-5 text-primary" />
				<h2 class="text-base font-semibold">{strings.support.cardTransferTitle}</h2>
			</div>
			<div class="flex flex-wrap gap-4">
				{#each support.cards as card, cardIndex (`${card.number}-${card.label}-${card.payUrl}-${cardIndex}`)}
					{#if card.enabled && (card.number || card.payUrl)}
						<div class="w-full sm:w-80">
							<div
								class="relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl p-5 text-white shadow-lg"
								style={`background: linear-gradient(135deg, ${card.colorFrom || '#0f172a'}, ${card.colorTo || '#312e81'})`}
							>
								<button
									type="button"
									class="absolute inset-0 z-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
									onclick={() => openBankCard(card)}
									aria-label={`Открыть QR-код: ${card.label || 'Банковская карта'}`}
								></button>
								<div
									class="pointer-events-none relative z-10 flex items-start justify-between gap-3"
								>
									<span class="text-sm font-extrabold tracking-[0.12em]"
										>{card.brand || 'HEDGEHOG.INC'}</span
									>
									<CreditCard class="h-5 w-5 text-white/60" />
								</div>
								<div class="pointer-events-none absolute inset-x-5 bottom-5 z-10">
									<p class="text-[10px] font-semibold tracking-[0.16em] text-white/65 uppercase">
										{card.label || 'Банковская карта'}
									</p>
									{#if card.number}
										<button
											type="button"
											class="pointer-events-auto relative z-20 mt-1 block max-w-full cursor-pointer truncate text-left font-mono text-[13px] tracking-[0.05em] whitespace-nowrap text-white select-all sm:text-[14px] xl:text-[15px]"
											onclick={() => copyCardNumber(card.number)}
											aria-label="Скопировать номер карты"
										>
											{#if copiedCard === card.number}
												Скопировано
											{:else}
												{card.number}
											{/if}
										</button>
									{:else}
										<p class="mt-1 font-mono text-[13px] text-white">—</p>
									{/if}
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

<SupportCardModal bind:open={paymentOpen} {...payment} />
