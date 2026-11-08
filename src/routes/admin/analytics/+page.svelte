<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Clock,
		Headphones,
		Users,
		Activity,
		BookOpen,
		Disc3,
		BarChart3,
		Radio,
		ExternalLink
	} from '@lucide/svelte';

	let { data } = $props();

	const avgMinutesPerSession = $derived(
		data.summary.totalSessions > 0
			? Math.round(data.summary.totalSeconds / data.summary.totalSessions / 60)
			: 0
	);

	const maxDailyHours = $derived(
		data.dailyBreakdown.length > 0
			? Math.max(...data.dailyBreakdown.map((d: { hours: number }) => d.hours), 0.1)
			: 1
	);

	const summaryCards = $derived([
		{
			label: 'Всего времени',
			value: `${data.summary.totalHours} ч`,
			subtext: data.summary.formattedTotalTime,
			icon: Clock,
			color: 'text-blue-500'
		},
		{
			label: 'Всего прослушиваний',
			value: data.summary.totalSessions.toLocaleString('ru-RU'),
			subtext: 'Успешных сессий',
			icon: Headphones,
			color: 'text-emerald-500'
		},
		{
			label: 'Уникальных слушателей',
			value: data.summary.uniqueListeners.toLocaleString('ru-RU'),
			subtext: 'Зарегистрированных',
			icon: Users,
			color: 'text-purple-500'
		},
		{
			label: 'Средняя сессия',
			value: `${avgMinutesPerSession} мин`,
			subtext: 'На одно включение',
			icon: Activity,
			color: 'text-amber-500'
		}
	]);
</script>

