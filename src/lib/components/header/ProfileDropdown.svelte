<script lang="ts">
	import { resolve } from '$app/paths';
	import { User, Settings, LogOut } from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import type { Snippet } from 'svelte';

	let {
		onLinkClick = () => {},
		children,
		triggerClass = '',
		align = 'start',
		side = 'bottom'
	}: {
		onLinkClick?: () => void;
		children: Snippet;
		triggerClass?: string;
		align?: 'start' | 'end' | 'center';
		side?: 'top' | 'bottom' | 'left' | 'right';
	} = $props();

	const profileLinks = [
		{ href: resolve('/profile'), icon: User, label: 'Мой аккаунт' },
		{ href: resolve('/settings'), icon: Settings, label: 'Настройки' }
	];
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class={triggerClass}>
		{@render children()}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="w-56" {align} {side}>
		<DropdownMenu.Label>Личный кабинет</DropdownMenu.Label>
		<DropdownMenu.Separator />
		{#each profileLinks as link (link.href)}
			{@const Icon = link.icon}
			<a href={link.href} class="w-full" onclick={onLinkClick}>
				<DropdownMenu.Item class="cursor-pointer">
					<Icon class="h-4 w-4 mr-2" />
					{link.label}
				</DropdownMenu.Item>
			</a>
		{/each}
		<DropdownMenu.Separator />
		<DropdownMenu.Item
			class="text-destructive focus:bg-destructive/10 focus:text-destructive"
			onclick={onLinkClick}
		>
			<LogOut class="h-4 w-4 mr-2" />
			Выйти
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
