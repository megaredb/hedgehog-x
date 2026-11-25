<script lang="ts">
	import CryptoIcon from '$lib/components/common/CryptoIcon.svelte';
	import type { CryptoCoin } from '$lib/types/site';

	let {
		coins = $bindable<CryptoCoin[]>([]),
		allowed = ['ton', 'eth', 'btc', 'usdt', 'trx', 'xaut'] as CryptoCoin[]
	}: { coins?: CryptoCoin[]; allowed?: CryptoCoin[] } = $props();

	const allOptions = [
		{ type: 'ton' as const, label: 'GRAM' },
		{ type: 'eth' as const, label: 'ETH' },
		{ type: 'btc' as const, label: 'BTC' },
		{ type: 'usdt' as const, label: 'USDT' },
		{ type: 'trx' as const, label: 'TRX' },
		{ type: 'xaut' as const, label: 'XAUT' }
	];
	const options = $derived(allOptions.filter((option) => allowed.includes(option.type)));

	function toggle(type: CryptoCoin) {
		if (coins.includes(type)) {
			if (coins.length === 1) return;
			coins = coins.filter((coin) => coin !== type);
		} else {
			coins = [...coins, type];
		}
	}
</script>

<div class="flex flex-wrap gap-1">
	{#each options as option (option.type)}
		{@const selected = coins.includes(option.type)}
		<button
			type="button"
			class="flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition {selected
				? 'border-primary/40 bg-primary/10 text-foreground'
				: 'border-border/60 bg-background text-muted-foreground hover:bg-muted'}"
			title={option.label}
			aria-label={option.label}
			aria-pressed={selected}
			onclick={() => toggle(option.type)}
		>
			<CryptoIcon symbol={option.type} size={14} />
			{option.label}
		</button>
	{/each}
</div>
