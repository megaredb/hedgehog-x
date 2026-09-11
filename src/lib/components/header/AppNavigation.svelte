<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import {
		BookOpen,
		Bookmark,
		History as HistoryIcon,
		Download,
		Users,
		Heart,
		Info,
		Menu
	} from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import ThemeSwitchButton from './ThemeSwitchButton.svelte';
	import ProfileDropdown from './ProfileDropdown.svelte';
	import { useSession } from '$lib/client/session.svelte';

	const session = useSession();

	let y = $state(0);
	let isMobileMenuOpen = $state(false);

	// Проверяем, активна ли ссылка
	const isActive = (path: string) => {
		if (path === '/') {
			return page.url.pathname === '/' || page.url.pathname.startsWith('/books/');
		}
		return page.url.pathname === path;
	};

	const groups = [
		{
			title: 'Библиотека',
			links: [
				{ href: resolve('/'), icon: BookOpen, label: 'Каталог' },
				{ href: resolve('/bookmarks'), icon: Bookmark, label: 'Закладки' },
				{ href: resolve('/history'), icon: HistoryIcon, label: 'История' },
				{ href: resolve('/downloads'), icon: Download, label: 'Загрузки' }
			]
		},
		{
			title: 'Информация',
			links: [
				{ href: resolve('/community'), icon: Users, label: 'Сообщество' },
				{ href: resolve('/support'), icon: Heart, label: 'Поддержать' },
				{ href: resolve('/about'), icon: Info, label: 'О сайте' }
			]
		}
	];
</script>

<svelte:window bind:scrollY={y} />

{#snippet navContent(onLinkClick: () => void)}
	<!-- Логотип + Название -->
	<div class="mb-8 flex items-center gap-3 px-2 select-none">
		<div
			class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 shadow-sm"
		>
			<img alt="logo" src="/logo.webp" class="h-7 w-7 rounded-full object-cover" />
		</div>
		<span
			class="bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-lg font-extrabold tracking-tight text-transparent"
		>
			HEDGEHOG.INC
		</span>
	</div>

	<!-- Основная навигация -->
	<nav class="flex flex-1 flex-col gap-6">
		{#each groups as group (group.title)}
			<div class="space-y-1">
				<span
					class="text-xxs px-2 font-bold tracking-wider text-muted-foreground/60 uppercase select-none"
				>
					{group.title}
				</span>
				<ul class="space-y-0.5 pt-1.5">
					{#each group.links as link (link.href)}
						{@const Icon = link.icon}
						<li>
							<a
								href={link.href}
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
			</div>
		{/each}
	</nav>

	<!-- Нижний блок с профилем -->
	<div class="mt-auto flex items-center justify-between gap-2 border-t border-border/40 px-1 pt-4">
		<ProfileDropdown
			{onLinkClick}
			side="top"
			triggerClass="flex items-center gap-3 text-left p-1.5 rounded-xl hover:bg-muted/40 transition-colors w-full focus:outline-none select-none"
		>
			{#if session.user}
				<Avatar.Root class="h-9 w-9 border border-border/80 shadow-sm">
					{#if session.user.image}
						<Avatar.Image src={session.user.image} alt={session.user.name} />
					{:else}
						<Avatar.Fallback class="bg-primary/5 text-xs font-semibold text-primary">
							{session.user.name?.charAt(0).toUpperCase()}
						</Avatar.Fallback>
					{/if}
				</Avatar.Root>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm leading-snug font-semibold text-foreground">
						{session.user.name}
					</p>
				</div>
			{:else}
				<div class="flex items-center gap-3">
					<Avatar.Root class="h-9 w-9 border border-border/80 shadow-sm">
						<Avatar.Image src="/logo.webp" alt="Гость" />
						<Avatar.Fallback class="bg-primary/5 text-xs font-semibold text-primary"
							>Г</Avatar.Fallback
						>
					</Avatar.Root>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm leading-snug font-semibold text-foreground">Гость</p>
						<p class="truncate text-xs leading-normal text-muted-foreground">Войдите в аккаунт</p>
					</div>
				</div>
			{/if}
		</ProfileDropdown>

		<div class="flex shrink-0 items-center justify-center">
			<ThemeSwitchButton />
		</div>
	</div>
{/snippet}

<!-- ДЕСКТОПНЫЙ САЙДБАР -->
<aside
	class="sticky top-0 z-10 hidden h-screen w-64 shrink-0 flex-col border-r border-border/40 bg-muted/30 px-4 py-6 shadow-[4px_0_24px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:flex dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)]"
>
	{@render navContent(() => {})}
</aside>

<!-- МОБИЛЬНЫЙ ХЭДЕР -->
<header
	class="sticky top-0 z-40 flex w-full items-center justify-between border-b px-4 py-3 transition-all duration-300 lg:hidden
	{y > 10 ? 'border-border/40 bg-background/80 shadow-sm backdrop-blur-md' : 'border-transparent'}"
>
	<!-- Левая часть: бургер-меню -->
	<div class="flex items-center gap-3">
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
						<span class="sr-only">Toggle Menu</span>
					</Button>
				{/snippet}
			</Sheet.Trigger>
			<Sheet.Content
				side="left"
				class="flex h-full w-72 flex-col bg-background/95 p-6 backdrop-blur-md"
			>
				{@render navContent(() => (isMobileMenuOpen = false))}
			</Sheet.Content>
		</Sheet.Root>

		<!-- Круглый логотип + Название -->
		<a href={resolve('/')} class="flex items-center gap-2 select-none">
			<div
				class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 shadow-sm"
			>
				<img alt="logo" src="/logo.webp" class="h-6.5 w-6.5 rounded-full object-cover" />
			</div>
			<span
				class="text-md bg-linear-to-r from-foreground to-foreground/80 bg-clip-text font-extrabold tracking-tight text-transparent"
			>
				HEDGEHOG.INC
			</span>
		</a>
	</div>

	<!-- Правая часть: быстрый профиль -->
	<div class="flex items-center gap-2">
		<ProfileDropdown
			align="end"
			triggerClass="h-8 w-8 rounded-full border border-border/80 shadow-sm overflow-hidden focus:outline-none"
		>
			<Avatar.Root class="h-8 w-8">
				{#if session.user?.image}
					<Avatar.Image src={session.user.image} alt={session.user.name} />
				{:else}
					<Avatar.Fallback class="bg-primary/5 text-xs font-semibold text-primary">
						{session.user?.name?.charAt(0).toUpperCase() ?? 'Г'}
					</Avatar.Fallback>
				{/if}
			</Avatar.Root>
		</ProfileDropdown>
	</div>
</header>
