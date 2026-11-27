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
	import { Button } from '$lib/components/ui/button';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import ListFilterBar from '$lib/components/common/ListFilterBar.svelte';
	import {
		Clock,
		Headphones,
		Users,
		Activity,
		BookOpen,
		Disc3,
		BarChart3,
		Radio,
		ExternalLink,
		Wallet
	} from '@lucide/svelte';

	let { data } = $props();
	let donationsOpen = $state(false);
	let donationSearch = $state('');
	let donationSort = $state('new');
	let donationPeriod = $state('all');
	let donationSource = $state('all');

	const donationSortOptions = [
		{ value: 'new', label: 'Сначала новые' },
		{ value: 'old', label: 'Сначала старые' },
		{ value: 'amount_desc', label: 'Сумма: по убыванию' },
		{ value: 'amount_asc', label: 'Сумма: по возрастанию' }
	];
	const donationSourceOptions = [
		{ value: 'all', label: 'Все источники' },
		{ value: 'sber', label: 'Сбербанк' },
		{ value: 'manual', label: 'Администратор' },
		{ value: 'boosty', label: 'Boosty' }
	];

	const recentDonations = $derived(data.revenue.recent.slice(0, 10));
	const filteredDonations = $derived.by(() => {
		const query = donationSearch.trim().toLowerCase();
		const cutoff = donationPeriod === 'all' ? null : Date.now() - Number(donationPeriod) * 86400000;
		return data.revenue.recent
			.filter((donation) => {
				const created = new Date(donation.createdAt).getTime();
				if (cutoff != null && created < cutoff) return false;
				if (donationSource !== 'all' && donation.source !== donationSource) return false;
				if (!query) return true;
				return [donation.userName, donation.userId, donation.note]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(query));
			})
			.sort((a, b) => {
				if (donationSort === 'old')
					return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
				if (donationSort === 'amount_desc') return b.amountRub - a.amountRub;
				if (donationSort === 'amount_asc') return a.amountRub - b.amountRub;
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			});
	});

	function formatMoney(value: number): string {
		return Number(value || 0).toLocaleString('ru-RU');
	}

	function donationWord(value: number): string {
		const mod10 = value % 10;
		const mod100 = value % 100;
		if (mod100 >= 11 && mod100 <= 14) return 'донатов';
		if (mod10 === 1) return 'донат';
		if (mod10 >= 2 && mod10 <= 4) return 'доната';
		return 'донатов';
	}

	function formatDateTime(value: Date | string | null | undefined): string {
		if (!value) return '—';
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return date.toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Europe/Moscow'
		});
	}

	const avgMinutesPerSession = $derived(
		data.summary.totalSessions > 0
			? Math.round(data.summary.totalSeconds / data.summary.totalSessions / 60)
			: 0
	);

	// For small libraries the daily activity is more readable in minutes. Switch
	// the whole chart to hours only when there is at least an hour of listening.
	const useMinutes = $derived(data.summary.totalSeconds < 3600);
	const chartUnit = $derived(useMinutes ? 'мин' : 'ч');
	const chartRows = $derived(
		data.dailyBreakdown.map(
			(day: { date: string; minutes: number; hours: number; sessionsCount: number }) => ({
				...day,
				value: useMinutes ? day.minutes : day.hours
			})
		)
	);
	const maxDailyValue = $derived(
		chartRows.length > 0
			? Math.max(...chartRows.map((day: { value: number }) => day.value), useMinutes ? 1 : 0.1)
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
		},
		{
			label: 'Доходы',
			value: `${formatMoney(data.revenue.totalRub)} ₽`,
			subtext: `За 30 дней: ${formatMoney(data.revenue.last30Rub)} ₽`,
			icon: Wallet,
			color: 'text-emerald-500'
		}
	]);
</script>

