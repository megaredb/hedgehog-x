<script lang="ts">
	import { Coins } from '@lucide/svelte';
	import GramIcon from '$lib/components/ui/brand-icons/GramIcon.svelte';
	import TonIcon from '$lib/components/ui/brand-icons/TonIcon.svelte';
	import BitcoinIcon from '$lib/components/ui/brand-icons/BitcoinIcon.svelte';
	import EthereumIcon from '$lib/components/ui/brand-icons/EthereumIcon.svelte';
	import TetherIcon from '$lib/components/ui/brand-icons/TetherIcon.svelte';
	import TronIcon from '$lib/components/ui/brand-icons/TronIcon.svelte';
	import XautIcon from '$lib/components/ui/brand-icons/XautIcon.svelte';
	import type { CryptoCoin, CryptoNetwork } from '$lib/types/site';

	type Symbol = CryptoNetwork | CryptoCoin;

	let {
		symbol,
		size = 20,
		class: className = '',
		kind = 'coin'
	}: { symbol: Symbol; size?: number; class?: string; kind?: 'network' | 'coin' } = $props();

	const colors: Record<Symbol, string> = {
		ton: 'text-[#0098EA]',
		ethereum: 'text-[#627EEA]',
		eth: 'text-[#627EEA]',
		bitcoin: 'text-[#F7931A]',
		btc: 'text-[#F7931A]',
		tron: 'text-[#FF060A]',
		trx: 'text-[#FF060A]',
		usdt: 'text-[#26A17B]',
		xaut: 'text-[#D8B35D]'
	};
</script>

<span
	class="inline-flex shrink-0 items-center justify-center {colors[symbol]} {className}"
	title={symbol}
>
	{#if symbol === 'ton'}
		{#if kind === 'network'}
			<TonIcon {size} />
		{:else}
			<GramIcon {size} />
		{/if}
	{:else if symbol === 'bitcoin' || symbol === 'btc'}
		<BitcoinIcon {size} />
	{:else if symbol === 'ethereum' || symbol === 'eth'}
		<EthereumIcon {size} />
	{:else if symbol === 'usdt'}
		<TetherIcon {size} />
	{:else if symbol === 'tron' || symbol === 'trx'}
		<TronIcon {size} />
	{:else if symbol === 'xaut'}
		<XautIcon {size} />
	{:else}
		<Coins {size} />
	{/if}
</span>
