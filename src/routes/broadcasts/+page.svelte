<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { ArrowRight, CalendarDays, Clock3, Play, Radio, Users } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const liveBroadcast = $derived(data.broadcasts.find((broadcast) => broadcast.kind === 'live'));
	const replays = $derived(data.broadcasts.filter((broadcast) => broadcast.kind === 'published'));
	const scheduledBroadcasts = $derived(
		data.broadcasts
			.filter((broadcast) => broadcast.kind === 'scheduled')
			.sort(
				(a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime()
			)
	);

	function formatDate(value: Date | string): string {
		return new Date(value).toLocaleDateString('ru-RU', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function formatDateTime(value: Date | string): string {
		return new Date(value).toLocaleString('ru-RU', {
			day: 'numeric',
			month: 'long',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Europe/Moscow'
		});
	}

	function formatDuration(seconds: number): string {
		const safe = Math.max(0, Math.floor(seconds));
		const hours = Math.floor(safe / 3600);
		const minutes = Math.floor((safe % 3600) / 60);
		return hours > 0 ? hours + ' ч ' + minutes + ' мин' : minutes + ' мин';
	}
</script>

<svelte:head><title>Трансляции — Hedgehog X</title></svelte:head>

<div class="layout-content space-y-8 py-8 md:py-12">
	<section
		class="relative overflow-hidden rounded-[2rem] border border-border/60 bg-[radial-gradient(circle_at_15%_20%,rgba(211,95,92,0.18),transparent_38%),radial-gradient(circle_at_85%_90%,rgba(16,185,129,0.13),transparent_35%)] p-6 md:p-10"
	>
		<div class="relative z-10 max-w-2xl">
			<div
				class="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[11px] font-bold tracking-wide text-red-500 uppercase"
			>
				<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"></span>
				Эфиры HEDGEHOG.INC
			</div>
			<h1 class="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">Трансляции</h1>
			<p class="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
				Прямые эфиры и записи с иллюстрациями по таймингу, чатом и возможностью продолжить
				прослушивание в плеере.
			</p>
			<div class="mt-6 flex flex-wrap gap-2">
				<span class="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs">
					<span class="font-bold text-foreground">{liveBroadcast ? '1' : '0'}</span>
					<span class="text-muted-foreground">сейчас в эфире</span>
				</span>
				<span class="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs">
					<span class="font-bold text-foreground">{scheduledBroadcasts.length}</span>
					<span class="text-muted-foreground">запланировано</span>
				</span>
				<span class="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs">
					<span class="font-bold text-foreground">{replays.length}</span>
					<span class="text-muted-foreground">записей</span>
				</span>
			</div>
		</div>
		<Radio
			class="pointer-events-none absolute -right-8 -bottom-12 h-56 w-56 text-foreground/[0.03]"
		/>
	</section>

	{#if liveBroadcast}
		<section class="space-y-3">
			<div class="flex items-center gap-2">
				<span class="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
				<h2 class="text-sm font-bold tracking-wide uppercase">Сейчас в эфире</h2>
			</div>
			<a
				href={resolve('/broadcasts/[id]', { id: liveBroadcast.id })}
				class="group block overflow-hidden rounded-3xl border border-red-500/30 bg-card shadow-[0_20px_80px_rgba(211,95,92,0.12)] transition hover:border-red-500/50"
			>
				<div class="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
					<div class="relative aspect-video overflow-hidden bg-muted lg:aspect-auto lg:min-h-80">
						{#if liveBroadcast.coverUrl}
							<img
								src={liveBroadcast.coverUrl}
								alt={liveBroadcast.title}
								class="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
								loading="eager"
							/>
						{:else}
							<div
								class="flex h-full min-h-64 items-center justify-center bg-linear-to-br from-red-500/20 to-background"
							>
								<Radio class="h-16 w-16 text-red-500/60" />
							</div>
						{/if}
						<div
							class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"
						></div>
						<span
							class="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold tracking-wide text-white uppercase shadow-lg"
						>
							<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
							Live
						</span>
					</div>
					<div class="flex flex-col justify-center p-5 md:p-7">
						<div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
							<span class="inline-flex items-center gap-1"
								><Users class="h-3.5 w-3.5" /> {liveBroadcast.listeners} слушают</span
							>
							<span class="text-border">•</span>
							<span class="inline-flex items-center gap-1"
								><Clock3 class="h-3.5 w-3.5" />
								{formatDuration(liveBroadcast.durationSeconds)}</span
							>
						</div>
						<h3 class="mt-3 line-clamp-2 text-xl font-bold tracking-tight md:text-2xl">
							{liveBroadcast.title}
						</h3>
						<p class="mt-1 text-xs text-muted-foreground">
							{liveBroadcast.bookTitle} · {liveBroadcast.volumeTitle} · {liveBroadcast.chapterTitle}
						</p>
						{#if liveBroadcast.description}
							<p class="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
								{liveBroadcast.description}
							</p>
						{/if}
						<span
							class="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition group-hover:bg-red-500"
						>
							<Play class="h-3.5 w-3.5 fill-current" /> Открыть эфир
						</span>
					</div>
				</div>
			</a>
		</section>
	{/if}

	{#if scheduledBroadcasts.length > 0}
		<section class="space-y-4">
			<div class="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 class="text-xl font-bold tracking-tight">Запланированные</h2>
					<p class="mt-1 text-xs text-muted-foreground">
						Скоро в эфире. Можно открыть страницу заранее и ждать начала.
					</p>
				</div>
				<Badge variant="outline">{scheduledBroadcasts.length}</Badge>
			</div>

			<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{#each scheduledBroadcasts as broadcast (broadcast.id)}
					<a
						href={resolve('/broadcasts/[id]', { id: broadcast.id })}
						class="group flex flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-card transition duration-300 hover:-translate-y-1 hover:border-amber-500/60 hover:shadow-xl"
					>
						<div class="relative aspect-video overflow-hidden bg-muted">
							{#if broadcast.coverUrl}
								<img
									src={broadcast.coverUrl}
									alt={broadcast.title}
									class="h-full w-full object-cover transition duration-700 group-hover:scale-105"
									loading="lazy"
								/>
							{:else}
								<div
									class="flex h-full items-center justify-center bg-linear-to-br from-amber-500/20 to-background"
								>
									<CalendarDays class="h-12 w-12 text-amber-500/60" />
								</div>
							{/if}
							<div
								class="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent"
							></div>
							<span
								class="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[9px] font-bold tracking-wide text-amber-950 uppercase shadow-lg"
							>
								<CalendarDays class="h-3 w-3" /> Скоро
							</span>
							<span
								class="absolute right-3 bottom-3 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md"
								>{formatDateTime(broadcast.scheduledStartAt)}</span
							>
						</div>
						<div class="flex flex-1 flex-col p-4">
							<h3 class="line-clamp-2 text-sm leading-snug font-bold">{broadcast.title}</h3>
							<p class="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
								{broadcast.bookTitle} · {broadcast.volumeTitle} · {broadcast.chapterTitle}
							</p>
							<div
								class="mt-auto flex items-center justify-between gap-2 pt-4 text-[10px] text-muted-foreground"
							>
								<span class="inline-flex items-center gap-1"
									><Users class="h-3 w-3" /> {broadcast.listeners} на странице</span
								>
								<span
									class="inline-flex items-center gap-1 font-semibold text-amber-600 opacity-0 transition group-hover:opacity-100 dark:text-amber-400"
									>Открыть <ArrowRight class="h-3 w-3" /></span
								>
							</div>
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<section class="space-y-4">
		<div class="flex flex-wrap items-end justify-between gap-2">
			<div>
				<h2 class="text-xl font-bold tracking-tight">Записи эфиров</h2>
				<p class="mt-1 text-xs text-muted-foreground">
					Слушайте в любое время, продолжайте с любого места.
				</p>
			</div>
			{#if replays.length > 0}<Badge variant="outline">{replays.length}</Badge>{/if}
		</div>

		{#if replays.length === 0}
			<div class="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
				<Radio class="mx-auto h-9 w-9 text-muted-foreground/50" />
				<p class="mt-3 text-sm font-medium">Записей пока нет</p>
				<p class="mt-1 text-xs text-muted-foreground">
					Первая запись появится здесь после завершения эфира.
				</p>
			</div>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{#each replays as broadcast (broadcast.id)}
					<a
						href={resolve('/broadcasts/[id]', { id: broadcast.id })}
						class="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl"
					>
						<div class="relative aspect-video overflow-hidden bg-muted">
							{#if broadcast.coverUrl}
								<img
									src={broadcast.coverUrl}
									alt={broadcast.title}
									class="h-full w-full object-cover transition duration-700 group-hover:scale-105"
									loading="lazy"
								/>
							{:else}
								<div
									class="flex h-full items-center justify-center bg-linear-to-br from-primary/15 to-background"
								>
									<Radio class="h-12 w-12 text-primary/50" />
								</div>
							{/if}
							<div
								class="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent"
							></div>
							<span
								class="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[9px] font-bold tracking-wide text-white uppercase backdrop-blur-md"
							>
								<Play class="h-3 w-3 fill-current" /> Replay
							</span>
							<span
								class="absolute right-3 bottom-3 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md"
								>{formatDuration(broadcast.durationSeconds)}</span
							>
							<span
								class="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100"
							>
								<span
									class="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black shadow-xl"
								>
									<Play class="ml-0.5 h-5 w-5 fill-current" />
								</span>
							</span>
						</div>
						<div class="flex flex-1 flex-col p-4">
							<h3 class="line-clamp-2 text-sm leading-snug font-bold">{broadcast.title}</h3>
							<p class="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
								{broadcast.bookTitle} · {broadcast.volumeTitle} · {broadcast.chapterTitle}
							</p>
							{#if broadcast.description}
								<p class="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
									{broadcast.description}
								</p>
							{/if}
							<div
								class="mt-auto flex items-center justify-between gap-2 pt-4 text-[10px] text-muted-foreground"
							>
								<span class="inline-flex items-center gap-1"
									><CalendarDays class="h-3 w-3" />
									{formatDate(
										broadcast.publishedAt ?? broadcast.endedAt ?? broadcast.scheduledStartAt
									)}</span
								>
								<span
									class="inline-flex items-center gap-1 font-semibold text-primary opacity-0 transition group-hover:opacity-100"
									>Смотреть <ArrowRight class="h-3 w-3" /></span
								>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>
