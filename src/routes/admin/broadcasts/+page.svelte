<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import ImageField from '$lib/components/admin/content/ImageField.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		Activity,
		BarChart3,
		CalendarClock,
		CheckCircle2,
		Eye,
		Heart,
		Image as ImageIcon,
		MessageCircle,
		Pencil,
		Play,
		Plus,
		Radio,
		Send,
		Square,
		Trash2,
		Users
	} from '@lucide/svelte';
	import { formatMoscowDateTime, formatMoscowLocalDateTimeInput } from '$lib/utils/time';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let editingId = $state<string | null>(null);
	let title = $state('');
	let chapterId = $state('');
	let scheduledStartAt = $state('');
	let coverUrl = $state('');
	let description = $state('');
	let saveRecording = $state(true);
	let publishAfterEnd = $state(true);
	let chatEnabled = $state(true);
	let submitting = $state(false);
	let formOpen = $state(false);
	let activeFilter = $state<'all' | 'live' | 'scheduled' | 'ended'>('all');

	function toLocalInput(date: Date): string {
		return formatMoscowLocalDateTimeInput(date);
	}

	function defaultStart(): string {
		return toLocalInput(new Date(Date.now() + 60 * 60 * 1000));
	}

	function resetForm() {
		editingId = null;
		title = '';
		chapterId = '';
		scheduledStartAt = defaultStart();
		coverUrl = '';
		description = '';
		saveRecording = true;
		publishAfterEnd = true;
		chatEnabled = true;
		formOpen = false;
	}

	function startCreate() {
		resetForm();
		formOpen = true;
		void tick().then(() =>
			document
				.getElementById('broadcast-editor')
				?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		);
	}

	function editBroadcast(row: PageData['broadcasts'][number]) {
		editingId = row.id;
		title = row.title;
		chapterId = row.chapterId;
		scheduledStartAt = toLocalInput(new Date(row.scheduledStartAt));
		coverUrl = row.coverUrl ?? '';
		description = row.description ?? '';
		saveRecording = row.saveRecording;
		publishAfterEnd = row.publishAfterEnd;
		chatEnabled = row.chatEnabled;
		formOpen = true;
	}

	function broadcastElapsed(row: PageData['broadcasts'][number]): number {
		const start = row.startedAt ? new Date(row.startedAt).getTime() : 0;
		if (!start) return 0;
		const end = row.endedAt ? new Date(row.endedAt).getTime() : Date.now();
		return Math.max(0, Math.min(row.durationSeconds, (end - start) / 1000));
	}

	function formatDurationShort(seconds: number): string {
		const safe = Math.max(0, Math.floor(seconds));
		const h = Math.floor(safe / 3600);
		const m = Math.floor((safe % 3600) / 60);
		return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m} мин`;
	}

	const liveCount = $derived(data.broadcasts.filter((row) => row.kind === 'live').length);
	const scheduledCount = $derived(data.broadcasts.filter((row) => row.kind === 'scheduled').length);
	const endedCount = $derived(
		data.broadcasts.filter((row) => row.kind === 'ended' || row.kind === 'published').length
	);
	const totalViews = $derived(data.broadcasts.reduce((sum, row) => sum + row.views, 0));
	const totalViewers = $derived(data.broadcasts.reduce((sum, row) => sum + row.uniqueViewers, 0));
	const totalMessages = $derived(data.broadcasts.reduce((sum, row) => sum + row.messageCount, 0));
	const filteredBroadcasts = $derived(
		data.broadcasts.filter((row) => {
			if (activeFilter === 'all') return true;
			if (activeFilter === 'ended') return row.kind === 'ended' || row.kind === 'published';
			return row.kind === activeFilter;
		})
	);

	function viewerNames(row: PageData['broadcasts'][number]): string {
		const names = row.viewers.map((viewer) => viewer.name);
		return names.length > 6
			? names.slice(0, 6).join(', ') + ` и ещё ${names.length - 6}`
			: names.join(', ');
	}

	function statusLabel(kind: string): string {
		if (kind === 'live') return 'В эфире';
		if (kind === 'published') return 'Опубликована';
		if (kind === 'ended') return 'Завершена';
		return 'Запланирована';
	}

	function statusClass(kind: string): string {
		if (kind === 'live') return 'border-red-500/30 bg-red-500/10 text-red-600';
		if (kind === 'published') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600';
		if (kind === 'ended') return 'border-amber-500/30 bg-amber-500/10 text-amber-600';
		return 'border-sky-500/30 bg-sky-500/10 text-sky-600';
	}

	function formatDate(value: Date | string | null): string {
		return formatMoscowDateTime(value);
	}

	resetForm();
</script>

<svelte:head><title>Трансляции | Hedgehog Admin</title></svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<div class="flex items-center gap-2">
				<Radio class="h-5 w-5 text-primary" />
				<h1 class="text-2xl font-bold tracking-tight">Трансляции</h1>
			</div>
			<p class="mt-1 text-sm text-muted-foreground">
				Планирование прямых эфиров, чат, запись и публикация replay.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<Button size="sm" class="gap-1.5" onclick={startCreate}
				><Plus class="h-4 w-4" /> Новая трансляция</Button
			>
			<Button variant="outline" href="/admin">Назад</Button>
		</div>
	</header>

	{#if form?.error}
		<div
			class="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
			role="alert"
		>
			{form.error}
		</div>
	{:else if form?.success}
		<div
			class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
			role="status"
		>
			{form.message ?? 'Сохранено'}
		</div>
	{/if}

	<section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
		<Card class="border-red-500/20 bg-red-500/[0.03]">
			<CardContent class="flex items-center gap-3 p-4">
				<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500"
					><Activity class="h-4 w-4" /></span
				>
				<div>
					<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
						Сейчас в эфире
					</p>
					<p class="text-xl font-bold">{liveCount}</p>
				</div>
			</CardContent>
		</Card>
		<Card>
			<CardContent class="flex items-center gap-3 p-4">
				<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500"
					><CalendarClock class="h-4 w-4" /></span
				>
				<div>
					<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
						Запланировано
					</p>
					<p class="text-xl font-bold">{scheduledCount}</p>
				</div>
			</CardContent>
		</Card>
		<Card>
			<CardContent class="flex items-center gap-3 p-4">
				<span
					class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"
					><CheckCircle2 class="h-4 w-4" /></span
				>
				<div>
					<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
						Завершено
					</p>
					<p class="text-xl font-bold">{endedCount}</p>
				</div>
			</CardContent>
		</Card>
		<Card>
			<CardContent class="flex items-center gap-3 p-4">
				<span
					class="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500"
					><BarChart3 class="h-4 w-4" /></span
				>
				<div>
					<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
						Зрители / просмотры
					</p>
					<p class="text-xl font-bold">{totalViewers} / {totalViews}</p>
					<p class="text-[10px] text-muted-foreground">{totalMessages} сообщений</p>
				</div>
			</CardContent>
		</Card>
	</section>
	<div class="flex flex-wrap items-center gap-2">
		{#each [['all', 'Все', data.broadcasts.length], ['live', 'В эфире', liveCount], ['scheduled', 'Запланированные', scheduledCount], ['ended', 'Завершённые', endedCount]] as [key, label, value] (key)}
			<button
				type="button"
				class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition {activeFilter ===
				key
					? 'border-primary bg-primary/10 text-primary'
					: 'border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground'}"
				onclick={() => (activeFilter = key as typeof activeFilter)}
				>{label}<span class="rounded-full bg-background/60 px-1.5 py-0.5 text-[9px] font-bold"
					>{value}</span
				></button
			>
		{/each}
	</div>

	{#if formOpen}
		<Card id="broadcast-editor" class="border-border/60">
			<CardHeader class="pb-3">
				<CardTitle class="flex items-center gap-2 text-base">
					{#if editingId}<Pencil class="h-4 w-4" /> Редактировать трансляцию{:else}<Plus
							class="h-4 w-4"
						/> Новая трансляция{/if}
				</CardTitle>
				<CardDescription>Новая глава остаётся скрытой до старта эфира.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					method="POST"
					action="?/saveBroadcast"
					enctype="multipart/form-data"
					use:enhance={() => {
						submitting = true;
						return async ({ update, result }) => {
							await update({ reset: false });
							submitting = false;
							if (result.type === 'success') resetForm();
						};
					}}
					class="space-y-4"
				>
					<input type="hidden" name="id" value={editingId ?? ''} />
					<input type="hidden" name="saveRecording" value={String(saveRecording)} />
					<input type="hidden" name="publishAfterEnd" value={String(publishAfterEnd)} />
					<input type="hidden" name="chatEnabled" value={String(chatEnabled)} />
					<div class="grid gap-3 md:grid-cols-2">
						<div class="space-y-1.5">
							<Label for="broadcast-title">Название</Label>
							<Input
								id="broadcast-title"
								name="title"
								bind:value={title}
								maxlength={255}
								required
							/>
						</div>
						<div class="space-y-1.5">
							<Label for="broadcast-start">Начало</Label>
							<Input
								id="broadcast-start"
								name="scheduledStartAt"
								type="datetime-local"
								bind:value={scheduledStartAt}
								required
							/>
						</div>
						<div class="space-y-1.5 md:col-span-2">
							<Label for="broadcast-chapter">Глава</Label>
							<select
								id="broadcast-chapter"
								name="chapterId"
								bind:value={chapterId}
								class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary"
								required
							>
								<option value="">Выберите главу</option>
								{#each data.chapters as chapter (chapter.id)}
									<option value={chapter.id}
										>{chapter.bookTitle} · {chapter.volumeTitle} · {chapter.title}{chapter.published
											? ''
											: ' (скрыта)'}</option
									>
								{/each}
							</select>
						</div>
						<div class="space-y-1.5 md:col-span-2">
							<ImageField
								urlField="coverUrl"
								bind:value={coverUrl}
								label="Обложка"
								hint="Обложка выбирается из R2 storage."
								aspect="wide"
							/>
						</div>
						<div class="space-y-1.5">
							<Label for="broadcast-description">Описание</Label>
							<Textarea
								id="broadcast-description"
								name="description"
								bind:value={description}
								rows={2}
								maxlength={4000}
							/>
						</div>
					</div>

					<div class="grid gap-2 rounded-xl border bg-muted/20 p-4 sm:grid-cols-3">
						<label class="flex items-center justify-between gap-2 text-xs"
							><span>Сохранять запись</span><Switch bind:checked={saveRecording} /></label
						>
						<label class="flex items-center justify-between gap-2 text-xs"
							><span>Публиковать после эфира</span><Switch
								bind:checked={publishAfterEnd}
								disabled={!saveRecording}
							/></label
						>
						<label class="flex items-center justify-between gap-2 text-xs"
							><span>Чат включён</span><Switch bind:checked={chatEnabled} /></label
						>
					</div>

					<div class="flex flex-wrap gap-2">
						<Button type="submit" size="sm" disabled={submitting} class="gap-1.5"
							><Send class="h-4 w-4" /> {editingId ? 'Сохранить' : 'Создать'}</Button
						>
						<Button type="button" variant="outline" size="sm" onclick={resetForm}>Отмена</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	{/if}

	<Card class="border-border/60">
		<CardHeader class="flex flex-row items-start justify-between gap-3 pb-3">
			<div>
				<CardTitle class="text-base">Трансляции</CardTitle>
				<CardDescription>Эфир, зрители, чат и записи — в одном списке.</CardDescription>
			</div>
			<Badge variant="outline">{filteredBroadcasts.length}</Badge>
		</CardHeader>
		<CardContent class="space-y-3">
			{#if data.broadcasts.length === 0}
				<div class="rounded-xl border border-dashed p-8 text-center">
					<Radio class="mx-auto h-8 w-8 text-muted-foreground/50" />
					<p class="mt-2 text-sm text-muted-foreground">Трансляций пока нет. Создайте первую.</p>
				</div>
			{:else if filteredBroadcasts.length === 0}
				<div class="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
					В этом разделе пока пусто.
				</div>
			{/if}
			{#each filteredBroadcasts as row (row.id)}
				{@const elapsed = broadcastElapsed(row)}
				<article
					class="rounded-2xl border border-border/60 bg-card p-4 transition hover:border-border"
				>
					<div class="flex flex-col gap-4 xl:flex-row">
						<div class="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-muted xl:w-44">
							{#if row.coverUrl}<img
									src={row.coverUrl}
									alt={row.title}
									class="h-full w-full object-cover"
									loading="lazy"
								/>{:else}<div class="flex h-full items-center justify-center">
									<Radio class="h-8 w-8 text-muted-foreground/50" />
								</div>{/if}
						</div>
						<div class="min-w-0 flex-1 space-y-3">
							<div class="flex flex-wrap items-start justify-between gap-2">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<h3 class="truncate text-sm font-semibold">{row.title}</h3>
										<Badge variant="outline" class={statusClass(row.kind)}
											>{statusLabel(row.kind)}</Badge
										>
										{#if row.publishedAt}<Badge variant="secondary">Replay</Badge>{/if}
										{#if row.chatEnabled}<Badge variant="outline" class="gap-1"
												><MessageCircle class="h-3 w-3" /> Чат</Badge
											>{/if}
									</div>
									<p class="mt-1 text-xs text-muted-foreground">
										{row.bookTitle} · {row.volumeTitle} · {row.chapterTitle}
									</p>
									<p class="mt-1 text-[10px] text-muted-foreground">
										Начало: {formatDate(row.scheduledStartAt)}{#if row.endedAt}
											· Конец: {formatDate(row.endedAt)}{/if} · {formatDurationShort(
											row.durationSeconds
										)}
									</p>
								</div>
								<div class="flex shrink-0 items-center gap-1.5">
									<Button
										type="button"
										variant="outline"
										size="sm"
										class="h-7 gap-1 px-2 text-[11px]"
										onclick={() => editBroadcast(row)}><Pencil class="h-3 w-3" /> Изменить</Button
									>
								</div>
							</div>

							{#if row.kind === 'live'}
								<div class="space-y-1.5 rounded-xl bg-red-500/[0.04] p-2.5">
									<div class="flex justify-between text-[10px] text-muted-foreground">
										<span>{formatDurationShort(elapsed)} прошло</span><span
											>{formatDurationShort(Math.max(0, row.durationSeconds - elapsed))} осталось</span
										>
									</div>
									<div class="h-1.5 overflow-hidden rounded-full bg-muted">
										<div
											class="h-full bg-red-500 transition-[width]"
											style={`width: ${Math.min(100, (elapsed / Math.max(1, row.durationSeconds)) * 100)}%`}
										></div>
									</div>
								</div>
							{/if}

							<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
								<div class="rounded-lg bg-muted/40 p-2">
									<p class="flex items-center gap-1 text-[9px] text-muted-foreground uppercase">
										{#if row.kind === 'live'}<Activity class="h-3 w-3" /> Сейчас слушают{:else}<Users
												class="h-3 w-3"
											/> Уникальные{/if}
									</p>
									<p class="text-sm font-bold">
										{row.kind === 'live' ? row.listeners : row.uniqueViewers}
									</p>
								</div>
								<div class="rounded-lg bg-muted/40 p-2">
									<p class="flex items-center gap-1 text-[9px] text-muted-foreground uppercase">
										<Eye class="h-3 w-3" /> Просмотры
									</p>
									<p class="text-sm font-bold">{row.views}</p>
								</div>
								<div class="rounded-lg bg-muted/40 p-2">
									<p class="flex items-center gap-1 text-[9px] text-muted-foreground uppercase">
										<MessageCircle class="h-3 w-3" /> Сообщения
									</p>
									<p class="text-sm font-bold">{row.messageCount}</p>
								</div>
								<div class="rounded-lg bg-muted/40 p-2">
									<p class="flex items-center gap-1 text-[9px] text-muted-foreground uppercase">
										<Heart class="h-3 w-3" /> Реакции
									</p>
									<p class="text-sm font-bold">{row.reactionCount}</p>
								</div>
								<div class="rounded-lg bg-muted/40 p-2">
									<p class="flex items-center gap-1 text-[9px] text-muted-foreground uppercase">
										<ImageIcon class="h-3 w-3" /> Иллюстрации
									</p>
									<p class="text-sm font-bold">{row.illustrationCount}</p>
								</div>
							</div>

							{#if row.kind === 'live' && row.people.length > 0}
								<div class="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
									<span>Сейчас:</span>{#each row.people as person (person.id)}<span
											class="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600"
											>{person.name}</span
										>{/each}
								</div>
							{/if}
							{#if row.viewers.length > 0}
								<details class="text-[10px] text-muted-foreground">
									<summary class="cursor-pointer font-medium" title={viewerNames(row)}
										>Смотрели: {row.uniqueViewers}</summary
									>
									<div class="mt-1.5 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
										{#each row.viewers as viewer (viewer.id)}<span
												class="rounded-full bg-muted px-2 py-0.5">{viewer.name}</span
											>{/each}
									</div>
								</details>
							{/if}

							<div class="flex flex-wrap gap-1.5 pt-1">
								{#if row.kind === 'scheduled'}
									<form method="POST" action="?/startBroadcast" use:enhance>
										<input type="hidden" name="id" value={row.id} /><Button
											type="submit"
											size="sm"
											variant="secondary"
											class="h-7 gap-1 px-2 text-[11px]"><Play class="h-3 w-3" /> Начать</Button
										>
									</form>
								{/if}
								{#if row.kind === 'live'}
									<form method="POST" action="?/endBroadcast" use:enhance>
										<input type="hidden" name="id" value={row.id} /><Button
											type="submit"
											size="sm"
											variant="outline"
											class="h-7 gap-1 px-2 text-[11px]"
											><Square class="h-3 w-3" /> Завершить</Button
										>
									</form>
								{/if}
								{#if row.kind === 'ended' && row.saveRecording && !row.publishedAt}
									<form method="POST" action="?/publishBroadcast" use:enhance>
										<input type="hidden" name="id" value={row.id} /><Button
											type="submit"
											size="sm"
											class="h-7 gap-1 px-2 text-[11px]"
											><Send class="h-3 w-3" /> Опубликовать</Button
										>
									</form>
								{/if}
								<form method="POST" action="?/deleteBroadcast" use:enhance>
									<input type="hidden" name="id" value={row.id} /><Button
										type="submit"
										variant="ghost"
										size="sm"
										class="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-destructive"
										><Trash2 class="h-3 w-3" /> Удалить</Button
									>
								</form>
							</div>
						</div>
					</div>
				</article>
			{/each}
		</CardContent>
	</Card>
</div>
