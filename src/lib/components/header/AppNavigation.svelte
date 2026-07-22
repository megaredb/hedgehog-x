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
	<div class="flex items-center gap-3 px-2 mb-8 select-none">
		<div
			class="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shadow-sm"
		>
			<img alt="logo" src="/logo.webp" class="h-7 w-7 rounded-full object-cover" />
		</div>
		<span
			class="font-extrabold text-lg tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-transparent"
		>
			HEDGEHOG.INC
		</span>
	</div>

	<!-- Основная навигация -->
	<nav class="flex-1 flex flex-col gap-6">
		{#each groups as group (group.title)}
			<div class="space-y-1">
				<span
					class="px-2 text-xxs font-bold uppercase tracking-wider text-muted-foreground/60 select-none"
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
								class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group
								{isActive(link.href)
									? 'bg-accent text-accent-foreground shadow-sm font-semibold'
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
	<div class="mt-auto pt-4 border-t border-border/40 flex items-center justify-between gap-2 px-1">
		<ProfileDropdown
			{onLinkClick}
			side="top"
			triggerClass="flex items-center gap-3 text-left p-1.5 rounded-xl hover:bg-muted/40 transition-colors w-full focus:outline-none select-none"
		>
			<Avatar.Root class="h-9 w-9 border border-border/80 shadow-sm">
				<Avatar.Image src="/logo.webp" alt="User Profile" />
				<Avatar.Fallback class="bg-primary/5 text-primary text-xs font-semibold">ME</Avatar.Fallback
				>
			</Avatar.Root>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-semibold truncate text-foreground leading-snug">Мой Профиль</p>
				<p class="text-xs text-muted-foreground truncate leading-normal">Hedgehog User</p>
			</div>
		</ProfileDropdown>

		<div class="shrink-0 flex items-center justify-center">
			<ThemeSwitchButton />
		</div>
	</div>
{/snippet}

<!-- ДЕСКТОПНЫЙ САЙДБАР -->
<aside
	class="w-64 h-screen border-r border-border/40 bg-muted/30 shadow-[4px_0_24px_rgba(0,0,0,0.04)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)] backdrop-blur-xl hidden lg:flex flex-col py-6 px-4 sticky top-0 shrink-0 z-10"
>
	{@render navContent(() => {})}
</aside>

<!-- МОБИЛЬНЫЙ ХЭДЕР -->
<header
	class="w-full sticky top-0 z-40 py-3 px-4 flex items-center justify-between transition-all duration-300 border-b lg:hidden
	{y > 10 ? 'border-border/40 shadow-sm bg-background/80 backdrop-blur-md' : 'border-transparent'}"
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
				class="w-72 p-6 flex flex-col h-full bg-background/95 backdrop-blur-md"
			>
				{@render navContent(() => (isMobileMenuOpen = false))}
			</Sheet.Content>
		</Sheet.Root>

		<!-- Круглый логотип + Название -->
		<a href={resolve('/')} class="flex items-center gap-2 select-none">
			<div
				class="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shadow-sm"
			>
				<img alt="logo" src="/logo.webp" class="h-6.5 w-6.5 rounded-full object-cover" />
			</div>
			<span
				class="font-extrabold text-md tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-transparent"
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
				<Avatar.Image src="/logo.webp" alt="User Profile" />
				<Avatar.Fallback class="bg-primary/5 text-primary text-xs font-semibold">ME</Avatar.Fallback
				>
			</Avatar.Root>
		</ProfileDropdown>
	</div>
</header>
