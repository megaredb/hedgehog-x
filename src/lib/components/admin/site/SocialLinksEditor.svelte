<script lang="ts">
	import { X } from '@lucide/svelte';
	import SocialIcon from '$lib/components/common/SocialIcon.svelte';
	import type { SiteSocialLink, SocialIconType } from '$lib/types/site';
	import { toggleSocialLink } from '$lib/utils/social-links';

	let {
		links = $bindable<SiteSocialLink[]>([]),
		includeGithub = false
	}: { links?: SiteSocialLink[]; includeGithub?: boolean } = $props();

	const types = $derived<SocialIconType[]>(
		includeGithub
			? ['github', 'vk', 'telegram', 'discord', 'website']
			: ['vk', 'telegram', 'discord', 'website']
	);

	const labels: Record<SocialIconType, string> = {
		vk: 'VK',
		telegram: 'Telegram',
		discord: 'Discord',
		boosty: 'Boosty',
		github: 'GitHub',
		website: 'Сайт'
	};

	function toggle(type: SocialIconType) {
		links = toggleSocialLink(links, type);
	}
	function remove(index: number) {
		links = links.filter((_, i) => i !== index);
	}
</script>

<div class="space-y-2">
	<div class="flex flex-wrap gap-1.5">
		{#each types as type (type)}
			{@const link = links.find((item) => item.type === type)}
			{@const selected = Boolean(link)}
			{@const active = selected && link?.enabled !== false}
			<button
				type="button"
				class="flex h-8 w-8 items-center justify-center rounded-lg border transition {active
					? 'border-primary/40 bg-primary/10'
					: selected
						? 'border-amber-500/40 bg-amber-500/10'
						: 'border-border/60 bg-background hover:bg-muted'}"
				title={selected
					? link?.url.trim()
						? active
							? 'Отключить ' + labels[type]
							: 'Включить ' + labels[type]
						: 'Убрать ' + labels[type]
					: 'Добавить ' + labels[type]}
				aria-label={selected
					? link?.url.trim()
						? active
							? 'Отключить ' + labels[type]
							: 'Включить ' + labels[type]
						: 'Убрать ' + labels[type]
					: 'Добавить ' + labels[type]}
				aria-pressed={selected}
				onclick={() => toggle(type)}
			>
				<SocialIcon {type} size={16} class={active ? '' : 'opacity-45'} />
			</button>
		{/each}
	</div>

	{#each links as link, index (link.type)}
		<div class="flex items-center gap-2 {link.enabled === false ? 'opacity-55' : ''}">
			<SocialIcon type={link.type} size={16} class="h-8 w-8 rounded-lg bg-muted/40" />
			<input
				bind:value={link.url}
				placeholder={'Ссылка ' + labels[link.type]}
				maxlength="1024"
				class="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-primary"
			/>
			<button
				type="button"
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
				aria-label={'Удалить ' + labels[link.type]}
				title={'Удалить ' + labels[link.type]}
				onclick={() => remove(index)}
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	{/each}
</div>