<div class="space-y-8">
	<!-- Page Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Аналитика прослушиваний</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Статистика воспроизведения аудиокниг, динамика активности слушателей и интеграция с Umami.
			</p>
		</div>

		<div class="flex items-center gap-2">
			{#if data.isUmamiConfigured}
				<Badge variant="secondary" class="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
					<Radio class="mr-1.5 h-3.5 w-3.5 animate-pulse" />
					Umami активен
				</Badge>
			{:else}
				<Badge variant="outline" class="border-amber-500/30 bg-amber-500/10 text-amber-500">
					Umami не настроен
				</Badge>
			{/if}
		</div>
	</div>

	<!-- Summary Cards -->
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		{#each summaryCards as item (item.label)}
			{@const Icon = item.icon}
			<Card class="border-border/50">
				<CardContent class="p-4 sm:p-5">
					<div class="flex items-center justify-between">
						<p class="text-xs font-medium text-muted-foreground">{item.label}</p>
						<div class="rounded-xl bg-muted/60 p-2 {item.color}">
							<Icon class="h-4 w-4" />
						</div>
					</div>
					<p class="mt-2 text-2xl font-bold tracking-tight">{item.value}</p>
					<p class="mt-1 text-xs text-muted-foreground">{item.subtext}</p>
				</CardContent>
			</Card>
		{/each}
	</div>

	<!-- Trend Chart / Activity -->
	<Card class="border-border/50">
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-base">
				<BarChart3 class="h-4 w-4 text-primary" />
				Динамика активности по дням
			</CardTitle>
			<CardDescription>
				Количество часов прослушивания за последние дни (daily_listening_stats).
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if data.dailyBreakdown.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<div class="rounded-full bg-muted/50 p-4 text-muted-foreground">
						<BarChart3 class="h-8 w-8" />
					</div>
					<p class="mt-3 text-sm font-medium">Статистика пока не собрана</p>
					<p class="mt-1 text-xs text-muted-foreground">
						Данные появятся автоматически при воспроизведении глав пользователями.
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					<div class="flex h-48 items-end gap-1 overflow-x-auto pt-6 pb-2 sm:gap-2">
						{#each data.dailyBreakdown as day (day.date)}
							{@const heightPercent = Math.max(8, Math.round((day.hours / maxDailyHours) * 100))}
							<div class="group relative flex min-w-[20px] flex-1 flex-col items-center">
								<!-- Tooltip on hover -->
								<div
									class="pointer-events-none absolute -top-12 z-20 hidden rounded-md bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-md group-hover:block"
								>
									{day.date}: {day.hours} ч ({day.sessionsCount} сессий)
								</div>

								<!-- Bar -->
								<div
									class="w-full rounded-t-md bg-primary/80 transition-all hover:bg-primary"
									style="height: {heightPercent}%;"
								></div>

								<!-- Date label -->
								<span class="mt-2 truncate text-[10px] text-muted-foreground">
									{day.date.slice(5)}
								</span>
							</div>
						{/each}
					</div>
					<div
						class="flex justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground"
					>
						<span>0 ч</span>
						<span>Пик: {maxDailyHours} ч/день</span>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Top Books & Chapters Grid -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Top Books -->
		<Card class="border-border/50">
			<CardHeader>
				<CardTitle class="flex items-center gap-2 text-base">
					<BookOpen class="h-4 w-4 text-blue-500" />
					Популярные книги
				</CardTitle>
				<CardDescription>Книги с наибольшим суммарным временем прослушивания.</CardDescription>
			</CardHeader>
			<CardContent>
				{#if data.topBooks.length === 0}
					<p class="py-6 text-center text-xs text-muted-foreground">Нет данных по книгам</p>
				{:else}
					<div class="space-y-3">
						{#each data.topBooks as book, i (book.bookId)}
							<div
								class="flex items-center justify-between rounded-lg border border-border/40 bg-card/40 p-3"
							>
								<div class="flex items-center gap-3">
									<span
										class="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-semibold"
									>
										{i + 1}
									</span>
									<div>
										<p class="text-sm leading-none font-medium">{book.title}</p>
										<p class="mt-1 text-xs text-muted-foreground">
											{book.sessionsCount} прослушиваний
										</p>
									</div>
								</div>
								<Badge variant="secondary" class="font-mono text-xs">
									{book.formattedDuration}
								</Badge>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Top Chapters -->
		<Card class="border-border/50">
			<CardHeader>
				<CardTitle class="flex items-center gap-2 text-base">
					<Disc3 class="h-4 w-4 text-purple-500" />
					Популярные аудиоглавы
				</CardTitle>
				<CardDescription>Главы с наибольшим временем воспроизведения.</CardDescription>
			</CardHeader>
			<CardContent>
				{#if data.topChapters.length === 0}
					<p class="py-6 text-center text-xs text-muted-foreground">Нет данных по главам</p>
				{:else}
					<div class="space-y-3">
						{#each data.topChapters as ch, i (ch.chapterId)}
							<div
								class="flex items-center justify-between rounded-lg border border-border/40 bg-card/40 p-3"
							>
								<div class="flex items-center gap-3">
									<span
										class="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-semibold"
									>
										{i + 1}
									</span>
									<div>
										<p class="text-sm leading-none font-medium">
											{ch.chapterTitle}
										</p>
										<p class="mt-1 text-xs text-muted-foreground">
											{ch.bookTitle ?? ''} • {ch.sessionsCount} прослушиваний
										</p>
									</div>
								</div>
								<Badge variant="secondary" class="font-mono text-xs">
									{ch.formattedDuration}
								</Badge>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Recent Sessions Table -->
	<Card class="border-border/50">
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-base">
				<Activity class="h-4 w-4 text-emerald-500" />
				Последние сессии прослушивания
			</CardTitle>
			<CardDescription>Недавние поступления в listening_sessions.</CardDescription>
		</CardHeader>
		<CardContent>
			{#if data.recentSessions.length === 0}
				<p class="py-6 text-center text-xs text-muted-foreground">Сессии еще не зафиксированы</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="border-b border-border/40 text-muted-foreground">
							<tr>
								<th class="pb-2 font-medium">Глава / Книга</th>
								<th class="pb-2 font-medium">Слушатель</th>
								<th class="pb-2 font-medium">Время прослушивания</th>
								<th class="pb-2 font-medium">Дата и время</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/20">
							{#each data.recentSessions as session (session.id)}
								<tr>
									<td class="py-2.5 font-medium">
										<div>{session.chapterTitle}</div>
										<div class="text-[11px] text-muted-foreground">{session.bookTitle}</div>
									</td>
									<td class="py-2.5 text-muted-foreground">{session.user}</td>
									<td class="py-2.5">
										<Badge variant="outline" class="font-mono text-[11px]">
											{session.formattedDuration}
										</Badge>
									</td>
									<td class="py-2.5 text-muted-foreground">
										{new Date(session.startedAt).toLocaleString('ru-RU')}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Umami Info Footer Card -->
	<Card class="border-border/40 bg-card/40">
		<CardContent class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="space-y-1">
				<p class="text-sm font-semibold">Внешняя аналитика Umami</p>
				<p class="text-xs text-muted-foreground">
					Umami обеспечивает конфиденциальный сбор просмотров страниц и событий без использования
					cookie. Для включения добавьте переменную окружения <code>PUBLIC_UMAMI_WEBSITE_ID</code>.
				</p>
			</div>
			<a
				href="https://umami.is/docs"
				target="_blank"
				rel="noreferrer"
				class="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
			>
				Документация Umami
				<ExternalLink class="h-3.5 w-3.5" />
			</a>
		</CardContent>
	</Card>
</div>
