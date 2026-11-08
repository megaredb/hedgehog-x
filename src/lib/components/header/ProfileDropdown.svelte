<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { User, Settings, LogOut, LogIn } from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { useSession } from '$lib/client/session.svelte';
	import { strings } from '$lib/constants/strings';
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

	// Return path for auth: current page unless on /auth, otherwise home
	const authTarget = $derived.by(() => {
		const current = page.url.pathname;
		return current === '/auth' ? '/' : current + page.url.search;
	});

	async function signOut() {
		await session.signOut();
		await goto(resolve('/'));
	}
</script>

{#if session.user}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger class={triggerClass}>
			{@render children()}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content class="w-56" {align} {side}>
			<DropdownMenu.Label>{strings.nav.profile}</DropdownMenu.Label>
			<DropdownMenu.Separator />
			{#each [{ href: resolve('/profile'), icon: User, label: strings.nav.profile }, { href: resolve('/settings'), icon: Settings, label: strings.nav.settings }] as link (link.href)}
				{@const Icon = link.icon}
				<a href={resolve(link.href as '/')} class="w-full" onclick={onLinkClick}>
					<DropdownMenu.Item class="cursor-pointer">
						<Icon class="mr-2 h-4 w-4" />
						{link.label}
					</DropdownMenu.Item>
				</a>
			{/each}
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				class="text-destructive focus:bg-destructive/10 focus:text-destructive"
				onclick={signOut}
			>
				<LogOut class="mr-2 h-4 w-4" />
				{strings.common.signOut}
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{:else}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger class={triggerClass}>
			{@render children()}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content class="w-56" {align} {side}>
			<DropdownMenu.Label>{strings.common.guest}</DropdownMenu.Label>
			<DropdownMenu.Separator />
			<a
				href={resolve(`${resolve('/auth')}?from=${encodeURIComponent(authTarget)}` as '/')}
				class="w-full"
				onclick={onLinkClick}
			>
				<DropdownMenu.Item
					class="cursor-pointer font-medium text-primary focus:bg-primary/10 focus:text-primary"
				>
					<LogIn class="mr-2 h-4 w-4" />
					{strings.common.signIn}
				</DropdownMenu.Item>
			</a>
			<a href={resolve('/settings')} class="w-full" onclick={onLinkClick}>
				<DropdownMenu.Item class="cursor-pointer">
					<Settings class="mr-2 h-4 w-4" />
					{strings.nav.settings}
				</DropdownMenu.Item>
			</a>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}
