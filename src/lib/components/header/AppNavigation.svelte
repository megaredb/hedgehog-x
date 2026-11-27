<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import {
		ArrowUpRight,
		BookOpen,
		Bookmark,
		CalendarClock,
		Crown,
		Download,
		Heart,
		History as HistoryIcon,
		Home,
		Info,
		Menu,
		Radio,
		Settings,
		Moon,
		ShieldCheck,
		Users
	} from '@lucide/svelte';
	import LiveBars from '$lib/components/broadcasts/LiveBars.svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { mode, toggleMode } from 'mode-watcher';
	import { useSession } from '$lib/client/session.svelte';
	import { strings } from '$lib/constants/strings';

	const session = useSession();
	const subscriptionActive = $derived(
		Boolean(session.user) && Boolean(page.data.subscriptionActive)
	);
	const subscriptionLifetime = $derived(
		Boolean(session.user) && Boolean(page.data.subscriptionLifetime)
	);

	type BroadcastParticipant = { id: string; name: string; image: string | null };
	type BroadcastInfo = {
		id: string;
		title: string;
		coverUrl: string | null;
		listeners: number;
		participants: BroadcastParticipant[];
		kind: string;
		scheduledStartAt: string;
	};
	let activeBroadcast = $state<BroadcastInfo | null>(null);
	let broadcastTimer: ReturnType<typeof setInterval> | null = null;

	const liveBroadcast = $derived(activeBroadcast?.kind === 'live' ? activeBroadcast : null);
	const scheduledBroadcast = $derived(
		activeBroadcast?.kind === 'scheduled' ? activeBroadcast : null
	);

	async function refreshActiveBroadcast() {
		try {
			const res = await fetch('/api/broadcasts/active', { cache: 'no-store' });
			if (!res.ok) return;
			const payload = await res.json();
			const next = payload.broadcast;
			activeBroadcast =
				next?.kind === 'live' || next?.kind === 'scheduled'
					? {
							...next,
							participants: Array.isArray(next.participants) ? next.participants : []
						}
					: null;
		} catch {
			// The menu is usable even if the broadcast endpoint is unavailable.
		}
	}

	function formatScheduledAt(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return 'Скоро';
		return new Intl.DateTimeFormat('ru-RU', {
			day: 'numeric',
			month: 'long',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Europe/Moscow'
		}).format(date);
	}

	onMount(() => {
		void refreshActiveBroadcast();
		broadcastTimer = setInterval(refreshActiveBroadcast, 10_000);
		return () => {
			if (broadcastTimer) clearInterval(broadcastTimer);
		};
	});

	onDestroy(() => {
		if (broadcastTimer) clearInterval(broadcastTimer);
	});

	let y = $state(0);
	let isMobileMenuOpen = $state(false);
	let otherOpen = $state(false);

	const premiumUntil = $derived.by(() => {
		if (!subscriptionActive) return 'Оформить подписку';
		if (subscriptionLifetime) return 'Бессрочный доступ';
		const raw = page.data.subscriptionExpiresAt;
		if (!raw) return 'Подписка активна';
		const date = new Date(raw);
		if (Number.isNaN(date.getTime())) return 'Подписка активна';
		return (
			'Подписка активна до ' +
			date
				.toLocaleDateString('ru-RU', {
					day: 'numeric',
					month: 'long',
					timeZone: 'Europe/Moscow'
				})
				.replace(/\s*г\.$/, '')
		);
	});

	const isActive = (path: string) => {
		if (path === '/') return page.url.pathname === '/';
		if (path === '/books') {
			return page.url.pathname === '/books' || page.url.pathname.startsWith('/books/');
		}
		return page.url.pathname === path;
	};

	const groups = $derived([
		{
			links: [
				{ href: resolve('/'), icon: Home, label: 'Главная' },
				{ href: resolve('/books'), icon: BookOpen, label: strings.nav.catalog },
				{ href: resolve('/broadcasts'), icon: Radio, label: 'Трансляции' },
				{ href: resolve('/bookmarks'), icon: Bookmark, label: strings.nav.bookmarks },
				{ href: resolve('/history'), icon: HistoryIcon, label: strings.nav.history },
				{ href: resolve('/downloads'), icon: Download, label: strings.nav.downloads }
			]
		},
		{
			links: [
				{ href: resolve('/community'), icon: Users, label: strings.nav.community },
				{ href: resolve('/support'), icon: Heart, label: strings.nav.support },
				{ href: resolve('/about'), icon: Info, label: strings.nav.about }
			]
		}
	]);

	const adminGroup = $derived(
		Boolean(session.user) && page.data.isAdmin === true
			? [
					{
						links: [
							{
								href: resolve('/admin'),
								icon: ShieldCheck,
								label: 'Панель управления'
							}
						]
					}
				]
			: []
	);