<div class="space-y-8">
	<!-- Page Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Аналитика</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Прослушивания, доходы от ручных донатов и активность слушателей.
			</p>
		</div>

		<div class="flex items-center gap-2">
			{#if data.isUmamiConfigured}
				<Badge variant="secondary" class="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
					<Radio class="mr-1.5 h-3.5 w-3.5 animate-pulse" />
					Umami активен
				</Badge>
				{#if data.umamiHost}
					<a
						href={data.umamiHost}
						target="_blank"
						rel="external noopener noreferrer"
						class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
					>
						Панель
						<ExternalLink class="h-3 w-3" />
					</a>
				{/if}
			{:else}
				<Badge variant="outline" class="border-amber-500/30 bg-amber-500/10 text-amber-500">
					Umami не настроен
				</Badge>
			{/if}
		</div>
	</div>

	<!-- Summary Cards -->
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-5">
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

	<!-- Revenue -->
	<Card class="border-border/50">
		<CardHeader class="flex flex-row items-start justify-between gap-3">
			<div>
				<CardTitle class="flex items-center gap-2 text-base">
					<Wallet class="h-4 w-4 text-emerald-500" />
					Доходы от ручных донатов
				</CardTitle>
				<CardDescription
					>Суммы, по которым администратор выдал подписку. Boosty-платежи не импортируются.</CardDescription
				>
			</div>
			<div class="flex items-center gap-2">
				<Badge variant="outline"
					>{data.revenue.donationsCount} {donationWord(data.revenue.donationsCount)}</Badge
				>
				<Button variant="outline" size="sm" onclick={() => (donationsOpen = true)}
					>Все донаты</Button
				>
			</div>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div class="rounded-lg border border-border/60 bg-muted/20 p-3">
					<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
						Всего
					</p>
					<p class="mt-1 text-xl font-bold">{formatMoney(data.revenue.totalRub)} ₽</p>
				</div>
				<div class="rounded-lg border border-border/60 bg-muted/20 p-3">
					<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
						30 дней
					</p>
					<p class="mt-1 text-xl font-bold">{formatMoney(data.revenue.last30Rub)} ₽</p>
					<p class="text-[10px] text-muted-foreground">
						{data.revenue.last30Count}
						{donationWord(data.revenue.last30Count)}
					</p>
				</div>
				<div class="rounded-lg border border-border/60 bg-muted/20 p-3">
					<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
						Донатеров
					</p>
					<p class="mt-1 text-xl font-bold">{data.revenue.donors}</p>
				</div>
				<div class="rounded-lg border border-border/60 bg-muted/20 p-3">
					<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
						Средний донат
					</p>
					<p class="mt-1 text-xl font-bold">
						{data.revenue.donationsCount > 0
							? formatMoney(Math.round(data.revenue.totalRub / data.revenue.donationsCount))
							: '0'} ₽
					</p>
				</div>
			</div>
			{#if data.revenue.recent.length === 0}
				<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
					Пока нет ручных донатов.
				</div>
			{:else}
				<div class="overflow-hidden rounded-lg border border-border/60">
					<div
						class="grid grid-cols-[1fr_auto] gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase sm:grid-cols-[1.5fr_1fr_1fr_auto]"
					>
						<span>Пользователь</span><span class="hidden sm:block">Сумма</span><span
							class="hidden sm:block">Цена дня</span
						><span>Когда</span>
					</div>
					{#each recentDonations as donation (donation.id)}
						<div
							class="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-border/40 px-3 py-2 text-xs last:border-0 sm:grid-cols-[1.5fr_1fr_1fr_auto]"
						>
							<div class="min-w-0">
								<p class="truncate font-medium">
									{donation.userName || donation.userId || 'Удалённый донор'}
								</p>
								<p class="truncate text-[10px] text-muted-foreground">
									{donation.note || (donation.days != null ? donation.days + ' дней' : '')}
								</p>
							</div>
							<span class="hidden font-semibold sm:block">{formatMoney(donation.amountRub)} ₽</span>
							<span class="hidden text-muted-foreground sm:block"
								>{donation.pricePerDay != null ? donation.pricePerDay + ' ₽/день' : '—'}</span
							>
							<time
								class="text-right text-[10px] text-muted-foreground"
								datetime={String(donation.createdAt)}>{formatDateTime(donation.createdAt)}</time
							>
						</div>
					{/each}
				</div>
			{/if}
			<p class="text-[10px] text-muted-foreground">
				Ручной донат фиксируется в момент выдачи подписки. Изменение цены не переписывает
				исторические суммы.
			</p>
		</CardContent>
	</Card>

	<!-- Trend Chart / Activity -->
	<Card class="border-border/50">
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-base">
				<BarChart3 class="h-4 w-4 text-primary" />
				Динамика активности по дням
			</CardTitle>
			<CardDescription>
				Количество {useMinutes ? 'минут' : 'часов'} прослушивания за последние дни (daily_listening_stats).
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
						{#each chartRows as day (day.date)}
							{@const heightPercent = Math.max(8, Math.round((day.value / maxDailyValue) * 100))}
							<div
								class="group relative flex h-full min-w-[20px] flex-1 flex-col items-center justify-end"
							>
								<!-- Tooltip on hover -->
								<div
									class="pointer-events-none absolute -top-12 z-20 hidden rounded-md bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-md group-hover:block"
								>
									{day.date}: {day.value}
									{chartUnit} ({day.sessionsCount} сессий)
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
						<span>0 {chartUnit}</span>
						<span>Пик: {maxDailyValue} {chartUnit}/день</span>
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
						{#each data.topChapters as ch, i (`${ch.chapterId}:${ch.versionId}`)}
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
											{ch.bookTitle ?? ''} • {ch.sessionsCount} прослушиваний • {ch.versionId ===
											'default'
												? 'Новая версия'
												: 'Старая версия'}
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
										<div class="text-[11px] text-muted-foreground">
											{session.bookTitle} •
											{session.versionId === 'default' ? 'Новая версия' : 'Старая версия'}
										</div>
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
					{#if data.isUmamiConfigured}
						Umami подключен и собирает аналитику страниц и прослушиваний.
					{:else}
						Umami обеспечивает конфиденциальный сбор просмотров страниц и событий без использования
						cookie. Для включения добавьте переменную окружения <code>PUBLIC_UMAMI_WEBSITE_ID</code>
						в <code>.env</code>.
					{/if}
				</p>
			</div>
			<a
				href={data.isUmamiConfigured && data.umamiHost ? data.umamiHost : 'https://umami.is/docs'}
				target="_blank"
				rel="external noopener noreferrer"
				class="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
			>
				{data.isUmamiConfigured ? 'Панель управления Umami' : 'Документация Umami'}
				<ExternalLink class="h-3.5 w-3.5" />
			</a>
		</CardContent>
	</Card>
</div>

<BaseModal
	bind:open={donationsOpen}
	title="Все донаты"
	description="Фильтры, сортировка и поиск по финансовому ledger."
	widthClass="sm:max-w-4xl"
>
	<div class="space-y-4">
		<ListFilterBar
			bind:search={donationSearch}
			bind:period={donationPeriod}
			bind:source={donationSource}
			bind:sort={donationSort}
			searchPlaceholder="Имя, Telegram ID, примечание"
			sourceOptions={donationSourceOptions}
			sortOptions={donationSortOptions}
			resultCount={filteredDonations.length}
			totalCount={data.revenue.donationsCount}
		/>

		<div class="max-h-[55vh] overflow-y-auto rounded-lg border">
			<div
				class="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
			>
				<span>Пользователь</span><span>Сумма</span><span>Цена дня</span><span>Когда</span>
			</div>
			{#each filteredDonations as donation (donation.id)}
				<div
					class="grid grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-2 border-b border-border/40 px-3 py-2 text-xs last:border-0"
				>
					<div class="min-w-0">
						<p class="truncate font-medium">
							{donation.userName || donation.userId || 'Удалённый донор'}
						</p>
						<p class="truncate text-[10px] text-muted-foreground">{donation.note || 'Донат'}</p>
					</div>
					<span class="font-semibold">{formatMoney(donation.amountRub)} ₽</span>
					<span class="text-muted-foreground"
						>{donation.pricePerDay != null ? donation.pricePerDay + ' ₽/день' : '—'}</span
					>
					<time
						class="text-right text-[10px] text-muted-foreground"
						datetime={String(donation.createdAt)}>{formatDateTime(donation.createdAt)}</time
					>
				</div>
			{:else}
				<p class="p-6 text-center text-sm text-muted-foreground">Ничего не найдено</p>
			{/each}
		</div>
	</div>
	{#snippet footer()}
		<Button variant="outline" onclick={() => (donationsOpen = false)}>Закрыть</Button>
	{/snippet}
</BaseModal>
