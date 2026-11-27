<script lang="ts">
	import { QrCode } from '@lucide/svelte';
	import CryptoIcon from '$lib/components/common/CryptoIcon.svelte';
	import {
		CRYPTO_COIN_LABELS,
		CRYPTO_NETWORK_COLORS,
		CRYPTO_NETWORK_LABELS,
		type SiteCryptoWallet
	} from '$lib/types/site';

	let { wallet, class: className = '' }: { wallet: SiteCryptoWallet; class?: string } = $props();

	const palette = $derived(CRYPTO_NETWORK_COLORS[wallet.network]);
</script>

<div
	class="relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl p-4 text-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.12)] sm:p-5 {className}"
	style={`background: ${palette.card}`}
>
	<div class="relative flex items-start justify-between gap-3">
		<div class="flex min-w-0 items-center gap-2.5">
			<CryptoIcon symbol={wallet.network} size={30} kind="network" />
			<div class="min-w-0">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-slate-900/60 uppercase">Сеть</p>
				<p class="mt-0.5 truncate text-xl font-extrabold tracking-tight sm:text-2xl">
					{CRYPTO_NETWORK_LABELS[wallet.network]}
				</p>
			</div>
		</div>
		<span
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-900/15 bg-white/50 text-slate-800 shadow-sm backdrop-blur-sm"
		>
			<QrCode class="h-5 w-5" />
		</span>
	</div>

	<div class="absolute inset-x-4 bottom-4 sm:inset-x-5 sm:bottom-5">
		<p class="text-[10px] font-semibold tracking-[0.16em] text-slate-900/60 uppercase">Кошелёк</p>
		<div class="mt-1.5 flex flex-wrap gap-1">
			{#each wallet.coins as coin (coin)}
				<span
					class="inline-flex items-center gap-1 rounded-md border border-slate-900/15 bg-white/40 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900/80"
				>
					<CryptoIcon symbol={coin} size={11} />
					{CRYPTO_COIN_LABELS[coin]}
				</span>
			{/each}
		</div>
	</div>
</div>
