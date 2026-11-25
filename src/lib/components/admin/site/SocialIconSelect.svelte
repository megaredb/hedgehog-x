<script lang="ts">
	import SocialIcon from '$lib/components/common/SocialIcon.svelte';
	import type { SocialIconType } from '$lib/types/site';

	let {
		value = $bindable<SocialIconType>('website'),
		types = ['vk', 'telegram', 'discord', 'boosty', 'website'] as SocialIconType[]
	}: { value?: SocialIconType; types?: SocialIconType[] } = $props();

	const labels: Record<SocialIconType, string> = {
		vk: 'VK',
		telegram: 'Telegram',
		discord: 'Discord',
		boosty: 'Boosty',
		github: 'GitHub',
		website: 'Сайт'
	};
</script>

<div class="flex flex-wrap gap-1">
	{#each types as type (type)}
		<button
			type="button"
			class="flex h-8 w-8 items-center justify-center rounded-lg border transition {value === type
				? 'border-primary/40 bg-primary/10'
				: 'border-border/60 bg-background hover:bg-muted'}"
			title={labels[type]}
			aria-label={labels[type]}
			onclick={() => (value = type)}
		>
			<SocialIcon {type} size={16} />
		</button>
	{/each}
</div>
