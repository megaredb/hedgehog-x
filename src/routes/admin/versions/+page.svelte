<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import type { SubmitFunction } from './$types';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { PaginationBar } from '$lib/components/ui/pagination';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import ConfirmModal from '$lib/components/overlay/ConfirmModal.svelte';
	import { cn } from '$lib/utils';
	import { formatDuration } from '$lib/utils/time';
	import {
		Archive,
		ArrowUpToLine,
		AudioLines,
		ChevronLeft,
		ChevronRight,
		CircleCheck,
		Clock,
		Disc3,
		ExternalLink,
		Info,
		Layers,
		ListMusic,
		MessageSquare,
		Music,
		Pencil,
		Play,
		Plus,
		RotateCcw,
		Search,
		Trash2,
		TriangleAlert,
		Upload,
		X
	} from '@lucide/svelte';

	let { data, form } = $props();

	type TrackRow = (typeof data.tracks)[number];
	type Flash = { kind: 'success' | 'error'; text: string };

	const PAGE_SIZE = 10;

	let tab = $state('chapters');
	let search = $state('');
	let bookFilter = $state('all');
	let volumeFilter = $state('all');
	let archiveState = $state('all');
	let listPage = $state(1);
	let selectedChapterId = $state('');
	let archiveSearch = $state('');
	let archiveVersion = $state('all');
	let archiveKind = $state('all');
	let archivePage = $state(1);
	let showArchiveForm = $state(false);
	let pending = $state<string | null>(null);
	let message = $state<Flash | null>(null);
	let enhancedSubmit = $state(false);
	let hiddenServerFlash = $state(false);
	let promoteTarget = $state<TrackRow | null>(null);
	let promoteOpen = $state(false);
	let deleteTarget = $state<TrackRow | null>(null);
	let deleteOpen = $state(false);
	let promoteFormEl: HTMLFormElement | null = $state(null);
	let deleteFormEl: HTMLFormElement | null = $state(null);
	let currentFileLabel = $state('');
	let archiveFileLabel = $state('');

	let messageTimer: ReturnType<typeof setTimeout> | undefined;
	let messageVersion = 0;
	let lastChapterId = '';

	const isBusy = $derived(pending !== null);
	const versionsById = $derived(
		new Map(data.versions.map((version) => [version.id, version] as const))
	);

	const tracksByChapter = $derived.by(() => {
		const map: Record<string, TrackRow[]> = Object.create(null);
		for (const track of data.tracks) {
			const list = map[track.chapterId];
			if (list) list.push(track);
			else map[track.chapterId] = [track];
		}
		return map;
	});

	const booksList = $derived.by(() => {
		const map: Record<string, string> = Object.create(null);
		for (const chapter of data.chapters) map[chapter.bookId] = chapter.bookTitle;
		return Object.entries(map).map(([id, title]) => ({ id, title }));
	});

	const volumesList = $derived.by(() => {
		const map: Record<string, { id: string; number: number; title: string }> = Object.create(null);
		for (const chapter of data.chapters) {
			if (bookFilter !== 'all' && chapter.bookId !== bookFilter) continue;
			map[chapter.volumeId] = {
				id: chapter.volumeId,
				number: chapter.volumeNumber,
				title: chapter.volumeTitle
			};
		}
		return Object.values(map).sort((a, b) => a.number - b.number || a.title.localeCompare(b.title));
	});

	const filteredChapters = $derived.by(() => {
		const needle = search.trim().toLowerCase();
		return data.chapters.filter((chapter) => {
			if (bookFilter !== 'all' && chapter.bookId !== bookFilter) return false;
			if (volumeFilter !== 'all' && chapter.volumeId !== volumeFilter) return false;
			const hasArchive = (tracksByChapter[chapter.id]?.length ?? 0) > 0;
			if (archiveState === 'with' && !hasArchive) return false;
			if (archiveState === 'without' && hasArchive) return false;
			if (!needle) return true;
			return (
				chapter.title.toLowerCase().includes(needle) ||
				chapter.bookTitle.toLowerCase().includes(needle) ||
				chapter.volumeTitle.toLowerCase().includes(needle) ||
				String(chapter.chapterNumber).includes(needle)
			);
		});
	});

	const chapterPageCount = $derived(Math.max(1, Math.ceil(filteredChapters.length / PAGE_SIZE)));
	const safeListPage = $derived(Math.min(listPage, chapterPageCount));
	const paginatedChapters = $derived(
		filteredChapters.slice((safeListPage - 1) * PAGE_SIZE, safeListPage * PAGE_SIZE)
	);

	const activeChapter = $derived(
		filteredChapters.find((chapter) => chapter.id === selectedChapterId) ??
			filteredChapters[0] ??
			null
	);
	const activeTracks = $derived(activeChapter ? (tracksByChapter[activeChapter.id] ?? []) : []);

	const archiveChapterCount = $derived(new Set(data.tracks.map((track) => track.chapterId)).size);
	const combinedTrackCount = $derived(
		data.tracks.filter((track) => track.chapterStart !== track.chapterEnd).length
	);

	const stats = $derived([
		{
			label: 'Глав в каталоге',
			value: data.chapters.length,
			icon: Disc3,
			tone: 'text-blue-500'
		},
		{
			label: 'С архивной версией',
			value: archiveChapterCount,
			icon: Archive,
			tone: 'text-amber-500'
		},
		{
			label: 'Архивных дорожек',
			value: data.tracks.length,
			icon: Layers,
			tone: 'text-violet-500'
		},
		{
			label: 'Объединённых файлов',
			value: combinedTrackCount,
			icon: AudioLines,
			tone: 'text-emerald-500'
		}
	]);

	const archiveVersionOptions = $derived.by(() => {
		const options = data.versions
			.filter((version) => version.id !== 'default')
			.map((version) => ({ id: version.id, label: version.label }));
		if (!options.some((option) => option.id === 'old')) {
			options.unshift({ id: 'old', label: 'Старая версия' });
		}
		return options;
	});

	const trackVersionOptions = $derived.by(() => {
		const ids = new Set(data.tracks.map((track) => track.versionId));
		return Array.from(ids, (id) => ({ id, label: versionLabel(id) })).sort((a, b) =>
			a.label.localeCompare(b.label)
		);
	});

	const filteredTracks = $derived.by(() => {
		const needle = archiveSearch.trim().toLowerCase();
		return data.tracks.filter((track) => {
			if (archiveVersion !== 'all' && track.versionId !== archiveVersion) return false;
			if (archiveKind === 'single' && track.chapterStart !== track.chapterEnd) return false;
			if (archiveKind === 'combined' && track.chapterStart === track.chapterEnd) return false;
			if (!needle) return true;
			return (
				track.title.toLowerCase().includes(needle) ||
				track.chapterTitle.toLowerCase().includes(needle) ||
				track.bookTitle.toLowerCase().includes(needle) ||
				track.volumeTitle.toLowerCase().includes(needle) ||
				String(track.chapterNumber).includes(needle)
			);
		});
	});

	const archivePageCount = $derived(Math.max(1, Math.ceil(filteredTracks.length / PAGE_SIZE)));
	const safeArchivePage = $derived(Math.min(archivePage, archivePageCount));
	const paginatedTracks = $derived(
		filteredTracks.slice((safeArchivePage - 1) * PAGE_SIZE, safeArchivePage * PAGE_SIZE)
	);

	const flash = $derived.by<Flash | null>(() => {
		if (message) return message;
		if (enhancedSubmit || hiddenServerFlash) return null;
		if (form?.error) return { kind: 'error', text: String(form.error) };
		if (form?.success) return { kind: 'success', text: 'Изменения сохранены.' };
		return null;
	});

	const archiveCountLabel = $derived(
		filteredTracks.length === data.tracks.length
			? String(data.tracks.length)
			: filteredTracks.length + ' из ' + data.tracks.length
	);

	function versionLabel(versionId: string): string {
		const version = versionsById.get(versionId);
		if (version) return version.label;
		return versionId === 'old' ? 'Старая версия' : versionId;
	}

	function rangeLabel(track: TrackRow): string {
		return track.chapterStart === track.chapterEnd
			? 'Глава ' + track.chapterStart
			: 'Главы ' + track.chapterStart + '–' + track.chapterEnd;
	}

	function fileName(url: string): string {
		if (!url) return '—';
		try {
			const parsed = new URL(url, 'http://local');
			const name = decodeURIComponent(parsed.pathname.split('/').pop() ?? '');
			return name || url;
		} catch {
			return url;
		}
	}

	function formatBytes(bytes: number): string {
		if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
		const megabytes = bytes / (1024 * 1024);
		if (megabytes >= 1) return megabytes.toFixed(megabytes >= 10 ? 0 : 1) + ' МБ';
		return Math.max(1, Math.round(bytes / 1024)) + ' КБ';
	}

	function formatDate(value: Date | string | null): string {
		if (!value) return '';
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	function promoteDisabled(track: TrackRow): boolean {
		return track.chapterStart !== track.chapterEnd || track.audioUrl === track.chapterAudioUrl;
	}

	function promoteTitle(track: TrackRow): string {
		if (track.chapterStart !== track.chapterEnd) return 'Объединённый файл нельзя сделать основной';
		if (track.audioUrl === track.chapterAudioUrl)
			return 'Эта версия ссылается на текущий файл главы';
		return 'Сделать эту версию основной';
	}

	function showMessage(next: Flash) {
		const version = ++messageVersion;
		message = next;
		clearTimeout(messageTimer);
		if (next.kind === 'success') {
			messageTimer = setTimeout(() => {
				if (messageVersion === version) message = null;
			}, 6000);
		}
	}

	function describeFile(event: Event, target: 'current' | 'archive') {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		const label = file ? file.name + ' · ' + formatBytes(file.size) : '';
		if (target === 'current') currentFileLabel = label;
		else archiveFileLabel = label;
	}

	function clearFileInput(formElement: HTMLFormElement, name: string) {
		const input = formElement.elements.namedItem(name);
		if (input instanceof HTMLInputElement) input.value = '';
	}

	function makeEnhance(
		key: string,
		successText: string,
		onSuccess?: (formElement: HTMLFormElement) => void
	): SubmitFunction {
		return () => {
			enhancedSubmit = true;
			pending = key;
			return async ({ result, update, formElement }) => {
				pending = null;
				if (result.type === 'success') {
					showMessage({ kind: 'success', text: successText });
					onSuccess?.(formElement);
				} else if (result.type === 'failure') {
					const failure = result.data as { error?: string } | undefined;
					showMessage({
						kind: 'error',
						text:
							failure?.error ??
							'Не удалось сохранить изменения. Проверьте поля и повторите попытку.'
					});
				} else if (result.type === 'error') {
					showMessage({ kind: 'error', text: 'Ошибка сервера. Попробуйте ещё раз.' });
				}
				await update({ reset: false });
			};
		};
	}

	const currentEnhance = makeEnhance('current', 'Новая версия сохранена.', (formElement) => {
		clearFileInput(formElement, 'audioFile');
		currentFileLabel = '';
	});

	function keepActiveChapterVisible() {
		if (!activeChapter) return;
		const index = data.chapters.findIndex((chapter) => chapter.id === activeChapter.id);
		if (index >= 0) listPage = Math.floor(index / PAGE_SIZE) + 1;
	}

	const archiveEnhance = makeEnhance('archive', 'Архивная версия добавлена.', (formElement) => {
		clearFileInput(formElement, 'audioFile');
		archiveFileLabel = '';
		showArchiveForm = false;
		if (archiveState === 'without') {
			archiveState = 'all';
			keepActiveChapterVisible();
		}
	});

	const snapshotEnhance = makeEnhance('snapshot', 'Текущая озвучка сохранена в архив.', () => {
		if (archiveState === 'without') {
			archiveState = 'all';
			keepActiveChapterVisible();
		}
	});

	const promoteEnhance = makeEnhance(
		'promote',
		'Версия стала основной. Прежняя озвучка сохранена в архиве.',
		() => {
			promoteTarget = null;
		}
	);

	const deleteEnhance = makeEnhance('delete', 'Архивная версия удалена.', () => {
		deleteTarget = null;
		if (archiveState === 'with') {
			archiveState = 'all';
			keepActiveChapterVisible();
		}
	});

	$effect(() => {
		const chapterId = activeChapter?.id ?? '';
		if (chapterId === lastChapterId) return;
		lastChapterId = chapterId;
		currentFileLabel = '';
		archiveFileLabel = '';
	});

	function scrollToDetailOnMobile() {
		if (typeof window === 'undefined') return;
		if (!window.matchMedia('(max-width: 1023px)').matches) return;
		void tick().then(() => {
			document
				.getElementById('chapter-detail')
				?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	}

	function selectChapter(chapterId: string) {
		selectedChapterId = chapterId;
		message = null;
		scrollToDetailOnMobile();
	}

	function resetFilters() {
		search = '';
		bookFilter = 'all';
		volumeFilter = 'all';
		archiveState = 'all';
		listPage = 1;
	}

	function resetArchiveFilters() {
		archiveSearch = '';
		archiveVersion = 'all';
		archiveKind = 'all';
		archivePage = 1;
	}

	function openChapterFromArchive(track: TrackRow) {
		search = '';
		bookFilter = 'all';
		volumeFilter = 'all';
		archiveState = 'all';
		selectedChapterId = track.chapterId;
		const index = data.chapters.findIndex((chapter) => chapter.id === track.chapterId);
		listPage = index === -1 ? 1 : Math.floor(index / PAGE_SIZE) + 1;
		tab = 'chapters';
		message = null;
		scrollToDetailOnMobile();
	}

	function openPromote(track: TrackRow) {
		if (promoteDisabled(track) || isBusy) return;
		promoteTarget = track;
		promoteOpen = true;
	}

	function confirmPromote() {
		if (!promoteTarget || isBusy) return;
		promoteFormEl?.requestSubmit();
		promoteOpen = false;
	}

	function openDelete(track: TrackRow) {
		if (isBusy) return;
		deleteTarget = track;
		deleteOpen = true;
	}

	function confirmDelete() {
		if (!deleteTarget || isBusy) return;
		deleteFormEl?.requestSubmit();
		deleteOpen = false;
	}
</script>

<div class="space-y-5">
	<header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
				<AudioLines class="h-6 w-6 text-primary" />
				Версии озвучки
			</h1>
			<p class="mt-2 max-w-2xl text-sm text-muted-foreground">
				Текущая озвучка хранится в главе, архивные дорожки — отдельно. Выберите главу слева, чтобы
				заменить аудио и управлять всеми её версиями в одном месте.
			</p>
		</div>
		<div class="flex shrink-0 flex-wrap items-center gap-2">
			<Badge variant="outline" class="h-6 gap-1 font-mono text-[11px]">
				<Disc3 class="h-3 w-3" />
				{data.chapters.length} глав
			</Badge>
			<Badge variant="outline" class="h-6 gap-1 font-mono text-[11px]">
				<Archive class="h-3 w-3" />
				{data.tracks.length} в архиве
			</Badge>
		</div>
	</header>

	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		{#each stats as stat (stat.label)}
			{@const StatIcon = stat.icon}
			<Card class="gap-0 border-border/50 py-0">
				<CardContent class="flex flex-row items-center gap-3 p-3.5">
					<div
						class={cn(
							'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60',
							stat.tone
						)}
					>
						<StatIcon class="h-4 w-4" />
					</div>
					<div class="min-w-0">
						<p class="text-xs leading-tight text-muted-foreground">{stat.label}</p>
						<p class="text-lg leading-tight font-bold tracking-tight">{stat.value}</p>
					</div>
				</CardContent>
			</Card>
		{/each}
	</div>

	<div
		class="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/25 p-3 text-xs text-muted-foreground"
	>
		<Info class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
		<p>
			<strong class="text-foreground">Как заменить озвучку:</strong>
			сначала сохраните текущую версию в архив, затем загрузите новый файл в блоке «Новая версия». Вернуть
			архивную дорожку можно кнопкой «Сделать основной».
		</p>
	</div>

	{#if flash}
		<div
			class={cn(
				'flex items-start gap-2 rounded-xl border p-3 text-sm',
				flash.kind === 'error'
					? 'border-destructive/30 bg-destructive/10 text-destructive'
					: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
			)}
			role={flash.kind === 'error' ? 'alert' : 'status'}
		>
			{#if flash.kind === 'error'}
				<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
			{:else}
				<CircleCheck class="mt-0.5 h-4 w-4 shrink-0" />
			{/if}
			<p class="min-w-0 flex-1">{flash.text}</p>
			<button
				type="button"
				class="shrink-0 rounded-md p-0.5 opacity-70 transition hover:bg-foreground/10 hover:opacity-100"
				aria-label="Скрыть сообщение"
				onclick={() => {
					message = null;
					hiddenServerFlash = true;
				}}
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	{/if}

	<Tabs bind:value={tab}>
		<TabsList class="w-full justify-start gap-1 overflow-x-auto sm:w-fit">
			<TabsTrigger value="chapters" class="gap-1.5">
				<ListMusic class="h-4 w-4" />
				Главы
				<span
					class="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
				>
					{filteredChapters.length}
				</span>
			</TabsTrigger>
			<TabsTrigger value="archive" class="gap-1.5">
				<Archive class="h-4 w-4" />
				Архив
				<span
					class="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
				>
					{filteredTracks.length}
				</span>
			</TabsTrigger>
		</TabsList>

		<TabsContent value="chapters" class="mt-4 focus-visible:outline-none">
			<div class="grid items-start gap-4 lg:grid-cols-12">
				<Card class="min-w-0 border-border/50 lg:col-span-5 xl:col-span-4">
					<CardHeader class="gap-3 pb-3">
						<div class="flex items-center justify-between gap-2">
							<CardTitle class="flex items-center gap-2 text-base">
								<ListMusic class="h-4 w-4 text-primary" />
								Главы
							</CardTitle>
							<Badge variant="secondary" class="font-mono text-[11px]">
								{filteredChapters.length} из {data.chapters.length}
							</Badge>
						</div>
						<div class="space-y-2">
							<div class="relative">
								<Search
									class="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground"
								/>
								<Input
									bind:value={search}
									aria-label="Поиск глав"
									placeholder="Глава, том или книга"
									class="pl-8 text-xs"
								/>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<select
									bind:value={bookFilter}
									onchange={() => (volumeFilter = 'all')}
									aria-label="Фильтр по книге"
									class="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
								>
									<option value="all">Все книги</option>
									{#each booksList as book (book.id)}
										<option value={book.id}>{book.title}</option>
									{/each}
								</select>
								<select
									bind:value={volumeFilter}
									aria-label="Фильтр по тому"
									class="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
								>
									<option value="all">Все тома</option>
									{#each volumesList as volume (volume.id)}
										<option value={volume.id}>Том {volume.number} · {volume.title}</option>
									{/each}
								</select>
							</div>
							<div class="flex items-center gap-2">
								<select
									bind:value={archiveState}
									aria-label="Фильтр по наличию архива"
									class="flex h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
								>
									<option value="all">Все версии</option>
									<option value="with">Только с архивом</option>
									<option value="without">Только без архива</option>
								</select>
								<Button variant="ghost" size="xs" class="shrink-0 gap-1" onclick={resetFilters}>
									<RotateCcw class="h-3 w-3" />
									Сбросить
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent class="p-0">
						{#if filteredChapters.length === 0}
							<div class="flex flex-col items-center gap-1 px-4 py-12 text-center">
								<p class="text-sm font-medium">Главы не найдены</p>
								<p class="text-xs text-muted-foreground">Измените запрос или сбросьте фильтры.</p>
								<Button variant="outline" size="sm" class="mt-2" onclick={resetFilters}>
									Сбросить фильтры
								</Button>
							</div>
						{:else}
							<div>
								{#each paginatedChapters as chapter (chapter.id)}
									{@const chapterTracks = tracksByChapter[chapter.id] ?? []}
									<button
										type="button"
										data-chapter-id={chapter.id}
										class={cn(
											'flex w-full items-start gap-3 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/40',
											activeChapter?.id === chapter.id && 'bg-primary/5 hover:bg-primary/5'
										)}
										aria-current={activeChapter?.id === chapter.id ? 'true' : undefined}
										onclick={() => selectChapter(chapter.id)}
									>
										<span
											class="mt-0.5 inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 font-mono text-[11px] font-semibold"
										>
											{chapter.chapterNumber}
										</span>
										<span class="min-w-0 flex-1">
											<span class="block truncate text-sm font-medium">{chapter.title}</span>
											<span class="mt-0.5 block truncate text-[11px] text-muted-foreground">
												{chapter.bookTitle} · Том {chapter.volumeNumber} · {formatDuration(
													chapter.durationSeconds
												)}
											</span>
										</span>
										<span class="flex shrink-0 flex-col items-end gap-1">
											{#if chapterTracks.length > 0}
												<Badge variant="secondary" class="gap-1 text-[10px]">
													<Archive class="h-3 w-3" />
													{chapterTracks.length}
												</Badge>
											{/if}
											{#if chapter.telegramPostUrl}
												<MessageSquare
													class="h-3 w-3 text-blue-500"
													aria-label="Есть пост в Telegram"
												/>
											{/if}
										</span>
									</button>
								{/each}
							</div>
							<div class="flex items-center justify-between gap-2 border-t px-3 py-2">
								<p class="text-[11px] text-muted-foreground">
									{safeListPage} / {chapterPageCount} · {filteredChapters.length} глав
								</p>
								<div class="flex items-center gap-1">
									<Button
										size="icon-xs"
										variant="outline"
										disabled={safeListPage <= 1}
										aria-label="Предыдущая страница"
										onclick={() => (listPage = safeListPage - 1)}
									>
										<ChevronLeft class="h-3.5 w-3.5" />
									</Button>
									<Button
										size="icon-xs"
										variant="outline"
										disabled={safeListPage >= chapterPageCount}
										aria-label="Следующая страница"
										onclick={() => (listPage = safeListPage + 1)}
									>
										<ChevronRight class="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
						{/if}
					</CardContent>
				</Card>

				<div id="chapter-detail" class="min-w-0 scroll-mt-24 space-y-4 lg:col-span-7 xl:col-span-8">
					{#if activeChapter}
						{@const chapter = activeChapter}
						<Card class="border-border/50">
							<CardContent
								class="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
							>
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
										<span class="truncate">{chapter.bookTitle}</span>
										<ChevronRight class="h-3 w-3 shrink-0" />
										<span class="truncate">Том {chapter.volumeNumber} · {chapter.volumeTitle}</span>
									</div>
									<h2 class="mt-1 truncate text-xl font-semibold tracking-tight">
										{chapter.title}
									</h2>
									<div class="mt-2 flex flex-wrap items-center gap-1.5">
										<Badge variant="outline" class="gap-1 font-mono">
											<Clock class="h-3 w-3" />
											{formatDuration(chapter.durationSeconds)}
										</Badge>
										{#if activeTracks.length > 0}
											<Badge variant="outline" class="gap-1">
												<Archive class="h-3 w-3" />
												Архив: {activeTracks.length}
											</Badge>
										{/if}
										{#if chapter.telegramPostUrl}
											<Badge variant="outline" class="gap-1">
												<MessageSquare class="h-3 w-3 text-blue-500" />
												Telegram
											</Badge>
										{/if}
									</div>
								</div>
								<div class="flex shrink-0 flex-wrap gap-2">
									<Button
										href={'/books/' +
											chapter.bookId +
											'/' +
											chapter.volumeId +
											'?chapter=' +
											chapter.id}
										target="_blank"
										variant="outline"
										size="sm"
										class="gap-1.5"
									>
										<ExternalLink class="h-3.5 w-3.5" />
										На сайте
									</Button>
									<Button
										href={'/admin/chapters?edit=' + chapter.id}
										variant="outline"
										size="sm"
										class="gap-1.5"
									>
										<Pencil class="h-3.5 w-3.5" />
										Метаданные
									</Button>
								</div>
							</CardContent>
						</Card>

						<Card class="border-border/50">
							<CardHeader class="pb-3">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<CardTitle class="flex items-center gap-2 text-base">
										<Music class="h-4 w-4 text-primary" />
										Новая версия
									</CardTitle>
									<Badge variant="outline" class="font-mono text-[10px]">default</Badge>
								</div>
								<CardDescription class="text-xs">
									Текущая озвучка главы. Загруженный файл или новый URL заменит её; прежнюю версию
									можно вернуть из архива.
								</CardDescription>
							</CardHeader>
							<CardContent class="space-y-4">
								<div class="rounded-lg border border-border/50 bg-muted/20 p-3">
									<div
										class="mb-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground"
									>
										<span class="truncate font-mono">{fileName(chapter.audioUrl)}</span>
										<span class="shrink-0 font-mono">{formatDuration(chapter.durationSeconds)}</span
										>
									</div>
									<audio
										class="w-full"
										controls
										preload="none"
										src={chapter.audioUrl}
										aria-label={'Текущая озвучка главы ' + chapter.title}
									></audio>
								</div>

								{#key chapter.id}
									<form
										method="POST"
										action="?/updateCurrent"
										enctype="multipart/form-data"
										use:enhance={currentEnhance}
										class="space-y-3"
									>
										<input type="hidden" name="chapterId" value={chapter.id} />
										<div class="grid gap-3 sm:grid-cols-2">
											<div class="space-y-1.5 sm:col-span-2">
												<Label for="current-file" class="text-xs">Новый аудиофайл</Label>
												<input
													id="current-file"
													name="audioFile"
													type="file"
													accept="audio/*,.mp3,.m4a"
													class="block w-full cursor-pointer text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
													onchange={(event) => describeFile(event, 'current')}
												/>
												<p class="text-[11px] text-muted-foreground">
													{currentFileLabel || 'MP3 или M4A, до 500 МБ. Файл важнее URL.'}
												</p>
											</div>
											<div class="space-y-1.5 sm:col-span-2">
												<Label for="current-url" class="text-xs">Или URL аудио</Label>
												<Input
													id="current-url"
													name="audioUrl"
													value={chapter.audioUrl}
													class="font-mono text-xs"
												/>
											</div>
											<div class="space-y-1.5">
												<Label for="current-duration" class="text-xs">Длительность, сек</Label>
												<Input
													id="current-duration"
													name="durationSeconds"
													type="number"
													min="0"
													value={chapter.durationSeconds}
													class="font-mono text-xs"
												/>
											</div>
											<div class="space-y-1.5">
												<Label for="current-telegram" class="text-xs">Пост Telegram</Label>
												<Input
													id="current-telegram"
													name="telegramPostUrl"
													value={chapter.telegramPostUrl ?? ''}
													placeholder="https://t.me/..."
													class="text-xs"
												/>
											</div>
										</div>
										<div class="flex flex-wrap items-center gap-2">
											<Button type="submit" class="gap-2" disabled={isBusy}>
												<Upload class="h-4 w-4" />
												{pending === 'current' ? 'Сохраняем…' : 'Сохранить новую версию'}
											</Button>
											<p class="text-[11px] text-muted-foreground">
												Если ничего не менять, данные главы останутся прежними.
											</p>
										</div>
									</form>
								{/key}
							</CardContent>
						</Card>

						<Card class="border-border/50">
							<CardHeader class="pb-3">
								<div class="flex flex-wrap items-start justify-between gap-2">
									<div class="min-w-0">
										<CardTitle class="flex items-center gap-2 text-base">
											<Archive class="h-4 w-4 text-amber-500" />
											Архивные версии
											{#if activeTracks.length > 0}
												<span class="font-mono text-xs text-muted-foreground">
													({activeTracks.length})
												</span>
											{/if}
										</CardTitle>
										<CardDescription class="mt-1 text-xs">
											«Сделать основной» меняет местами текущую и архивную версии. Объединённый файл
											сначала нужно разделить на главы.
										</CardDescription>
									</div>
									<Button
										size="sm"
										variant={showArchiveForm ? 'secondary' : 'outline'}
										class="gap-1.5"
										onclick={() => (showArchiveForm = !showArchiveForm)}
									>
										{#if showArchiveForm}
											<X class="h-3.5 w-3.5" />
											Скрыть форму
										{:else}
											<Plus class="h-3.5 w-3.5" />
											Добавить версию
										{/if}
									</Button>
								</div>
							</CardHeader>
							<CardContent class="space-y-4">
								{#if activeTracks.length === 0}
									<div
										class="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center"
									>
										<p class="text-sm font-medium">Архивных версий пока нет</p>
										<p class="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
											Сохраните текущую озвучку как архивную — тогда после замены файла к ней можно
											будет вернуться.
										</p>
										<form
											method="POST"
											action="?/add"
											use:enhance={snapshotEnhance}
											class="mt-3 flex justify-center"
										>
											<input type="hidden" name="chapterId" value={chapter.id} />
											<input type="hidden" name="versionId" value="old" />
											<input type="hidden" name="title" value={chapter.title} />
											<input type="hidden" name="chapterStart" value={chapter.chapterNumber} />
											<input type="hidden" name="chapterEnd" value={chapter.chapterNumber} />
											<input type="hidden" name="durationSeconds" value={chapter.durationSeconds} />
											<Button
												type="submit"
												size="sm"
												variant="outline"
												class="gap-1.5"
												disabled={isBusy}
											>
												<Archive class="h-3.5 w-3.5" />
												{pending === 'snapshot' ? 'Сохраняем…' : 'Сохранить текущую в архив'}
											</Button>
										</form>
									</div>
								{:else}
									<ul class="space-y-3">
										{#each activeTracks as track (track.id)}
											{@const isCombined = track.chapterStart !== track.chapterEnd}
											{@const isSameFile = track.audioUrl === chapter.audioUrl}
											<li class="rounded-lg border border-border/50 p-3">
												<div class="flex flex-wrap items-start justify-between gap-2">
													<div class="min-w-0">
														<div class="flex flex-wrap items-center gap-1.5">
															<Badge variant="secondary" class="gap-1">
																<Archive class="h-3 w-3" />
																{versionLabel(track.versionId)}
															</Badge>
															<span class="font-mono text-[11px] text-muted-foreground">
																{rangeLabel(track)}
															</span>
															{#if isCombined}
																<Badge
																	variant="outline"
																	class="text-[10px] text-amber-600 dark:text-amber-400"
																>
																	объединённый файл
																</Badge>
															{/if}
															{#if isSameFile}
																<Badge variant="outline" class="text-[10px]">
																	ссылка на текущий файл
																</Badge>
															{/if}
														</div>
														<p class="mt-1 truncate text-sm font-medium">{track.title}</p>
														<p class="mt-0.5 text-[11px] text-muted-foreground">
															{formatDuration(track.durationSeconds)}
															{#if track.createdAt}
																· добавлено {formatDate(track.createdAt)}
															{/if}
														</p>
													</div>
													<div class="flex shrink-0 items-center gap-1.5">
														<Button
															size="sm"
															variant="outline"
															class="gap-1.5"
															disabled={promoteDisabled(track)}
															title={promoteTitle(track)}
															onclick={() => openPromote(track)}
														>
															<ArrowUpToLine class="h-3.5 w-3.5" />
															Сделать основной
														</Button>
														<Button
															size="icon-sm"
															variant="ghost"
															class="text-muted-foreground hover:text-destructive"
															title="Удалить архивную версию"
															aria-label={'Удалить архивную версию ' + track.title}
															onclick={() => openDelete(track)}
														>
															<Trash2 class="h-3.5 w-3.5" />
														</Button>
													</div>
												</div>
												<div class="mt-2 rounded-md bg-muted/20 p-2">
													<audio
														class="w-full"
														controls
														preload="none"
														src={track.audioUrl}
														aria-label={'Архивная версия ' + track.title}
													></audio>
												</div>
											</li>
										{/each}
									</ul>
								{/if}

								{#if showArchiveForm}
									<div class="rounded-lg border border-border/60 bg-muted/20 p-3.5">
										<div class="mb-3 flex items-center justify-between gap-2">
											<p class="text-sm font-semibold">Добавить архивную версию</p>
											<Button
												size="icon-xs"
												variant="ghost"
												aria-label="Скрыть форму"
												onclick={() => (showArchiveForm = false)}
											>
												<X class="h-3.5 w-3.5" />
											</Button>
										</div>
										{#key chapter.id}
											<form
												method="POST"
												action="?/add"
												enctype="multipart/form-data"
												use:enhance={archiveEnhance}
												class="space-y-3"
											>
												<input type="hidden" name="chapterId" value={chapter.id} />
												<div class="grid gap-3 sm:grid-cols-2">
													<div class="space-y-1.5 sm:col-span-2">
														<Label for="archive-title" class="text-xs">Название версии *</Label>
														<Input
															id="archive-title"
															name="title"
															required
															value={chapter.title}
															class="text-sm"
														/>
													</div>
													<div class="space-y-1.5">
														<Label for="archive-version" class="text-xs">Вид версии</Label>
														<select
															id="archive-version"
															name="versionId"
															class="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
														>
															{#each archiveVersionOptions as option (option.id)}
																<option value={option.id}>{option.label}</option>
															{/each}
														</select>
													</div>
													<div class="space-y-1.5">
														<Label for="archive-duration" class="text-xs">Длительность, сек</Label>
														<Input
															id="archive-duration"
															name="durationSeconds"
															type="number"
															min="0"
															value={chapter.durationSeconds}
															class="font-mono text-xs"
														/>
													</div>
													<div class="space-y-1.5">
														<Label for="archive-start" class="text-xs">Первая глава</Label>
														<Input
															id="archive-start"
															name="chapterStart"
															type="number"
															min="0"
															required
															value={chapter.chapterNumber}
															class="font-mono text-xs"
														/>
													</div>
													<div class="space-y-1.5">
														<Label for="archive-end" class="text-xs">Последняя глава</Label>
														<Input
															id="archive-end"
															name="chapterEnd"
															type="number"
															min="0"
															required
															value={chapter.chapterNumber}
															class="font-mono text-xs"
														/>
													</div>
													<div class="space-y-1.5 sm:col-span-2">
														<Label for="archive-file" class="text-xs">Аудиофайл</Label>
														<input
															id="archive-file"
															name="audioFile"
															type="file"
															accept="audio/*,.mp3,.m4a"
															class="block w-full cursor-pointer text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
															onchange={(event) => describeFile(event, 'archive')}
														/>
														<p class="text-[11px] text-muted-foreground">
															{archiveFileLabel || 'MP3 или M4A, до 500 МБ'}
														</p>
													</div>
													<div class="space-y-1.5 sm:col-span-2">
														<Label for="archive-url" class="text-xs">Или URL аудио</Label>
														<Input
															id="archive-url"
															name="audioUrl"
															placeholder="/api/media/... или https://..."
															class="font-mono text-xs"
														/>
														<p class="text-[11px] text-muted-foreground">
															Оставьте пустым — архивная версия будет ссылаться на текущую озвучку
															главы.
														</p>
													</div>
												</div>
												<div class="flex flex-wrap items-center gap-2">
													<Button type="submit" size="sm" class="gap-1.5" disabled={isBusy}>
														<Upload class="h-3.5 w-3.5" />
														{pending === 'archive' ? 'Сохраняем…' : 'Сохранить в архив'}
													</Button>
													<Button
														type="button"
														size="sm"
														variant="ghost"
														onclick={() => (showArchiveForm = false)}
													>
														Отмена
													</Button>
												</div>
											</form>
										{/key}
									</div>
								{/if}
							</CardContent>
						</Card>
					{:else}
						<Card class="border-border/50">
							<CardContent class="flex flex-col items-center gap-2 py-16 text-center">
								<AudioLines class="h-8 w-8 text-muted-foreground" />
								<p class="text-sm font-medium">Выберите главу</p>
								<p class="max-w-sm text-xs text-muted-foreground">
									Слева появится список глав. После выбора здесь можно заменить озвучку, добавить
									архивную версию или вернуть старую.
								</p>
							</CardContent>
						</Card>
					{/if}
				</div>
			</div>
		</TabsContent>

		<TabsContent value="archive" class="mt-4 focus-visible:outline-none">
			<Card class="border-border/50">
				<CardHeader class="gap-3">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<CardTitle class="flex items-center gap-2 text-base">
								<Layers class="h-4 w-4 text-amber-500" />
								Все архивные дорожки
							</CardTitle>
							<CardDescription class="mt-1 text-xs">
								Полный архив по всем книгам. Откройте главу, чтобы управлять её версиями.
							</CardDescription>
						</div>
						<Badge variant="secondary" class="font-mono">{archiveCountLabel}</Badge>
					</div>
					<div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_150px]">
						<div class="relative">
							<Search
								class="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground"
							/>
							<Input
								bind:value={archiveSearch}
								aria-label="Поиск по архиву"
								placeholder="Название, глава, книга"
								class="pl-8 text-xs"
							/>
						</div>
						<select
							bind:value={archiveVersion}
							aria-label="Фильтр по виду версии"
							class="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
						>
							<option value="all">Все версии</option>
							{#each trackVersionOptions as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
						<select
							bind:value={archiveKind}
							aria-label="Фильтр по размеру файла"
							class="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
						>
							<option value="all">Любые файлы</option>
							<option value="single">Одна глава</option>
							<option value="combined">Объединённые</option>
						</select>
					</div>
				</CardHeader>
				<CardContent class="p-0">
					{#if paginatedTracks.length === 0}
						<div class="flex flex-col items-center gap-1 px-4 py-12 text-center">
							<Archive class="h-7 w-7 text-muted-foreground" />
							{#if data.tracks.length === 0}
								<p class="text-sm font-medium">Архивных дорожек нет</p>
								<p class="max-w-sm text-xs text-muted-foreground">
									Добавьте версию из карточки главы — здесь появится полный список.
								</p>
							{:else}
								<p class="text-sm font-medium">Ничего не найдено</p>
								<p class="max-w-sm text-xs text-muted-foreground">
									Измените запрос или сбросьте фильтры.
								</p>
								<Button variant="outline" size="sm" class="mt-2" onclick={resetArchiveFilters}>
									Сбросить фильтры
								</Button>
							{/if}
						</div>
					{:else}
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead class="w-14">№</TableHead>
									<TableHead>Глава</TableHead>
									<TableHead class="hidden w-32 sm:table-cell">Вид</TableHead>
									<TableHead class="hidden lg:table-cell">Название</TableHead>
									<TableHead class="hidden w-28 md:table-cell">Диапазон</TableHead>
									<TableHead class="hidden w-20 md:table-cell">Длит.</TableHead>
									<TableHead class="w-32 text-right">Действия</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each paginatedTracks as track (track.id)}
									<TableRow>
										<TableCell class="font-mono text-xs">{track.chapterNumber}</TableCell>
										<TableCell class="min-w-44">
											<button
												type="button"
												class="block max-w-64 text-left"
												onclick={() => openChapterFromArchive(track)}
											>
												<span class="block truncate text-sm font-medium hover:underline">
													{track.chapterTitle}
												</span>
												<span class="block truncate text-[11px] text-muted-foreground">
													{track.bookTitle} · Том {track.volumeNumber}
												</span>
												<span
													class="mt-0.5 block truncate text-[10px] text-muted-foreground sm:hidden"
												>
													{versionLabel(track.versionId)}
												</span>
											</button>
										</TableCell>
										<TableCell class="hidden sm:table-cell">
											<Badge variant="secondary" class="gap-1">
												<Archive class="h-3 w-3" />
												{versionLabel(track.versionId)}
											</Badge>
										</TableCell>
										<TableCell
											class="hidden max-w-56 truncate text-xs lg:table-cell"
											title={track.title}
										>
											{track.title}
										</TableCell>
										<TableCell class="hidden font-mono text-[11px] whitespace-nowrap md:table-cell">
											{rangeLabel(track)}
										</TableCell>
										<TableCell class="hidden font-mono text-xs md:table-cell">
											{formatDuration(track.durationSeconds)}
										</TableCell>
										<TableCell class="text-right">
											<div class="flex items-center justify-end gap-0.5">
												<Button
													href={track.audioUrl}
													target="_blank"
													size="icon-sm"
													variant="ghost"
													class="hidden sm:inline-flex"
													title="Открыть аудио"
													aria-label={'Открыть аудио ' + track.title}
												>
													<Play class="h-3.5 w-3.5" />
												</Button>
												<Button
													size="icon-sm"
													variant="ghost"
													class="hidden sm:inline-flex"
													title="Открыть главу"
													aria-label={'Открыть главу ' + track.chapterTitle}
													onclick={() => openChapterFromArchive(track)}
												>
													<ListMusic class="h-3.5 w-3.5" />
												</Button>
												<Button
													size="icon-sm"
													variant="ghost"
													disabled={promoteDisabled(track)}
													title={promoteTitle(track)}
													aria-label={'Сделать основной ' + track.title}
													onclick={() => openPromote(track)}
												>
													<ArrowUpToLine class="h-3.5 w-3.5" />
												</Button>
												<Button
													size="icon-sm"
													variant="ghost"
													class="text-muted-foreground hover:text-destructive"
													title="Удалить архивную версию"
													aria-label={'Удалить архивную версию ' + track.title}
													onclick={() => openDelete(track)}
												>
													<Trash2 class="h-3.5 w-3.5" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
						<div class="border-t px-4">
							<PaginationBar
								totalItems={filteredTracks.length}
								bind:currentPage={archivePage}
								pageSize={PAGE_SIZE}
							/>
						</div>
					{/if}
				</CardContent>
			</Card>
		</TabsContent>
	</Tabs>

	<form
		bind:this={promoteFormEl}
		method="POST"
		action="?/promote"
		use:enhance={promoteEnhance}
		class="hidden"
	>
		<input type="hidden" name="id" value={promoteTarget?.id ?? ''} />
	</form>
	<form
		bind:this={deleteFormEl}
		method="POST"
		action="?/delete"
		use:enhance={deleteEnhance}
		class="hidden"
	>
		<input type="hidden" name="id" value={deleteTarget?.id ?? ''} />
	</form>

	<ConfirmModal
		bind:open={promoteOpen}
		title="Сделать версию основной?"
		description={promoteTarget
			? 'Текущая озвучка главы «' +
				promoteTarget.chapterTitle +
				'» уйдёт в архив, а выбранная версия станет новой.'
			: ''}
		confirmLabel="Сделать основной"
		accentCancel={false}
		confirming={pending === 'promote'}
		confirmDisabled={isBusy && pending !== 'promote'}
		onConfirm={confirmPromote}
		onCancel={() => (promoteOpen = false)}
	/>
	<ConfirmModal
		bind:open={deleteOpen}
		title="Удалить архивную версию?"
		description={deleteTarget
			? 'Запись «' +
				deleteTarget.title +
				'» будет удалена без возможности восстановления. Файл удалится из хранилища, если на него больше ничего не ссылается.'
			: ''}
		confirmLabel="Удалить"
		accentCancel={false}
		confirming={pending === 'delete'}
		confirmDisabled={isBusy && pending !== 'delete'}
		onConfirm={confirmDelete}
		onCancel={() => (deleteOpen = false)}
	/>
</div>
