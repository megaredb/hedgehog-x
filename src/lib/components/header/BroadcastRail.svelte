<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useSession } from '$lib/client/session.svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import {
		BookOpen,
		Bookmark,
		Crown,
		Download,
		Heart,
		History as HistoryIcon,
		Home,
		Info,
		Radio,
		ShieldCheck,
		UserRound,
		Users
	} from '@lucide/svelte';

	const session = useSession();
	const subscriptionActive = $derived(Boolean(page.data.subscriptionActive));
	const subscriptionLifetime = $derived(Boolean(page.data.subscriptionLifetime));
	const links = [
		{ href: resolve('/'), icon: Home, label: 'Главная' },
		{ href: resolve('/books'), icon: BookOpen, label: 'Каталог' },
		{ href: resolve('/broadcasts'), icon: Radio, label: 'Трансляции' },
		{ href: resolve('/bookmarks'), icon: Bookmark, label: 'Закладки' },
		{ href: resolve('/history'), icon: HistoryIcon, label: 'История' },
		{ href: resolve('/downloads'), icon: Download, label: 'Загрузки' },
		{ href: resolve('/community'), icon: Users, label: 'Сообщество' },
		{ href: resolve('/support'), icon: Heart, label: 'Поддержать' },
		{ href: resolve('/about'), icon: Info, label: 'О сайте' }
	];
	const adminLink = $derived(
		page.data.isAdmin === true
			? { href: '/admin', icon: ShieldCheck, label: 'Панель управления' }
			: null
	);
</script>

<aside
	class="sticky top-0 z-20 hidden h-screen w-16 shrink-0 flex-col items-center gap-2 border-r border-border/40 bg-muted/30 px-2 py-4 backdrop-blur-xl lg:flex"
>
	<a
		href={resolve('/')}
		class="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10"
		aria-label="HEDGEHOG.INC"
	>
		<img src="/logo.webp" alt="" class="h-8 w-8 rounded-full object-cover" />
	</a>
	<nav class="no-scrollbar flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto pb-2">
		{#each links as link (link.href)}
			{@const Icon = link.icon}
			{@const active =
				link.href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(link.href)}
			<a
				href={resolve(link.href as '/')}
				title={link.label}
				aria-label={link.label}
				class="flex h-10 w-10 items-center justify-center rounded-xl transition {active
					? 'bg-primary/10 text-primary'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
			>
				<Icon class="h-4.5 w-4.5" />
			</a>
		{/each}
		{#if adminLink}
			{@const AdminIcon = adminLink.icon}
			<a
				href={resolve(adminLink.href as '/')}
				title={adminLink.label}
				aria-label={adminLink.label}
				class="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
				><AdminIcon class="h-4.5 w-4.5" /></a
			>
		{/if}
		<a
			href={resolve('/subscription')}
			title="Premium"
			aria-label="Premium"
			class="mt-1 flex h-10 w-10 items-center justify-center rounded-xl transition hover:brightness-110 {subscriptionLifetime
				? 'bg-amber-400 text-amber-950 shadow-[0_6px_18px_rgba(245,158,11,0.3)]'
				: 'bg-emerald-500 text-white shadow-[0_6px_18px_rgba(16,185,129,0.25)]'}"
			><Crown class="h-4.5 w-4.5" /></a
		>
	</nav>
	<a
		href={session.user ? resolve('/profile') : resolve('/auth')}
		title={session.user?.name ?? 'Войти'}
		aria-label={session.user?.name ?? 'Войти'}
		class="mt-2 shrink-0"
	>
		<div
			class="relative rounded-full {subscriptionActive
				? subscriptionLifetime
					? 'bg-amber-400 p-[2px]'
					: 'bg-emerald-500 p-[2px]'
				: ''}"
			title={subscriptionActive ? 'Подписка активна' : undefined}
		>
			{#if session.user?.image}
				<img src={session.user.image} alt="" class="h-8 w-8 rounded-full object-cover" />
			{:else}
				<Avatar.Root class="h-8 w-8"
					><Avatar.Fallback class="bg-primary/10 text-[10px] text-primary"
						><UserRound class="h-4 w-4" /></Avatar.Fallback
					></Avatar.Root
				>
			{/if}
			{#if subscriptionActive}
				<span
					class="absolute -right-0.5 -bottom-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ring-2 ring-background {subscriptionLifetime
						? 'bg-amber-400 text-amber-950'
						: 'bg-emerald-500 text-white'}"
					aria-hidden="true"
					>{#if subscriptionLifetime}∞{:else}<Crown class="h-2.5 w-2.5" />{/if}</span
				>
			{/if}
		</div>
	</a>
</aside>
