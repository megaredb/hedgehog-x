<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { AudioLines, LogIn, User, LogOut, BookOpen, Library, Home } from '@lucide/svelte';
	import { signOut } from '$lib/client/auth';
	import { page } from '$app/state';

	let { user } = $props<{ user: import('better-auth').User | null }>();

	let lastScrollY = $state(0);
	let isHidden = $state(false);
	let ticking = false;

	function handleScroll() {
		if (typeof window === 'undefined') return;

		if (!ticking) {
			window.requestAnimationFrame(() => {
				const currentScrollY = window.scrollY;

				// Hide header if scrolling down, show if scrolling up (but always show at the top)
				if (currentScrollY > lastScrollY && currentScrollY > 64) {
					isHidden = true;
				} else {
					isHidden = false;
				}
				lastScrollY = currentScrollY;
				ticking = false;
			});
			ticking = true;
		}
	}

	async function handleLogout() {
		await signOut();
		window.location.reload();
	}
</script>

<svelte:window onscroll={handleScroll} />

<header
	class="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/40 shadow-sm transition-transform duration-300 ease-in-out h-16 flex items-center"
	class:-translate-y-full={isHidden}
>
	<div class="max-w-7xl mx-auto w-full px-4 flex items-center justify-between">
		<!-- Logo -->
		<a href="/" class="flex items-center gap-2 select-none outline-none">
			<AudioLines class="h-6 w-6 text-primary animate-pulse" />
			<span
				class="text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent"
			>
				Hedgehog.inc
			</span>
		</a>

		<!-- Navigation Links -->
		<nav class="hidden md:flex items-center gap-6 text-sm font-medium">
			<a
				href="/"
				class="flex items-center gap-1.5 transition-colors hover:text-primary"
				class:text-primary={page.url.pathname === '/'}
			>
				<Home class="h-4 w-4" />
				Главная
			</a>
			<a
				href="/audiobooks"
				class="flex items-center gap-1.5 transition-colors hover:text-primary"
				class:text-primary={page.url.pathname.startsWith('/audiobooks')}
			>
				<BookOpen class="h-4 w-4" />
				Каталог
			</a>
			<a
				href="/my"
				class="flex items-center gap-1.5 transition-colors hover:text-primary"
				class:text-primary={page.url.pathname === '/my'}
			>
				<Library class="h-4 w-4" />
				Моя библиотека
			</a>
		</nav>

		<!-- Auth / Profile -->
		<div class="flex items-center gap-3">
			{#if user}
				<div
					class="flex items-center gap-2 text-xs bg-muted px-3 py-1.5 rounded-full border border-border/40"
				>
					<User class="h-3.5 w-3.5 text-primary" />
					<span class="font-medium max-w-[120px] truncate">{user.name || user.email}</span>
				</div>
				<Button variant="ghost" size="sm" class="h-8 text-xs" onclick={handleLogout}>
					<LogOut class="h-3.5 w-3.5 mr-1" />
					Выйти
				</Button>
			{:else}
				<Button href="/login" variant="outline" size="sm" class="h-9 gap-1.5 text-xs">
					<LogIn class="h-4 w-4" />
					Войти
				</Button>
			{/if}
		</div>
	</div>
</header>

<!-- Spacer to push page content below fixed header -->
<div class="h-16"></div>
