<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { User, Settings, LogOut, LogIn } from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { authClient } from '$lib/client/authClient';
	import { useSession } from '$lib/client/session.svelte';
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

	const session = useSession();

	// Какой путь отдадим в resolve(): страница входа, если мы не на ней,
	// иначе главная. (resolve() зовём в шаблоне, чтобы пройти eslint rule
	// svelte/no-navigation-without-resolve.)
	const authTarget = $derived.by(() => {
		const current = page.url.pathname;
		return current === '/auth' ? '/' : current + page.url.search;
	});

	async function signOut() {
		await authClient.signOut();
		await session.refetch();
		await goto(resolve('/'));
	}
</script>

{#if session.user}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger class={triggerClass}>
			{@render children()}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content class="w-56" {align} {side}>
			<DropdownMenu.Label>Личный кабинет</DropdownMenu.Label>
			<DropdownMenu.Separator />
			{#each [{ href: resolve('/profile'), icon: User, label: 'Мой аккаунт' }, { href: resolve('/settings'), icon: Settings, label: 'Настройки' }] as link (link.href)}
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
				onclick={signOut}
			>
				<LogOut class="h-4 w-4 mr-2" />
				Выйти
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{:else}
	<a href={resolve(`/auth?from=${encodeURIComponent(authTarget)}`)} class={triggerClass}>
		<span class="flex items-center gap-2">
			<LogIn class="h-4 w-4" />
			<span class="text-sm font-medium">Войти</span>
		</span>
	</a>
{/if}
