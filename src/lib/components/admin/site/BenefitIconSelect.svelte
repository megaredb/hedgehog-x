<script lang="ts">
	import { Bell, MessageCircle, Sparkles } from '@lucide/svelte';
	import type { SiteBenefitIcon } from '$lib/types/site';

	let { value = $bindable<SiteBenefitIcon>('sparkles') }: { value?: SiteBenefitIcon } = $props();

	const options = [
		{ type: 'bell' as const, label: 'Уведомления', icon: Bell, color: 'text-amber-500' },
		{ type: 'message' as const, label: 'Общение', icon: MessageCircle, color: 'text-emerald-500' },
		{ type: 'sparkles' as const, label: 'Эксклюзивы', icon: Sparkles, color: 'text-violet-500' }
	];
</script>

<div class="flex flex-wrap gap-1">
	{#each options as option (option.type)}
		{@const Icon = option.icon}
		<button
			type="button"
			class="flex h-8 w-8 items-center justify-center rounded-lg border transition {value ===
			option.type
				? 'border-primary/40 bg-primary/10'
				: 'border-border/60 bg-background hover:bg-muted'}"
			title={option.label}
			aria-label={option.label}
			onclick={() => (value = option.type)}
		>
			<Icon class="h-4 w-4 {option.color}" />
		</button>
	{/each}
</div>
