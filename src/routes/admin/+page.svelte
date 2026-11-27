<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { strings } from '$lib/constants/strings';
	import {
		BookOpen,
		Layers,
		Disc3,
		Image as ImageIcon,
		Users,
		Crown,
		Plus,
		ArrowRight
	} from '@lucide/svelte';

	let { data } = $props();

	const stats = $derived([
		{
			label: 'Книг в каталоге',
			count: data.counts.books,
			subtext: 'Всего в библиотеке',
			icon: BookOpen,
			href: '/admin/content',
			color: 'text-blue-500'
		},
		{
			label: 'Томов',
			count: data.counts.volumes,
			subtext: 'Во всех сериях',
			icon: Layers,
			href: '/admin/content?tab=volume',
			color: 'text-amber-500'
		},
		{
			label: 'Аудио глав',
			count: data.counts.chapters,
			subtext: 'Доступно для прослушивания',
			icon: Disc3,
			href: '/admin/content?tab=chapters',
			color: 'text-purple-500'
		},
		{
			label: 'Иллюстраций',
			count: data.counts.illustrations,
			subtext: 'Загружено в хранилище',
			icon: ImageIcon,
			href: '/admin/content?tab=illustrations',
			color: 'text-emerald-500'
		},
		{
			label: 'Слушателей',
			count: data.counts.users,
			subtext: 'Зарегистрировано',
			icon: Users,
			href: '/admin/users',
			color: 'text-rose-500'
		},
		{
			label: 'Подписчиков',
			count: data.counts.subscribers,
			subtext: 'Активный доступ',
			icon: Crown,
			href: '/admin/users',
			color: 'text-emerald-500'
		}
	]);
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Панель управления контентом</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Управление библиотекой аудиокниг, томами, аудиоглавами и иллюстрациями с хранилищем Cloudflare
			R2.
		</p>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
		{#each stats as stat (stat.label)}
			{@const Icon = stat.icon}
			<Button
				href={stat.href}
				variant="ghost"
				class="block h-auto w-full min-w-0 p-0 text-left hover:bg-transparent"
			>
				<Card class="h-full border-border/50 transition hover:border-primary/40">
					<CardContent class="p-4 sm:p-5">
						<div class="flex items-center justify-between gap-2">
							<p class="truncate text-xs font-medium text-muted-foreground">{stat.label}</p>
							<div class="shrink-0 rounded-xl bg-muted/60 p-2 {stat.color}">
								<Icon class="h-4 w-4" />
							</div>
						</div>
						<p class="mt-2 text-2xl font-bold tracking-tight">{stat.count}</p>
						<p class="mt-1 truncate text-xs text-muted-foreground">{stat.subtext}</p>
					</CardContent>
				</Card>
			</Button>
		{/each}
	</div>

	<!-- Quick Actions -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card class="border-border/50 bg-card/60">
			<CardHeader class="pb-3">
				<CardTitle class="flex items-center gap-2 text-base">
					<BookOpen class="h-4 w-4 text-blue-500" />
					Добавить книгу
				</CardTitle>
				<CardDescription class="text-xs">Создание новой серии или тайтла</CardDescription>
			</CardHeader>
			<CardContent>
				<Button href="/admin/content?new=book" size="sm" class="w-full gap-1.5">
					<Plus class="h-4 w-4" />
					Создать книгу
				</Button>
			</CardContent>
		</Card>

		<Card class="border-border/50 bg-card/60">
			<CardHeader class="pb-3">
				<CardTitle class="flex items-center gap-2 text-base">
					<Layers class="h-4 w-4 text-amber-500" />
					Добавить том
				</CardTitle>
				<CardDescription class="text-xs">Новый том с обложкой в WebP</CardDescription>
			</CardHeader>
			<CardContent>
				<Button href="/admin/content?new=volume" size="sm" class="w-full gap-1.5">
					<Plus class="h-4 w-4" />
					Создать том
				</Button>
			</CardContent>
		</Card>

		<Card class="border-border/50 bg-card/60">
			<CardHeader class="pb-3">
				<CardTitle class="flex items-center gap-2 text-base">
					<Disc3 class="h-4 w-4 text-purple-500" />
					Загрузить главу
				</CardTitle>
				<CardDescription class="text-xs">MP3 в R2 и ссылка на Telegram</CardDescription>
			</CardHeader>
			<CardContent>
				<Button href="/admin/content?new=chapter" size="sm" class="w-full gap-1.5">
					<Plus class="h-4 w-4" />
					Загрузить главу
				</Button>
			</CardContent>
		</Card>

		<Card class="border-border/50 bg-card/60">
			<CardHeader class="pb-3">
				<CardTitle class="flex items-center gap-2 text-base">
					<ImageIcon class="h-4 w-4 text-emerald-500" />
					Иллюстрация
				</CardTitle>
				<CardDescription class="text-xs">Авто-конвертация WebP + Blurhash</CardDescription>
			</CardHeader>
			<CardContent>
				<Button href="/admin/content?new=illustration" size="sm" class="w-full gap-1.5">
					<Plus class="h-4 w-4" />
					Загрузить арт
				</Button>
			</CardContent>
		</Card>
	</div>

	<!-- Recent Books -->
	<Card class="border-border/50">
		<CardHeader class="flex flex-row items-center justify-between pb-3">
			<div>
				<CardTitle class="text-lg">Недавние книги</CardTitle>
				<CardDescription class="text-xs">Последние добавленные или измененные книги</CardDescription
				>
			</div>
			<Button href="/admin/content" variant="ghost" size="sm" class="gap-1 text-xs">
				{strings.common.allBooks}
				<ArrowRight class="h-3.5 w-3.5" />
			</Button>
		</CardHeader>
		<CardContent>
			{#if data.recentBooks.length === 0}
				<div class="py-8 text-center text-sm text-muted-foreground">
					В базе пока нет книг. Нажмите «Создать книгу», чтобы добавить первую запись.
				</div>
			{:else}
				<div class="divide-y divide-border/40">
					{#each data.recentBooks as book (book.id)}
						<div class="flex items-center justify-between py-3">
							<div class="flex min-w-0 items-center gap-3">
								{#if book.coverUrl}
									<img
										src={book.coverUrl}
										alt={book.title}
										class="h-12 w-9 shrink-0 rounded border border-border/40 object-cover shadow-xs"
									/>
								{:else}
									<div class="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-muted">
										<BookOpen class="h-4 w-4 text-muted-foreground" />
									</div>
								{/if}
								<div class="min-w-0">
									<p class="truncate text-sm font-medium">{book.title}</p>
									<p class="truncate text-xs text-muted-foreground">
										{book.description || 'Без описания'}
									</p>
								</div>
							</div>
							<div class="flex shrink-0 items-center gap-2">
								<Button href={'/admin/content?edit=' + book.id} variant="outline" size="sm">
									Изменить
								</Button>
								<Button href="/books/{book.id}" variant="ghost" size="sm">Просмотр</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