</script>

<svelte:window bind:scrollY={y} />

{#snippet profileLink(onLinkClick: () => void)}
	<a
		href={session.user ? resolve('/profile') : resolve('/auth')}
		onclick={onLinkClick}
		class="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors select-none hover:bg-muted/40 focus:outline-none"
	>
		{#if session.user}
			<div
				class="relative shrink-0 rounded-full {subscriptionActive ? 'p-[2px]' : ''}"
				style={subscriptionActive
					? `background-color: ${subscriptionLifetime ? '#fbbf24' : '#10b981'}`
					: undefined}
				title={subscriptionActive ? 'Подписка активна' : undefined}
				aria-label={subscriptionActive ? 'Профиль, активная подписка' : 'Профиль'}
			>
				<Avatar.Root class="h-9 w-9 border-0 shadow-sm">
					{#if session.user.image}
						<Avatar.Image src={session.user.image} alt={session.user.name} />
					{:else}
						<Avatar.Fallback class="bg-primary/5 text-xs font-semibold text-primary">
							{session.user.name?.charAt(0).toUpperCase()}
						</Avatar.Fallback>
					{/if}
				</Avatar.Root>
				{#if subscriptionActive}
					<span
						class="absolute -right-0.5 -bottom-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ring-2 ring-background {subscriptionLifetime
							? 'bg-amber-400 text-amber-950'
							: 'bg-emerald-700 text-white'}"
						aria-hidden="true"
						>{#if subscriptionLifetime}∞{:else}<Crown class="h-2.5 w-2.5" />{/if}</span
					>
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm leading-snug font-semibold text-foreground">
					{session.user.name}
				</p>
			</div>
		{:else}
			<div class="flex items-center gap-3">
				<Avatar.Root class="h-9 w-9 border border-border/80 shadow-sm">
					<Avatar.Image src="/logo.webp" alt={strings.common.guest} />
					<Avatar.Fallback class="bg-primary/5 text-xs font-semibold text-primary"
						>Г</Avatar.Fallback
					>
				</Avatar.Root>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm leading-snug font-semibold text-foreground">
						{strings.common.guest}
					</p>
					<p class="truncate text-xs leading-normal text-muted-foreground">
						{strings.common.signIn}
					</p>
				</div>
			</div>
		{/if}
	</a>
{/snippet}

{#snippet broadcastAvatars(broadcast: BroadcastInfo, live: boolean)}
	{#if broadcast.participants.length > 0}
		<div class="mt-1 flex items-center gap-1.5">
			<div class="flex -space-x-1.5">
				{#each broadcast.participants.slice(0, 3) as participant (participant.id)}
					<span
						title={participant.name}
						class="relative flex h-4.5 w-4.5 overflow-hidden rounded-full border bg-black/30 text-[7px] font-bold {live
							? 'border-white/70 text-white'
							: 'border-amber-700/30 text-foreground'}"
					>
						{#if participant.image}<img
								src={participant.image}
								alt=""
								class="h-full w-full object-cover"
								loading="lazy"
							/>{:else}{participant.name.charAt(0).toUpperCase()}{/if}
					</span>
				{/each}
			</div>
			{#if broadcast.listeners > 3}
				<span class="text-[8px] font-semibold {live ? 'text-white/85' : 'text-muted-foreground'}"
					>+{broadcast.listeners - 3}</span
				>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet navContent(onLinkClick: () => void, showBrand: boolean)}
	{#if !showBrand}
		<div class="mb-4 border-b border-border/40 pb-4">
			{@render profileLink(onLinkClick)}
		</div>
	{/if}

	{#if showBrand}
		<a
			href={resolve('/')}
			onclick={onLinkClick}
			class="mb-6 flex items-center gap-3 px-2 select-none"
			aria-label={strings.common.appName}
		>
			<div
				class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 shadow-sm"
			>
				<img alt="logo" src="/logo.webp" class="h-7 w-7 rounded-full object-cover" />
			</div>
			<span
				class="bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-lg font-extrabold tracking-tight text-transparent"
			>
				{strings.common.appName}
			</span>
		</a>
	{/if}

	<nav class="flex flex-1 flex-col gap-1">
		{#each groups as group, groupIndex (groupIndex)}
			{#if groupIndex > 0}
				<div class="my-2 border-t border-border/40"></div>
			{/if}
			<ul class="space-y-0.5">
				{#each group.links as link (link.href)}
					{@const Icon = link.icon}
					<li>
						<a
							href={resolve(link.href as '/')}
							onclick={onLinkClick}
							class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
							{isActive(link.href)
								? 'bg-accent font-semibold text-accent-foreground shadow-sm'
								: 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'}"
						>
							<Icon
								class="h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-105"
							/>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		{/each}

		<div class="my-2 border-t border-border/40"></div>
		<button
			type="button"
			class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
			aria-expanded={otherOpen}
			onclick={() => (otherOpen = !otherOpen)}
		>
			<span>Другое</span>
			<svg
				class="h-4 w-4 transition-transform {otherOpen ? 'rotate-180' : ''}"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.7"
			>
				<path d="m8 10 4 4 4-4" />
			</svg>
		</button>
		{#if otherOpen}
			<ul class="space-y-0.5">
				<li>
					<a
						href={resolve('/settings')}
						onclick={onLinkClick}
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
					>
						<Settings class="h-4.5 w-4.5" />
						Настройки
					</a>
				</li>
				<li>
					<div
						class="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground"
					>
						<span class="flex items-center gap-3"><Moon class="h-4.5 w-4.5" />Тёмная тема</span>
						<Switch
							checked={mode.current === 'dark'}
							onCheckedChange={(checked) => {
								const target = checked ? 'dark' : 'light';
								if (mode.current !== target) toggleMode();
							}}
							aria-label="Тёмная тема"
						/>
					</div>
				</li>
				<li>
					<a
						href={resolve('/feedback')}
						onclick={onLinkClick}
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
					>
						<Radio class="h-4.5 w-4.5" />
						Обратная связь
					</a>
				</li>
				<li>
					<a
						href={resolve('/about')}
						onclick={onLinkClick}
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
					>
						<ArrowUpRight class="h-4.5 w-4.5" />
						Пройти гайд
					</a>
				</li>
			</ul>
		{/if}

		<a
			href={resolve('/subscription')}
			onclick={onLinkClick}
			class="group relative mt-2 mb-1 flex h-9 items-center gap-2.5 overflow-hidden rounded-lg px-3 shadow-[0_6px_18px_rgba(16,185,129,0.18)] transition hover:brightness-110 {subscriptionLifetime
				? 'bg-amber-400 text-amber-950 shadow-[0_6px_18px_rgba(245,158,11,0.25)]'
				: 'bg-emerald-700 text-white'}"
			title={premiumUntil}
			aria-label={'Мой Premium. ' + premiumUntil}
		>
			<div
				class="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
				aria-hidden="true"
			>
				<svg
					class="absolute top-0 left-2 h-2.5 w-2.5 text-white/30"
					style="transform: rotate(20deg)"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" /><path d="M5 19h14v1.5H5z" /></svg
				>
				<svg
					class="absolute top-4 left-14 h-3.5 w-3.5 text-white/30"
					style="transform: rotate(-25deg)"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" /><path d="M5 19h14v1.5H5z" /></svg
				>
				<svg
					class="absolute top-1 left-28 h-3 w-3 text-white/40"
					style="transform: rotate(15deg)"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" /><path d="M5 19h14v1.5H5z" /></svg
				>
				<svg
					class="absolute bottom-0 left-8 h-3 w-3 text-white/35"
					style="transform: rotate(-18deg)"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" /><path d="M5 19h14v1.5H5z" /></svg
				>
				<svg
					class="absolute bottom-2 left-22 h-2.5 w-2.5 text-white/30"
					style="transform: rotate(28deg)"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" /><path d="M5 19h14v1.5H5z" /></svg
				>
				<svg
					class="absolute top-0 right-4 h-3 w-3 text-white/40"
					style="transform: rotate(-20deg)"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" /><path d="M5 19h14v1.5H5z" /></svg
				>
				<svg
					class="absolute right-12 bottom-1 h-2.5 w-2.5 text-white/35"
					style="transform: rotate(18deg)"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" /><path d="M5 19h14v1.5H5z" /></svg
				>
				<svg
					class="absolute top-5 right-22 h-2 w-2 text-white/30"
					style="transform: rotate(-30deg)"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" /><path d="M5 19h14v1.5H5z" /></svg
				>
				<svg
					class="absolute bottom-0 left-38 h-2 w-2 text-white/30"
					style="transform: rotate(22deg)"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" /><path d="M5 19h14v1.5H5z" /></svg
				>
				<svg
					class="absolute top-2 left-46 h-2.5 w-2.5 text-white/35"
					style="transform: rotate(-15deg)"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" /><path d="M5 19h14v1.5H5z" /></svg
				>
			</div>
			<Crown class="relative h-4 w-4 shrink-0" />
			<span class="relative truncate text-sm font-bold tracking-tight">Мой Premium</span>
			<ArrowUpRight class="relative ml-auto h-3.5 w-3.5 text-white/80" />
		</a>

		{#if scheduledBroadcast}
			<a
				href={resolve('/broadcasts/[id]', { id: scheduledBroadcast.id })}
				onclick={onLinkClick}
				class="mb-2.5 flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-foreground shadow-[0_8px_20px_rgba(245,158,11,0.12)] transition hover:bg-amber-500/15"
			>
				<div class="relative h-9 w-6 shrink-0 overflow-hidden rounded bg-amber-500/15">
					{#if scheduledBroadcast.coverUrl}<img
							src={scheduledBroadcast.coverUrl}
							alt=""
							class="h-full w-full object-cover"
						/>{:else}<div class="flex h-full w-full items-center justify-center">
							<CalendarClock class="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
						</div>{/if}
				</div>
				<div class="min-w-0 flex-1">
					<p
						class="flex items-center gap-1 text-[8px] font-bold tracking-[0.08em] text-amber-700 uppercase dark:text-amber-300"
					>
						<CalendarClock class="h-2.5 w-2.5" />
						Запланировано
					</p>
					<p class="mt-0.5 truncate text-[10px] font-bold">{scheduledBroadcast.title}</p>
					<p class="truncate text-[8px] text-muted-foreground">
						{formatScheduledAt(scheduledBroadcast.scheduledStartAt)}
					</p>
					{@render broadcastAvatars(scheduledBroadcast, false)}
				</div>
				<ArrowUpRight class="h-3.5 w-3.5 text-muted-foreground" />
			</a>
		{/if}

		{#if liveBroadcast}
			<a
				href={resolve('/broadcasts/[id]', { id: liveBroadcast.id })}
				onclick={onLinkClick}
				class="mb-2.5 flex items-center gap-2.5 rounded-xl bg-[#b94a48] px-3 py-2.5 text-white shadow-[0_10px_25px_rgba(221,91,93,0.16)] transition hover:brightness-110"
			>
				<div class="relative h-9 w-6 shrink-0 overflow-hidden rounded bg-black/20">
					{#if liveBroadcast.coverUrl}<img
							src={liveBroadcast.coverUrl}
							alt=""
							class="h-full w-full object-cover"
						/>{:else}<div class="flex h-full w-full items-center justify-center">
							<Radio class="h-3.5 w-3.5" />
						</div>{/if}
					<span class="absolute top-0.5 right-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white"
					></span>
					<div
						class="absolute inset-x-0 bottom-0 flex justify-center bg-black/30 py-0.5"
						aria-hidden="true"
					>
						<LiveBars tone="light" class="scale-75" />
					</div>
				</div>
				<div class="min-w-0 flex-1">
					<p
						class="flex items-center gap-1 text-[8px] font-bold tracking-[0.08em] text-white uppercase"
					>
						<span class="h-1 w-1 rounded-full bg-white"></span>
						Сейчас слушают
					</p>
					<p class="mt-0.5 truncate text-[10px] font-bold">{liveBroadcast.title}</p>
					{@render broadcastAvatars(liveBroadcast, true)}
					<p class="truncate text-[8px] text-white">{liveBroadcast.listeners} слушают в эфире</p>
				</div>
				<ArrowUpRight class="h-3.5 w-3.5 text-white/80" />
			</a>
		{/if}

		{#if adminGroup.length > 0}
			<div class="mt-2 border-t border-border/40 pt-2">
				{#each adminGroup as group (group.links[0]?.href)}
					<ul class="space-y-0.5">
						{#each group.links as link (link.href)}
							{@const Icon = link.icon}
							<li>
								<a
									href={resolve(link.href as '/')}
									onclick={onLinkClick}
									class="flex items-center gap-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
								>
									<Icon class="h-4.5 w-4.5" />
									{link.label}
								</a>
							</li>
						{/each}
					</ul>
				{/each}
			</div>
		{/if}
	</nav>

	{#if showBrand}
		<div class="mt-auto flex items-center border-t border-border/40 pt-4">
			{@render profileLink(onLinkClick)}
		</div>
	{/if}
{/snippet}

<aside
	class="sticky top-0 z-10 hidden h-screen w-[286px] shrink-0 flex-col overflow-y-auto border-r border-border/40 bg-muted/30 px-4 py-6 shadow-[4px_0_24px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:flex dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)]"
>
	{@render navContent(() => {}, true)}
</aside>

<header
	class="sticky top-0 z-40 flex w-full items-center justify-between border-b px-4 py-3 transition-all duration-300 lg:hidden
	{y > 10 ? 'border-border/40 bg-background/80 shadow-sm backdrop-blur-md' : 'border-transparent'}"
>
	<a href={resolve('/')} class="flex items-center gap-2 select-none">
		<div
			class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 shadow-sm"
		>
			<img alt="logo" src="/logo.webp" class="h-6.5 w-6.5 rounded-full object-cover" />
		</div>
		<span
			class="text-md bg-linear-to-r from-foreground to-foreground/80 bg-clip-text font-extrabold tracking-tight text-transparent"
		>
			{strings.common.appName}
		</span>
	</a>

	<Sheet.Root bind:open={isMobileMenuOpen}>
		<Sheet.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					class="h-9 w-9 text-muted-foreground hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
				>
					<Menu class="h-5 w-5" />
					<span class="sr-only">Открыть меню</span>
				</Button>
			{/snippet}
		</Sheet.Trigger>
		<Sheet.Content
			side="right"
			class="flex h-full w-[min(88vw,340px)] flex-col overflow-y-auto bg-background/95 p-6 backdrop-blur-md"
		>
			{@render navContent(() => (isMobileMenuOpen = false), false)}
		</Sheet.Content>
	</Sheet.Root>
</header>
