<script lang="ts">
	import CryptoIcon from '$lib/components/common/CryptoIcon.svelte';
	import type { CryptoNetwork } from '$lib/types/site';

	let {
		value = $bindable<CryptoNetwork>('ton'),
		onchange
	}: { value?: CryptoNetwork; onchange?: (network: CryptoNetwork) => void } = $props();

	const options = [
		{ type: 'ton' as const, label: 'TON' },
		{ type: 'ethereum' as const, label: 'Ethereum' },
		{ type: 'bitcoin' as const, label: 'Bitcoin' },
		{ type: 'tron' as const, label: 'Tron' }
	];
</script>

<div class="flex flex-wrap gap-1">
	{#each options as option (option.type)}
		<button
			type="button"
			class="flex h-8 w-8 items-center justify-center rounded-lg border transition {value ===
			option.type
				? 'border-primary/40 bg-primary/10'
				: 'border-border/60 bg-background hover:bg-muted'}"
			title={option.label}
			aria-label={option.label}
			onclick={() => {
				value = option.type;
				onchange?.(option.type);
			}}
		>
			<CryptoIcon symbol={option.type} size={16} kind="network" />
		</button>
	{/each}
</div>
