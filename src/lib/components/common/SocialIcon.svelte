<script lang="ts">
	import { Globe } from '@lucide/svelte';
	import VkIcon from '$lib/components/ui/brand-icons/VkIcon.svelte';
	import TelegramIcon from '$lib/components/ui/brand-icons/TelegramIcon.svelte';
	import DiscordIcon from '$lib/components/ui/brand-icons/DiscordIcon.svelte';
	import BoostyIcon from '$lib/components/ui/brand-icons/BoostyIcon.svelte';
	import GithubIcon from '$lib/components/ui/brand-icons/GithubIcon.svelte';
	import type { SocialIconType } from '$lib/types/site';

	let {
		type,
		size = 20,
		class: className = ''
	}: { type: SocialIconType; size?: number; class?: string } = $props();

	const colors: Record<SocialIconType, string> = {
		vk: 'text-[#0077FF]',
		telegram: 'text-[#26A5E4]',
		discord: 'text-[#5865F2]',
		boosty: 'text-[#F15F2C]',
		github: 'text-foreground',
		website: 'text-emerald-500'
	};
</script>

<span
	class="inline-flex shrink-0 items-center justify-center {colors[type]} {className}"
	title={type}
>
	{#if type === 'vk'}
		<VkIcon {size} />
	{:else if type === 'telegram'}
		<TelegramIcon {size} />
	{:else if type === 'discord'}
		<DiscordIcon {size} />
	{:else if type === 'boosty'}
		<BoostyIcon {size} />
	{:else if type === 'github'}
		<GithubIcon {size} />
	{:else}
		<Globe {size} />
	{/if}
</span>
