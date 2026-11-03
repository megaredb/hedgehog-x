<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import {
		ShieldAlert,
		BookOpen,
		Layers,
		Disc3,
		Image as ImageIcon,
		LayoutDashboard,
		ArrowLeft,
		ShieldCheck
	} from '@lucide/svelte';

	let { data, children } = $props();

	const navItems = [
		{ href: '/admin', label: 'Обзор', icon: LayoutDashboard },
		{ href: '/admin/books', label: 'Книги', icon: BookOpen },
		{ href: '/admin/volumes', label: 'Тома', icon: Layers },
		{ href: '/admin/chapters', label: 'Главы', icon: Disc3 },
		{ href: '/admin/illustrations', label: 'Иллюстрации', icon: ImageIcon }
	];
</script>

<div class="min-h-screen bg-background text-foreground">
	{#if !data.isAdmin}
		<div class="container mx-auto flex min-h-[70vh] max-w-lg items-center justify-center p-4">
			<Card class="w-full border-destructive/30">
				<CardHeader class="text-center">
					<div
						class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"
					>
						<ShieldAlert class="h-7 w-7" />
					</div>
					<CardTitle class="text-xl">Доступ ограничен</CardTitle>
					<CardDescription>
						У вашей учетной записи ({data.user.email}) нет прав администратора.
					</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4">
					{#if data.isDev}
						<div
							class="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200"
						>
							<strong>Режим разработки:</strong> Вы можете выдать себе права администратора нажатием кнопки
							ниже.
						</div>
						<form method="POST" action="/admin?/makeSelfAdmin">
							<Button type="submit" class="w-full gap-2">
								<ShieldCheck class="h-4 w-4" />
								Сделать меня администратором
							</Button>
						</form>
					{:else}
						<p class="text-center text-xs text-muted-foreground">
							Обратитесь к главному администратору сайта для получения доступа.
						</p>
					{/if}

					<Button variant="outline" href="/" class="w-full gap-2">
						<ArrowLeft class="h-4 w-4" />
						Вернуться на главную
					</Button>
				</CardContent>
			</Card>
		</div>
	{:else}
		<!-- Admin Header -->
		<header class="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-md">
			<div
				class="container mx-auto flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
			>
				<div class="flex items-center gap-3">
					<span class="text-lg font-bold tracking-tight">Hedgehog Admin</span>
					<Badge variant="secondary" class="border-primary/20 bg-primary/10 text-primary">
						Cloudflare R2
					</Badge>
				</div>

				<div class="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
					{#each navItems as item (item.href)}
						{@const isActive =
							item.href === '/admin'
								? page.url.pathname === '/admin'
								: page.url.pathname.startsWith(item.href)}
						{@const Icon = item.icon}
						<Button
							href={item.href}
							variant={isActive ? 'secondary' : 'ghost'}
							size="sm"
							class="shrink-0 gap-1.5"
						>
							<Icon class="h-4 w-4" />
							<span>{item.label}</span>
						</Button>
					{/each}

					<Button href="/" variant="outline" size="sm" class="ml-auto shrink-0 gap-1.5 sm:ml-2">
						<ArrowLeft class="h-4 w-4" />
						<span class="hidden sm:inline">На сайт</span>
					</Button>
				</div>
			</div>
		</header>

		<!-- Admin Content -->
		<main class="container mx-auto max-w-7xl p-4 sm:p-6">
			{@render children()}
		</main>
	{/if}
</div>
