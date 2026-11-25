<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { onDestroy, tick, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import BlurhashImage from '$lib/components/common/BlurhashImage.svelte';
	import { page } from '$app/state';
	import type { SubmitFunction } from './$types';
	import BookDialog from '$lib/components/admin/content/BookDialog.svelte';
	import ChapterDialog from '$lib/components/admin/content/ChapterDialog.svelte';
	import IllustrationDialog from '$lib/components/admin/content/IllustrationDialog.svelte';
	import MediaLightbox from '$lib/components/admin/content/MediaLightbox.svelte';
	import VolumeCreateDialog from '$lib/components/admin/content/VolumeCreateDialog.svelte';
	import VolumeForm from '$lib/components/admin/content/VolumeForm.svelte';
	import ConfirmDeleteForm from '$lib/components/admin/ConfirmDeleteForm.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { cn } from '$lib/utils';
	import { formatDuration } from '$lib/utils/time';
	import { audioStore } from '$lib/audio-store.svelte';
	import {
		Archive,
		ArrowDown,
		ArrowUp,
		BookOpen,
		ChevronRight,
		CircleCheck,
		Disc3,
		ExternalLink,
		GripVertical,
		Image as ImageIcon,
		Layers,
		MessageSquare,
		Pencil,
		Play,
		Plus,
		Search,
		TriangleAlert,
		X
	} from '@lucide/svelte';
	import type {
		AdminArchiveTrack,
		AdminBook,
		AdminChapter,
		AdminIllustration,
		ContentIntent,
		ContentTab
	} from '$lib/components/admin/content/types';

	let { data } = $props();

	let bookDialog = $state<{ book: AdminBook | null } | null>(null);
	let volumeDialogOpen = $state(false);
	let chapterDialogId = $state<string | 'new' | null>(null);
	let illustrationDialog = $state<{ illustration: AdminIllustration | null } | null>(null);
	let toast = $state<{ kind: 'success' | 'error'; text: string } | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	let toastVersion = 0;
	let didInit = false;
	let reorderForm = $state<HTMLFormElement | null>(null);
	let pendingBookOrder = $state('');
	let draggedBookId = $state<string | null>(null);
	let searchValue = $state(untrack(() => data.q ?? ''));
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let volumeSort = $state<'number' | 'title' | 'updated' | 'chapters'>('number');
	let volumeDirection = $state<'asc' | 'desc'>('asc');
	let chapterSort = $state<'number' | 'title' | 'duration' | 'updated'>('number');
	let chapterDirection = $state<'asc' | 'desc'>('asc');
	let mediaOpen = $state(false);
	let mediaSrc = $state<string | null>(null);
	let mediaTitle = $state('Просмотр');
	let mediaKind = $state<'image' | 'video'>('image');

	function openMedia(
		src: string | null | undefined,
		title: string,
		kind: 'image' | 'video' = 'image'
	) {
		if (!src) return;
		mediaSrc = src;
		mediaTitle = title;
		mediaKind = kind;
		mediaOpen = true;
	}

	const volumeSortOptions = [
		{ value: 'number', label: 'По номеру' },
		{ value: 'title', label: 'По названию' },
		{ value: 'updated', label: 'По обновлению' },
		{ value: 'chapters', label: 'По главам' }
	] as const;
	const chapterSortOptions = [
		{ value: 'number', label: 'По номеру' },
		{ value: 'title', label: 'По названию' },
		{ value: 'duration', label: 'По длительности' },
		{ value: 'updated', label: 'По обновлению' }
	] as const;

	const selectedBook = $derived(data.selectedBook);
	const selectedVolume = $derived(data.selectedVolume);
	const activeTab = $derived(data.tab);
	const tracksByChapter = $derived.by(() => {
		const map: Record<string, AdminArchiveTrack[]> = Object.create(null);
		for (const track of data.tracks) {
			const list = map[track.chapterId];
			if (list) list.push(track);
			else map[track.chapterId] = [track];
		}
		return map;
	});
	const totalDuration = $derived(
		data.chapters.reduce((sum, chapter) => sum + chapter.durationSeconds, 0)
	);
	const chapterDialogChapter = $derived(
		chapterDialogId && chapterDialogId !== 'new'
			? (data.chapters.find((chapter) => chapter.id === chapterDialogId) ?? null)
			: null
	);
	const nextIllustrationSort = $derived(
		data.illustrations.reduce((max, illustration) => Math.max(max, illustration.sortOrder), 0) + 1
	);
	interface IllustrationTimingInfo {
		chapterNumber: number;
		chapterTitle: string;
		showAtSeconds: number;
	}
	const illustrationTimingsById = $derived.by(() => {
		const chaptersById = new SvelteMap(data.chapters.map((chapter) => [chapter.id, chapter]));
		const map = new SvelteMap<string, IllustrationTimingInfo>();
		for (const timing of data.chapterIllustrationTimings) {
			const chapter = chaptersById.get(timing.chapterId);
			if (!chapter) continue;
			const current = map.get(timing.illustrationId);
			const next = {
				chapterNumber: chapter.chapterNumber,
				chapterTitle: chapter.title,
				showAtSeconds: timing.showAtSeconds
			};
			if (
				!current ||
				next.chapterNumber < current.chapterNumber ||
				(next.chapterNumber === current.chapterNumber && next.showAtSeconds < current.showAtSeconds)
			) {
				map.set(timing.illustrationId, next);
			}
		}
		return map;
	});
	const orderedIllustrations = $derived.by(() => {
		const timed: AdminIllustration[] = [];
		const manual: AdminIllustration[] = [];
		for (const illustration of data.illustrations) {
			(illustrationTimingsById.has(illustration.id) ? timed : manual).push(illustration);
		}
		timed.sort((a, b) => {
			const left = illustrationTimingsById.get(a.id);
			const right = illustrationTimingsById.get(b.id);
			if (!left || !right) return 0;
			return (
				left.chapterNumber - right.chapterNumber ||
				left.showAtSeconds - right.showAtSeconds ||
				a.sortOrder - b.sortOrder
			);
		});
		manual.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
		return [...timed, ...manual];
	});
	const draggableIllustrations = $derived(
		orderedIllustrations.filter((illustration) => !illustrationTimingsById.has(illustration.id))
	);
	let illustrationDragId = $state<string | null>(null);
	let illustrationDropTargetId = $state<string | null>(null);
	let illustrationOrder = $state('[]');
	let illustrationReorderForm = $state<HTMLFormElement | null>(null);

	function startIllustrationDrag(event: DragEvent, illustration: AdminIllustration) {
		if (illustrationTimingsById.has(illustration.id)) return;
		illustrationDragId = illustration.id;
		illustrationDropTargetId = null;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', illustration.id);
		}
	}

	function allowIllustrationDrop(event: DragEvent, targetId: string) {
		if (!illustrationDragId || illustrationDragId === targetId) return;
		if (!draggableIllustrations.some((illustration) => illustration.id === targetId)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		illustrationDropTargetId = targetId;
	}

	function endIllustrationDrag() {
		illustrationDragId = null;
		illustrationDropTargetId = null;
	}

	async function dropIllustration(event: DragEvent, targetId: string) {
		event.preventDefault();
		const sourceId = illustrationDragId;
		if (!sourceId || sourceId === targetId) {
			endIllustrationDrag();
			return;
		}
		const ids = draggableIllustrations.map((illustration) => illustration.id);
		const from = ids.indexOf(sourceId);
		const to = ids.indexOf(targetId);
		if (from === -1 || to === -1) {
			endIllustrationDrag();
			return;
		}
		const [moved] = ids.splice(from, 1);
		ids.splice(to, 0, moved);
		illustrationOrder = JSON.stringify(ids);
		endIllustrationDrag();
		await tick();
		illustrationReorderForm?.requestSubmit();
	}
	const sortedVolumes = $derived.by(() => {
		const rows = [...data.volumes];
		const direction = volumeDirection === 'asc' ? 1 : -1;
		rows.sort((a, b) => {
			let difference: number;
			switch (volumeSort) {
				case 'title':
					difference = a.title.localeCompare(b.title, 'ru');
					break;
				case 'updated':
					difference = new Date(a.updatedAt ?? 0).getTime() - new Date(b.updatedAt ?? 0).getTime();
					break;
				case 'chapters':
					difference = a.chapterCount - b.chapterCount;
					break;
				default:
					difference = a.volumeNumber - b.volumeNumber;
			}
			return difference * direction;
		});
		return rows;
	});

	const sortedChapters = $derived.by(() => {
		const rows = [...data.chapters];
		const direction = chapterDirection === 'asc' ? 1 : -1;
		rows.sort((a, b) => {
			let difference: number;
			switch (chapterSort) {
				case 'title':
					difference = a.title.localeCompare(b.title, 'ru');
					break;
				case 'duration':
					difference = a.durationSeconds - b.durationSeconds;
					break;
				case 'updated':
					difference = new Date(a.updatedAt ?? 0).getTime() - new Date(b.updatedAt ?? 0).getTime();
					break;
				default:
					difference = a.chapterNumber - b.chapterNumber;
			}
			return difference * direction;
		});
		return rows;
	});

	const statusLabels: Record<string, string> = {
		ongoing: 'Выходит',
		completed: 'Завершён',
		hiatus: 'Пауза',
		dropped: 'Заморожен'
	};

	$effect(() => {
		if (didInit) return;
		didInit = true;
		if (data.editBookId) {
			bookDialog = {
				book: data.books.find((book) => book.id === data.editBookId) ?? null
			};
		}
		if (data.openChapterId) chapterDialogId = data.openChapterId;
		if (data.editIllustrationId) {
			illustrationDialog = {
				illustration:
					data.illustrations.find((illustration) => illustration.id === data.editIllustrationId) ??
					null
			};
		}
		if (data.intent === 'book') bookDialog = { book: null };
		else if (data.intent === 'volume' && data.selectedBook) volumeDialogOpen = true;
		else if (data.intent === 'chapter' && data.selectedVolume) chapterDialogId = 'new';
		else if (data.intent === 'illustration' && data.selectedVolume) {
			illustrationDialog = { illustration: null };
		}
	});

	function openPublic(href: string) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(href);
	}

	function handleTitleKeydown(event: KeyboardEvent, href: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			event.stopPropagation();
			openPublic(href);
		}
	}

	function playChapterAudio(chapter: AdminChapter) {
		if (!chapter.audioUrl) return;
		audioStore.setQueueAndPlay(
			[
				{
					id: chapter.id,
					url: chapter.audioUrl,
					title: chapter.title,
					duration: chapter.durationSeconds,
					versionId: 'default',
					artwork: selectedVolume?.coverUrl ?? undefined,
					album: selectedVolume?.title ?? undefined,
					volumeId: selectedVolume?.id,
					bookId: selectedBook?.id
				}
			],
			0
		);
	}

	function notify(kind: 'success' | 'error', text: string) {
		const version = ++toastVersion;
		toast = { kind, text };
		clearTimeout(toastTimer);
		if (kind === 'success') {
			toastTimer = setTimeout(() => {
				if (toastVersion === version) toast = null;
			}, 5000);
		}
	}

	function notifyError(message: string) {
		notify('error', message);
	}

	function dismissToast() {
		toast = null;
	}

	function navigate(params: {
		book?: string | null;
		volume?: string | null;
		tab?: ContentTab | null;
		edit?: string | null;
		chapter?: string | null;
		new?: ContentIntent | null;
		q?: string | null;
	}) {
		const url = new URL(page.url);
		for (const key of ['book', 'volume', 'tab', 'edit', 'chapter', 'new', 'q']) {
			url.searchParams.delete(key);
		}
		if (params.book) url.searchParams.set('book', params.book);
		if (params.volume) url.searchParams.set('volume', params.volume);
		if (params.tab) url.searchParams.set('tab', params.tab);
		if (params.edit) url.searchParams.set('edit', params.edit);
		if (params.chapter) url.searchParams.set('chapter', params.chapter);
		if (params.new) url.searchParams.set('new', params.new);
		if (params.q !== undefined) {
			if (params.q) url.searchParams.set('q', params.q);
			searchValue = params.q ?? '';
		} else {
			searchValue = '';
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(resolve('/admin/content') + url.search + url.hash, {
			noScroll: true,
			keepFocus: true
		});
	}

	function selectBook(bookId: string) {
		bookDialog = null;
		volumeDialogOpen = false;
		chapterDialogId = null;
		illustrationDialog = null;
		navigate({ book: bookId, tab: 'chapters' });
	}

	function selectVolume(volumeId: string) {
		if (!selectedBook) return;
		chapterDialogId = null;
		illustrationDialog = null;
		navigate({ book: selectedBook.id, volume: volumeId, tab: activeTab });
	}

	function selectTab(tab: ContentTab) {
		navigate({
			book: selectedBook?.id ?? null,
			volume: selectedVolume?.id ?? null,
			tab
		});
	}

	function handleSearchInput(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		searchValue = value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => applySearch(value), 320);
	}

	function submitSearch() {
		clearTimeout(searchTimer);
		applySearch(searchValue);
	}

	function applySearch(value: string) {
		const query = value.trim();
		if (query === (data.q ?? '')) return;
		navigate({
			book: selectedBook?.id ?? null,
			volume: selectedVolume?.id ?? null,
			tab: activeTab,
			q: query || null
		});
	}

	function clearSearch() {
		clearTimeout(searchTimer);
		searchValue = '';
		navigate({
			book: selectedBook?.id ?? null,
			volume: selectedVolume?.id ?? null,
			tab: activeTab
		});
	}

	function openSearchBook(bookId: string) {
		selectBook(bookId);
	}

	function openSearchVolume(bookId: string, volumeId: string) {
		navigate({ book: bookId, volume: volumeId, tab: 'chapters' });
	}

	function openSearchChapter(bookId: string, volumeId: string, chapterId: string) {
		chapterDialogId = chapterId;
		navigate({ book: bookId, volume: volumeId, tab: 'chapters' });
	}

	function openSearchIllustration(bookId: string, volumeId: string) {
		navigate({ book: bookId, volume: volumeId, tab: 'illustrations' });
	}

	function openExternal(url: string | null) {
		if (!url) return;
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	function plural(count: number, forms: [string, string, string]): string {
		const mod10 = count % 10;
		const mod100 = count % 100;
		if (mod10 === 1 && mod100 !== 11) return forms[0];
		if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
		return forms[2];
	}

	function statusLabel(status: string | null): string {
		return statusLabels[status ?? ''] ?? status ?? '—';
	}

	function statusVariant(status: string | null): 'secondary' | 'outline' {
		return status === 'completed' ? 'secondary' : 'outline';
	}

	function handleBookSaved(bookId: string) {
		const wasCreating = !bookDialog?.book;
		bookDialog = null;
		notify('success', wasCreating ? 'Книга создана' : 'Книга сохранена');
		if (wasCreating && bookId) selectBook(bookId);
	}

	function handleBookDeleted(wasSelected: boolean) {
		notify('success', 'Книга удалена');
		if (wasSelected) void goto(resolve('/admin/content'));
	}

	function handleVolumeCreated(volumeId: string) {
		volumeDialogOpen = false;
		notify('success', 'Том создан');
		if (selectedBook) {
			navigate({ book: selectedBook.id, volume: volumeId, tab: 'chapters' });
		}
	}

	function handleVolumeInlineSaved() {
		notify('success', 'Том сохранён');
	}

	function handleVolumeDeleted() {
		notify('success', 'Том удалён');
		if (selectedBook) navigate({ book: selectedBook.id, tab: 'volume' });
	}

	function handleChapterDeleted(chapterId: string) {
		notify('success', 'Глава удалена');
		if (chapterDialogId === chapterId) chapterDialogId = null;
	}

	function handleIllustrationDeleted(illustrationId: string) {
		notify('success', 'Иллюстрация удалена');
		if (illustrationDialog?.illustration?.id === illustrationId) illustrationDialog = null;
	}

	function handleChapterSaved() {
		chapterDialogId = null;
	}

	function handleIllustrationSaved() {
		illustrationDialog = null;
	}

	const reorderEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'failure') {
				const failure = result.data as { error?: string } | undefined;
				notifyError(failure?.error ?? 'Не удалось сохранить порядок книг');
			} else if (result.type === 'error') {
				notifyError('Ошибка сервера при сохранении порядка книг');
			} else {
				notify('success', 'Порядок книг сохранён');
			}
			pendingBookOrder = '';
			await update({ reset: false });
		};
	};

	function startBookDrag(event: DragEvent, bookId: string) {
		draggedBookId = bookId;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', bookId);
		}
	}

	function allowBookDrop(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
	}

	async function dropBook(event: DragEvent, targetId: string) {
		event.preventDefault();
		const sourceId = draggedBookId ?? event.dataTransfer?.getData('text/plain') ?? '';
		draggedBookId = null;
		if (!sourceId || sourceId === targetId) return;
		const ids = data.books.map((book) => book.id);
		const from = ids.indexOf(sourceId);
		const to = ids.indexOf(targetId);
		if (from < 0 || to < 0) return;
		ids.splice(from, 1);
		ids.splice(to, 0, sourceId);
		pendingBookOrder = ids.join(',');
		// Let Svelte flush the hidden input value before submitting the form.
		await tick();
		reorderForm?.requestSubmit();
	}

	function endBookDrag() {
		draggedBookId = null;
	}

	onDestroy(() => clearTimeout(searchTimer));

	const moveEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'failure') {
				const failure = result.data as { error?: string } | undefined;
				notifyError(failure?.error ?? 'Не удалось изменить порядок');
			} else if (result.type === 'error') {
				notifyError('Ошибка сервера при изменении порядка');
			}
			await update({ reset: false });
		};
	};
</script>

<div class="space-y-5">
	<header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Контент</h1>
			<p class="mt-1 max-w-2xl text-sm text-muted-foreground">
				Книги, тома, главы, версии озвучки и иллюстрации — в одном рабочем пространстве.
			</p>
		</div>
		<div class="flex shrink-0 flex-wrap items-center gap-2">
			<Badge variant="outline" class="gap-1 font-mono text-[11px]">
				<BookOpen class="h-3 w-3" />
				{data.books.length}
				{plural(data.books.length, ['книга', 'книги', 'книг'])}
			</Badge>
			<Button size="sm" class="gap-1.5" onclick={() => (bookDialog = { book: null })}>
				<Plus class="h-4 w-4" />
				Новая книга
			</Button>
		</div>
	</header>

	<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
		<div class="relative w-full max-w-xl">
			<Search class="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
			<Input
				value={searchValue}
				oninput={handleSearchInput}
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						submitSearch();
					}
				}}
				placeholder="Поиск по книгам, томам, главам, версиям и иллюстрациям"
				aria-label="Глобальный поиск по контенту"
				autocomplete="off"
				class="pr-8 pl-8 text-sm"
			/>
			{#if searchValue}
				<button
					type="button"
					class="absolute top-1.5 right-1.5 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={clearSearch}
					aria-label="Очистить поиск"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>
		{#if data.search}
			<Badge variant="secondary" class="self-start font-mono text-[11px]">
				Найдено: {data.search.total}
			</Badge>
		{/if}
	</div>

	{#if data.search}
		<section class="space-y-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h2 class="flex items-center gap-2 text-sm font-semibold">
						<Search class="h-4 w-4 text-primary" />
						Результаты поиска «{data.search.q}»
					</h2>
					<p class="mt-1 text-xs text-muted-foreground">
						Совпадения во всех книгах, томах, главах, архивных версиях и иллюстрациях.
					</p>
				</div>
				<Button variant="outline" size="sm" onclick={clearSearch}>Очистить поиск</Button>
			</div>

			{#if data.search.total === 0}
				<Card class="border-border/50">
					<CardContent class="flex flex-col items-center gap-2 py-16 text-center">
						<Search class="h-9 w-9 text-muted-foreground" />
						<p class="text-sm font-medium">Ничего не найдено</p>
						<p class="max-w-sm text-xs text-muted-foreground">
							Попробуйте другое название, ID или часть подписи.
						</p>
					</CardContent>
				</Card>
			{:else}
				<div class="grid gap-3 lg:grid-cols-2">
					{#if data.search.books.length > 0}
						<Card class="border-border/50">
							<CardHeader class="pb-2">
								<CardTitle class="text-sm">Книги ({data.search.books.length})</CardTitle>
							</CardHeader>
							<CardContent class="space-y-1">
								{#each data.search.books as hit (hit.id)}
									<button
										type="button"
										class="flex w-full items-center gap-2 rounded-md p-2 text-left transition hover:bg-muted/50"
										onclick={() => openSearchBook(hit.id)}
									>
										{#if hit.coverUrl}
											<BlurhashImage
												src={hit.coverUrl}
												alt=""
												class="h-12 w-8 shrink-0 rounded object-cover"
												blurhash={hit.blurhash}
											/>
										{:else}
											<BookOpen class="h-4 w-4 shrink-0 text-muted-foreground" />
										{/if}
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{hit.title}</p>
											<p class="truncate font-mono text-[10px] text-muted-foreground">{hit.id}</p>
										</div>
										<Badge variant={statusVariant(hit.status)} class="text-[10px]">
											{statusLabel(hit.status)}
										</Badge>
									</button>
								{/each}
							</CardContent>
						</Card>
					{/if}

					{#if data.search.volumes.length > 0}
						<Card class="border-border/50">
							<CardHeader class="pb-2">
								<CardTitle class="text-sm">Тома ({data.search.volumes.length})</CardTitle>
							</CardHeader>
							<CardContent class="space-y-1">
								{#each data.search.volumes as hit (hit.id)}
									<button
										type="button"
										class="flex w-full items-center gap-2 rounded-md p-2 text-left transition hover:bg-muted/50"
										onclick={() => openSearchVolume(hit.bookId, hit.id)}
									>
										<Layers class="h-4 w-4 shrink-0 text-muted-foreground" />
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">
												Том {hit.volumeNumber}: {hit.title}
											</p>
											<p class="truncate text-xs text-muted-foreground">{hit.bookTitle}</p>
										</div>
									</button>
								{/each}
							</CardContent>
						</Card>
					{/if}

					{#if data.search.chapters.length > 0}
						<Card class="border-border/50">
							<CardHeader class="pb-2">
								<CardTitle class="text-sm">Главы ({data.search.chapters.length})</CardTitle>
							</CardHeader>
							<CardContent class="space-y-1">
								{#each data.search.chapters as hit (hit.id)}
									<button
										type="button"
										class="flex w-full items-center gap-2 rounded-md p-2 text-left transition hover:bg-muted/50"
										onclick={() => openSearchChapter(hit.bookId, hit.volumeId, hit.id)}
									>
										<Disc3 class="h-4 w-4 shrink-0 text-muted-foreground" />
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">
												Глава {hit.chapterNumber}: {hit.title}
											</p>
											<p class="truncate text-xs text-muted-foreground">
												{hit.bookTitle} · Том {hit.volumeNumber} · {formatDuration(
													hit.durationSeconds
												)}
											</p>
										</div>
									</button>
								{/each}
							</CardContent>
						</Card>
					{/if}

					{#if data.search.tracks.length > 0}
						<Card class="border-border/50">
							<CardHeader class="pb-2">
								<CardTitle class="text-sm">Архивные версии ({data.search.tracks.length})</CardTitle>
							</CardHeader>
							<CardContent class="space-y-1">
								{#each data.search.tracks as hit (hit.id)}
									<button
										type="button"
										class="flex w-full items-center gap-2 rounded-md p-2 text-left transition hover:bg-muted/50"
										onclick={() => openSearchChapter(hit.bookId, hit.volumeId, hit.chapterId)}
									>
										<Archive class="h-4 w-4 shrink-0 text-muted-foreground" />
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{hit.title}</p>
											<p class="truncate text-xs text-muted-foreground">
												{hit.bookTitle} · Том {hit.volumeNumber} · Глава {hit.chapterNumber}:
												{hit.chapterTitle}
											</p>
										</div>
										<Badge variant="outline" class="text-[10px]">{hit.versionId}</Badge>
									</button>
								{/each}
							</CardContent>
						</Card>
					{/if}

					{#if data.search.illustrations.length > 0}
						<Card class="border-border/50">
							<CardHeader class="pb-2">
								<CardTitle class="text-sm"
									>Иллюстрации ({data.search.illustrations.length})</CardTitle
								>
							</CardHeader>
							<CardContent class="space-y-1">
								{#each data.search.illustrations as hit (hit.id)}
									<button
										type="button"
										class="flex w-full items-center gap-2 rounded-md p-2 text-left transition hover:bg-muted/50"
										onclick={() => openSearchIllustration(hit.bookId, hit.volumeId)}
									>
										<BlurhashImage
											src={hit.imageUrl}
											alt=""
											class="h-10 w-14 shrink-0 rounded object-cover"
											blurhash={hit.blurhash}
										/>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">
												{hit.caption || 'Без подписи'}
											</p>
											<p class="truncate text-xs text-muted-foreground">
												{hit.bookTitle} · Том {hit.volumeNumber}
											</p>
										</div>
									</button>
								{/each}
							</CardContent>
						</Card>
					{/if}
				</div>
			{/if}
		</section>
	{:else}
		{#if data.books.length === 0}
			<Card class="border-border/50">
				<CardContent class="flex flex-col items-center gap-2 py-16 text-center">
					<BookOpen class="h-9 w-9 text-muted-foreground" />
					<p class="text-sm font-medium">В базе ещё нет книг</p>
					<p class="max-w-md text-xs text-muted-foreground">
						Создайте первую книгу, затем добавьте к ней тома, главы и иллюстрации.
					</p>
					<Button size="sm" class="mt-2 gap-1.5" onclick={() => (bookDialog = { book: null })}>
						<Plus class="h-4 w-4" />
						Создать книгу
					</Button>
				</CardContent>
			</Card>
		{:else}
			<form
				bind:this={reorderForm}
				method="POST"
				action="?/booksReorder"
				use:enhance={reorderEnhance}
				class="hidden"
			>
				<input type="hidden" name="order" value={pendingBookOrder} />
			</form>
			<section class="space-y-2">
				<div class="flex items-center justify-between gap-2">
					<h2 class="flex items-center gap-2 text-sm font-semibold">
						<BookOpen class="h-4 w-4 text-primary" />
						Книги
						<span class="font-mono text-xs text-muted-foreground">({data.books.length})</span>
					</h2>
				</div>
				<div class="flex gap-2.5 overflow-x-auto pb-1" role="list" aria-label="Книги">
					{#each data.books as book (book.id)}
						{@const selected = selectedBook?.id === book.id}
						<div
							role="listitem"
							data-book-id={book.id}
							aria-label={'Книга ' + book.title + '. Перетащите, чтобы изменить порядок.'}
							draggable="true"
							title="Перетащите, чтобы изменить порядок"
							ondragstart={(event) => startBookDrag(event, book.id)}
							ondragover={allowBookDrop}
							ondrop={(event) => dropBook(event, book.id)}
							ondragend={endBookDrag}
							class={cn(
								'w-[230px] shrink-0 cursor-grab rounded-xl border bg-card p-2.5 transition active:cursor-grabbing',
								selected
									? 'border-primary shadow-sm ring-1 ring-primary/25'
									: 'border-border/50 hover:border-primary/30',
								draggedBookId === book.id && 'opacity-50'
							)}
						>
							<button
								type="button"
								class="flex w-full items-start gap-2.5 text-left"
								onclick={() => selectBook(book.id)}
							>
								<div
									class="h-16 w-11 shrink-0 overflow-hidden rounded border border-border/40 bg-muted"
								>
									{#if book.coverUrl}
										<span
											role="button"
											tabindex="0"
											title="Открыть обложку"
											class="block h-full w-full cursor-zoom-in"
											onclick={(event) => {
												event.stopPropagation();
												openMedia(book.coverUrl, book.title);
											}}
											onkeydown={(event) => {
												if (event.key === 'Enter' || event.key === ' ') {
													event.preventDefault();
													event.stopPropagation();
													openMedia(book.coverUrl, book.title);
												}
											}}
										>
											<BlurhashImage
												src={book.coverUrl}
												alt={book.title}
												class="h-full w-full object-cover"
												blurhash={book.blurhash}
											/>
										</span>
									{:else}
										<div class="flex h-full w-full items-center justify-center">
											<BookOpen class="h-4 w-4 text-muted-foreground" />
										</div>
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<span
										role="link"
										tabindex="0"
										title="Открыть книгу на сайте"
										class="line-clamp-2 cursor-pointer text-sm leading-tight font-semibold hover:underline"
										onclick={(event) => {
											event.stopPropagation();
											openPublic(`/books/${book.id}`);
										}}
										onkeydown={(event) => handleTitleKeydown(event, `/books/${book.id}`)}
										>{book.title}</span
									>
									<p class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
										{book.id}
									</p>
									<div class="mt-1 flex flex-wrap gap-1">
										<Badge variant={statusVariant(book.status)} class="text-[10px]">
											{statusLabel(book.status)}
										</Badge>
										<Badge variant="outline" class="text-[10px]">Томов: {book.volumeCount}</Badge>
										{#if book.homeVideoUrl || book.homeImageUrl}
											<Badge variant="secondary" class="text-[10px]">Главная</Badge>
										{/if}
									</div>
								</div>
							</button>
							<div class="mt-2 flex items-center justify-between border-t border-border/40 pt-1">
								<span class="flex items-center gap-1 text-[10px] text-muted-foreground">
									<GripVertical class="h-3 w-3" />
									{book.themeColor ? '#' + book.themeColor : 'Без темы'}
								</span>
								<div class="flex items-center gap-0.5">
									<Button
										size="icon-xs"
										variant="ghost"
										title="Редактировать книгу"
										aria-label={'Редактировать книгу ' + book.title}
										onclick={() => (bookDialog = { book })}
									>
										<Pencil class="h-3 w-3" />
									</Button>
									<ConfirmDeleteForm
										id={book.id}
										action="?/bookDelete"
										title={'Удалить книгу «' + book.title + '»?'}
										description="Все тома, главы, архивные версии и иллюстрации книги будут удалены."
										onDeleted={() => handleBookDeleted(selected)}
										onError={notifyError}
									/>
								</div>
							</div>
						</div>
					{/each}
					<button
						type="button"
						class="flex w-[140px] shrink-0 flex-col items-center justify-center gap-1 self-stretch rounded-xl border border-dashed border-border/70 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
						onclick={() => (bookDialog = { book: null })}
					>
						<Plus class="h-4 w-4" />
						Новая книга
					</button>
				</div>
			</section>

			{#if selectedBook}
				<section class="space-y-2">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h2 class="flex items-center gap-2 text-sm font-semibold">
							<Layers class="h-4 w-4 text-primary" />
							Тома
							<span class="font-mono text-xs text-muted-foreground">({data.volumes.length})</span>
						</h2>
						<div class="flex flex-wrap items-center justify-end gap-1.5">
							<select
								bind:value={volumeSort}
								aria-label="Сортировка томов"
								class="flex h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
							>
								{#each volumeSortOptions as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
							<Button
								size="icon-sm"
								variant="outline"
								title={volumeDirection === 'asc' ? 'Тома: по возрастанию' : 'Тома: по убыванию'}
								aria-label={volumeDirection === 'asc'
									? 'Тома: по возрастанию'
									: 'Тома: по убыванию'}
								onclick={() => (volumeDirection = volumeDirection === 'asc' ? 'desc' : 'asc')}
							>
								{#if volumeDirection === 'asc'}
									<ArrowUp class="h-3.5 w-3.5" />
								{:else}
									<ArrowDown class="h-3.5 w-3.5" />
								{/if}
							</Button>
							<Button
								size="sm"
								variant="outline"
								class="gap-1.5"
								onclick={() => (volumeDialogOpen = true)}
							>
								<Plus class="h-3.5 w-3.5" />
								Новый том
							</Button>
						</div>
					</div>

					{#if data.volumes.length === 0}
						<div class="rounded-xl border border-dashed border-border/60 p-6 text-center">
							<p class="text-sm font-medium">В книге «{selectedBook.title}» ещё нет томов</p>
							<p class="mt-1 text-xs text-muted-foreground">
								Создайте первый том, чтобы добавлять главы и иллюстрации.
							</p>
							<Button size="sm" class="mt-3 gap-1.5" onclick={() => (volumeDialogOpen = true)}>
								<Plus class="h-4 w-4" />
								Создать том
							</Button>
						</div>
					{:else}
						<div class="flex gap-2 overflow-x-auto pb-1">
							{#each sortedVolumes as volume (volume.id)}
								{@const selected = selectedVolume?.id === volume.id}
								<button
									type="button"
									class={cn(
										'flex w-[220px] shrink-0 items-center gap-2 rounded-lg border p-2 text-left transition',
										selected
											? 'border-primary bg-primary/5 ring-1 ring-primary/25'
											: 'border-border/50 bg-card hover:border-primary/30'
									)}
									onclick={() => selectVolume(volume.id)}
								>
									<div
										class="h-14 w-10 shrink-0 overflow-hidden rounded border border-border/40 bg-muted"
									>
										{#if volume.coverUrl}
											<span
												role="button"
												tabindex="0"
												title="Открыть обложку"
												class="block h-full w-full cursor-zoom-in"
												onclick={(event) => {
													event.stopPropagation();
													openMedia(volume.coverUrl, volume.title);
												}}
												onkeydown={(event) => {
													if (event.key === 'Enter' || event.key === ' ') {
														event.preventDefault();
														event.stopPropagation();
														openMedia(volume.coverUrl, volume.title);
													}
												}}
											>
												<BlurhashImage
													src={volume.coverUrl}
													alt={volume.title}
													class="h-full w-full object-cover"
													blurhash={volume.blurhash}
												/>
											</span>
										{:else}
											<div class="flex h-full w-full items-center justify-center">
												<Layers class="h-4 w-4 text-muted-foreground" />
											</div>
										{/if}
									</div>
									<div class="min-w-0 flex-1">
										<div class="flex items-center justify-between gap-2">
											<span class="font-mono text-[10px] text-muted-foreground">
												Том {volume.volumeNumber}
											</span>
											<Badge variant={statusVariant(volume.status)} class="text-[9px]">
												{statusLabel(volume.status)}
											</Badge>
										</div>
										<span
											role="link"
											tabindex="0"
											title="Открыть том на сайте"
											class="mt-0.5 block truncate text-xs font-semibold hover:underline"
											onclick={(event) => {
												event.stopPropagation();
												if (selectedBook) openPublic(`/books/${selectedBook.id}/${volume.id}`);
											}}
											onkeydown={(event) => {
												if (selectedBook)
													handleTitleKeydown(event, `/books/${selectedBook.id}/${volume.id}`);
											}}>{volume.title}</span
										>
										<p class="mt-1 text-[10px] text-muted-foreground">
											{volume.chapterCount} гл. · {volume.illustrationCount} илл.
										</p>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</section>
			{/if}

			{#if selectedVolume}
				<div class="space-y-4">
					<Card class="border-border/50">
						<CardContent
							class="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between"
						>
							<div class="flex min-w-0 items-start gap-3">
								<div
									class="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border/40 bg-muted"
								>
									{#if selectedVolume.coverUrl}
										<button
											type="button"
											class="group relative h-full w-full cursor-zoom-in"
											title="Открыть обложку"
											onclick={() => openMedia(selectedVolume.coverUrl, selectedVolume.title)}
										>
											<BlurhashImage
												src={selectedVolume.coverUrl}
												alt={selectedVolume.title}
												class="h-full w-full object-cover"
												blurhash={selectedVolume.blurhash}
											/>
											<span
												class="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100"
											>
												<ImageIcon class="h-4 w-4" />
											</span>
										</button>
									{:else}
										<div class="flex h-full w-full items-center justify-center">
											<Layers class="h-5 w-5 text-muted-foreground" />
										</div>
									{/if}
								</div>
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
										<BookOpen class="h-3 w-3" />
										<span class="truncate">{selectedBook?.title}</span>
										<ChevronRight class="h-3 w-3 shrink-0" />
										<span class="truncate">Том {selectedVolume.volumeNumber}</span>
									</div>
									<h2 class="mt-1 truncate text-xl font-bold tracking-tight">
										{#if selectedBook}
											<a
												href={resolve('/books/[bookId]/[volumeId]', {
													bookId: selectedBook.id,
													volumeId: selectedVolume.id
												})}
												class="transition hover:underline">{selectedVolume.title}</a
											>
										{:else}
											{selectedVolume.title}
										{/if}
									</h2>
									<div class="mt-2 flex flex-wrap items-center gap-1.5">
										<Badge variant={statusVariant(selectedVolume.status)}>
											{statusLabel(selectedVolume.status)}
										</Badge>
										<Badge variant="outline" class="gap-1">
											<Disc3 class="h-3 w-3" />
											{data.chapters.length}
											{plural(data.chapters.length, ['глава', 'главы', 'глав'])}
										</Badge>
										<Badge variant="outline" class="gap-1">
											<Archive class="h-3 w-3" />
											{data.tracks.length} в архиве
										</Badge>
										<Badge variant="outline" class="gap-1">
											<ImageIcon class="h-3 w-3" />
											{data.illustrations.length}
											{plural(data.illustrations.length, [
												'иллюстрация',
												'иллюстрации',
												'иллюстраций'
											])}
										</Badge>
									</div>
								</div>
							</div>
							<div class="flex shrink-0 flex-wrap gap-2">
								{#if selectedBook}
									<Button
										href={'/books/' + selectedBook.id + '/' + selectedVolume.id}
										target="_blank"
										variant="outline"
										size="sm"
										class="gap-1.5"
									>
										<ExternalLink class="h-3.5 w-3.5" />
										На сайте
									</Button>
								{/if}
								<Button
									variant="outline"
									size="sm"
									class="gap-1.5"
									onclick={() => selectTab('volume')}
								>
									<Pencil class="h-3.5 w-3.5" />
									Редактировать том
								</Button>
							</div>
						</CardContent>
					</Card>

					<div class="flex flex-wrap items-center gap-1 rounded-lg bg-muted/60 p-1">
						<button
							type="button"
							class={cn(
								'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
								activeTab === 'chapters'
									? 'bg-background text-foreground shadow-xs'
									: 'text-muted-foreground hover:text-foreground'
							)}
							onclick={() => selectTab('chapters')}
						>
							<Disc3 class="h-3.5 w-3.5" />
							Главы
							<span class="font-mono text-[10px] text-muted-foreground">{data.chapters.length}</span
							>
						</button>
						<button
							type="button"
							class={cn(
								'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
								activeTab === 'illustrations'
									? 'bg-background text-foreground shadow-xs'
									: 'text-muted-foreground hover:text-foreground'
							)}
							onclick={() => selectTab('illustrations')}
						>
							<ImageIcon class="h-3.5 w-3.5" />
							Иллюстрации
							<span class="font-mono text-[10px] text-muted-foreground">
								{data.illustrations.length}
							</span>
						</button>
						<button
							type="button"
							class={cn(
								'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
								activeTab === 'volume'
									? 'bg-background text-foreground shadow-xs'
									: 'text-muted-foreground hover:text-foreground'
							)}
							onclick={() => selectTab('volume')}
						>
							<Layers class="h-3.5 w-3.5" />
							Том
						</button>
					</div>

					{#if activeTab === 'chapters'}
						<Card class="border-border/50">
							<CardHeader class="flex flex-row flex-wrap items-start justify-between gap-2 pb-3">
								<div>
									<CardTitle class="flex items-center gap-2 text-base">
										<Disc3 class="h-4 w-4 text-primary" />
										Главы
									</CardTitle>
									<CardDescription class="mt-1 text-xs">
										{data.chapters.length}
										{plural(data.chapters.length, ['глава', 'главы', 'глав'])} · {formatDuration(
											totalDuration
										)} общей длительности
									</CardDescription>
								</div>
								<div class="flex flex-wrap items-center justify-end gap-1.5">
									<select
										bind:value={chapterSort}
										aria-label="Сортировка глав"
										class="flex h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
									>
										{#each chapterSortOptions as option (option.value)}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
									<Button
										size="icon-sm"
										variant="outline"
										title={chapterDirection === 'asc'
											? 'Главы: по возрастанию'
											: 'Главы: по убыванию'}
										aria-label={chapterDirection === 'asc'
											? 'Главы: по возрастанию'
											: 'Главы: по убыванию'}
										onclick={() => (chapterDirection = chapterDirection === 'asc' ? 'desc' : 'asc')}
									>
										{#if chapterDirection === 'asc'}
											<ArrowUp class="h-3.5 w-3.5" />
										{:else}
											<ArrowDown class="h-3.5 w-3.5" />
										{/if}
									</Button>
									<Button
										size="sm"
										class="gap-1.5"
										onclick={() => (chapterDialogId = 'new')}
										disabled={!selectedVolume}
									>
										<Plus class="h-3.5 w-3.5" />
										Добавить главу
									</Button>
								</div>
							</CardHeader>
							<CardContent class="p-0">
								{#if data.chapters.length === 0}
									<div class="flex flex-col items-center gap-1 px-4 py-12 text-center">
										<Disc3 class="h-8 w-8 text-muted-foreground" />
										<p class="text-sm font-medium">В томе ещё нет глав</p>
										<p class="text-xs text-muted-foreground">
											Загрузите аудиофайл, укажите номер и название главы.
										</p>
										<Button
											size="sm"
											class="mt-2 gap-1.5"
											onclick={() => (chapterDialogId = 'new')}
										>
											<Plus class="h-4 w-4" />
											Добавить первую главу
										</Button>
									</div>
								{:else}
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead class="w-14">№</TableHead>
												<TableHead>Глава</TableHead>
												<TableHead class="hidden w-24 sm:table-cell">Время</TableHead>
												<TableHead class="hidden w-16 md:table-cell">TG</TableHead>
												<TableHead class="hidden w-24 sm:table-cell">Версии</TableHead>
												<TableHead class="w-28 text-right">Действия</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{#each sortedChapters as chapter (chapter.id)}
												{@const chapterTracks = tracksByChapter[chapter.id] ?? []}
												<TableRow>
													<TableCell class="font-mono text-xs">{chapter.chapterNumber}</TableCell>
													<TableCell>
														<button
															type="button"
															class="block max-w-80 text-left"
															onclick={() => (chapterDialogId = chapter.id)}
														>
															<span
																role="link"
																tabindex="0"
																title="Открыть главу на сайте"
																class="block cursor-pointer truncate text-sm font-medium hover:underline"
																onkeydown={(event) => {
																	if (selectedBook && selectedVolume)
																		handleTitleKeydown(
																			event,
																			`/books/${selectedBook.id}/${selectedVolume.id}?chapter=${chapter.id}`
																		);
																}}
																onclick={(event) => {
																	event.stopPropagation();
																	if (selectedBook && selectedVolume) {
																		openPublic(
																			`/books/${selectedBook.id}/${selectedVolume.id}?chapter=${chapter.id}`
																		);
																	}
																}}
															>
																{chapter.title}
															</span>
															<span
																class="block truncate font-mono text-[10px] text-muted-foreground"
															>
																{chapter.id}
															</span>
														</button>
													</TableCell>
													<TableCell class="hidden font-mono text-xs sm:table-cell">
														{formatDuration(chapter.durationSeconds)}
													</TableCell>
													<TableCell class="hidden md:table-cell">
														{#if chapter.telegramPostUrl}
															<button
																type="button"
																class="inline-flex text-blue-500 hover:text-blue-600"
																aria-label="Открыть пост в Telegram"
																onclick={() => openExternal(chapter.telegramPostUrl)}
															>
																<MessageSquare class="h-4 w-4" />
															</button>
														{:else}
															<span class="text-xs text-muted-foreground">—</span>
														{/if}
													</TableCell>
													<TableCell class="hidden sm:table-cell">
														{#if chapterTracks.length > 0}
															<Badge variant="secondary" class="gap-1 text-[10px]">
																<Archive class="h-3 w-3" />
																{chapterTracks.length}
															</Badge>
														{:else}
															<span class="text-xs text-muted-foreground">—</span>
														{/if}
													</TableCell>
													<TableCell class="text-right">
														<div class="flex items-center justify-end gap-0.5">
															<Button
																onclick={() => playChapterAudio(chapter)}
																size="icon-sm"
																variant="ghost"
																title="Слушать аудио"
																aria-label={'Слушать ' + chapter.title}
															>
																<Play class="h-3.5 w-3.5" />
															</Button>
															<Button
																size="icon-sm"
																variant="ghost"
																title="Редактировать главу"
																aria-label={'Редактировать ' + chapter.title}
																onclick={() => (chapterDialogId = chapter.id)}
															>
																<Pencil class="h-3.5 w-3.5" />
															</Button>
															<ConfirmDeleteForm
																id={chapter.id}
																action="?/chapterDelete"
																title={'Удалить главу «' + chapter.title + '»?'}
																description="Аудио и архивные версии главы также будут удалены."
																onDeleted={() => handleChapterDeleted(chapter.id)}
																onError={notifyError}
															/>
														</div>
													</TableCell>
												</TableRow>
											{/each}
										</TableBody>
									</Table>
								{/if}
							</CardContent>
						</Card>
					{:else if activeTab === 'illustrations'}
						<Card class="border-border/50">
							<CardHeader class="flex flex-row flex-wrap items-start justify-between gap-2 pb-3">
								<div>
									<CardTitle class="flex items-center gap-2 text-base">
										<ImageIcon class="h-4 w-4 text-primary" />
										Иллюстрации
									</CardTitle>
									<CardDescription class="mt-1 text-xs">
										Иллюстрации с таймкодом сортируются автоматически. Остальные можно
										перетаскивать.
									</CardDescription>
								</div>
								<Button
									size="sm"
									class="gap-1.5"
									onclick={() => (illustrationDialog = { illustration: null })}
								>
									<Plus class="h-3.5 w-3.5" />
									Добавить иллюстрацию
								</Button>
							</CardHeader>
							<CardContent>
								<form
									bind:this={illustrationReorderForm}
									method="POST"
									action="?/illustrationReorder"
									use:enhance={moveEnhance}
									class="hidden"
								>
									<input type="hidden" name="volumeId" value={data.selectedVolume?.id ?? ''} />
									<input type="hidden" name="order" value={illustrationOrder} />
								</form>
								{#if data.illustrations.length === 0}
									<div class="flex flex-col items-center gap-1 py-12 text-center">
										<ImageIcon class="h-8 w-8 text-muted-foreground" />
										<p class="text-sm font-medium">Иллюстраций пока нет</p>
										<p class="text-xs text-muted-foreground">
											Загрузите арт или укажите ссылку на изображение.
										</p>
										<Button
											size="sm"
											class="mt-2 gap-1.5"
											onclick={() => (illustrationDialog = { illustration: null })}
										>
											<Plus class="h-4 w-4" />
											Добавить иллюстрацию
										</Button>
									</div>
								{:else}
									<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" role="list">
										{#each orderedIllustrations as illustration (illustration.id)}
											{@const timing = illustrationTimingsById.get(illustration.id)}
											<div
												role="listitem"
												aria-label={illustration.caption || 'Иллюстрация'}
												class="overflow-hidden rounded-lg border border-border/50 transition {timing
													? 'border-primary/20'
													: 'cursor-grab active:cursor-grabbing'} {illustrationDragId ===
												illustration.id
													? 'opacity-50'
													: ''} {illustrationDropTargetId === illustration.id
													? 'ring-2 ring-primary'
													: ''}"
												draggable={!timing}
												ondragstart={(event) => startIllustrationDrag(event, illustration)}
												ondragover={(event) => allowIllustrationDrop(event, illustration.id)}
												ondrop={(event) => void dropIllustration(event, illustration.id)}
												ondragend={endIllustrationDrag}
											>
												<button
													type="button"
													class="block aspect-[4/3] w-full bg-muted"
													aria-label={'Открыть иллюстрацию ' + (illustration.caption ?? '')}
													onclick={() =>
														openMedia(illustration.imageUrl, illustration.caption || 'Иллюстрация')}
												>
													<BlurhashImage
														src={illustration.imageUrl}
														alt={illustration.caption ?? 'Иллюстрация'}
														class="h-full w-full object-cover"
														loading="lazy"
														blurhash={illustration.blurhash}
													/>
												</button>
												<div class="space-y-1.5 p-2">
													<p class="truncate text-xs font-medium">
														{illustration.caption || 'Без подписи'}
													</p>
													{#if timing}
														<p
															class="truncate text-[10px] text-primary"
															title={timing.chapterTitle}
														>
															Гл. {timing.chapterNumber} · {formatDuration(timing.showAtSeconds)}
														</p>
														<p class="text-[9px] text-muted-foreground">Авто по таймингу</p>
													{:else}
														<p class="flex items-center gap-1 text-[10px] text-muted-foreground">
															<GripVertical class="h-3 w-3" />
															Без таймкода · перетащите
														</p>
													{/if}
													<div class="flex items-center justify-end gap-0.5">
														<Button
															size="icon-xs"
															variant="ghost"
															title="Редактировать"
															aria-label="Редактировать иллюстрацию"
															onclick={() => (illustrationDialog = { illustration })}
														>
															<Pencil class="h-3 w-3" />
														</Button>
														<ConfirmDeleteForm
															id={illustration.id}
															action="?/illustrationDelete"
															title="Удалить иллюстрацию?"
															description="Изображение будет удалено из хранилища."
															onDeleted={() => handleIllustrationDeleted(illustration.id)}
															onError={notifyError}
														/>
													</div>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</CardContent>
						</Card>
					{:else}
						<Card class="border-border/50">
							<CardHeader class="pb-3">
								<CardTitle class="flex items-center gap-2 text-base">
									<Layers class="h-4 w-4 text-primary" />
									Данные тома
								</CardTitle>
								<CardDescription class="mt-1 text-xs">
									Метаданные и обложка тома. ID: <span class="font-mono">{selectedVolume.id}</span>
								</CardDescription>
							</CardHeader>
							<CardContent>
								{#if selectedBook}
									{#key selectedVolume.id}
										<VolumeForm
											bookId={selectedBook.id}
											volume={selectedVolume}
											onSaved={handleVolumeInlineSaved}
											onDeleted={handleVolumeDeleted}
										/>
									{/key}
								{/if}
							</CardContent>
						</Card>
					{/if}
				</div>
			{:else if selectedBook}
				<Card class="border-border/50">
					<CardContent class="flex flex-col items-center gap-2 py-16 text-center">
						<Layers class="h-9 w-9 text-muted-foreground" />
						<p class="text-sm font-medium">Выберите том</p>
						<p class="max-w-sm text-xs text-muted-foreground">
							Создайте том в книге «{selectedBook.title}» или выберите существующий выше.
						</p>
						<Button size="sm" class="mt-2 gap-1.5" onclick={() => (volumeDialogOpen = true)}>
							<Plus class="h-4 w-4" />
							Создать том
						</Button>
					</CardContent>
				</Card>
			{/if}
		{/if}
	{/if}
</div>

{#if bookDialog}
	<BookDialog
		book={bookDialog.book}
		onClose={() => (bookDialog = null)}
		onSaved={handleBookSaved}
	/>
{/if}

{#if volumeDialogOpen && selectedBook}
	<VolumeCreateDialog
		bookId={selectedBook.id}
		bookTitle={selectedBook.title}
		onClose={() => (volumeDialogOpen = false)}
		onSaved={handleVolumeCreated}
	/>
{/if}

{#if chapterDialogId && selectedVolume}
	{#if chapterDialogId === 'new' || chapterDialogChapter}
		<ChapterDialog
			chapter={chapterDialogChapter}
			volumeId={selectedVolume.id}
			volumeTitle={(selectedBook?.title ?? '') + ' · Том ' + selectedVolume.volumeNumber}
			tracks={chapterDialogChapter ? (tracksByChapter[chapterDialogChapter.id] ?? []) : []}
			audioVersions={data.audioVersions}
			onClose={() => (chapterDialogId = null)}
			onSaved={handleChapterSaved}
			onToast={notify}
		/>
	{/if}
{/if}

{#if illustrationDialog && selectedVolume}
	{@const dialogIllustrationId = illustrationDialog.illustration?.id ?? ''}
	<IllustrationDialog
		illustration={illustrationDialog.illustration}
		volumeId={selectedVolume.id}
		nextSortOrder={nextIllustrationSort}
		chapters={data.chapters}
		timings={illustrationDialog.illustration
			? data.chapterIllustrationTimings
					.filter((timing) => timing.illustrationId === dialogIllustrationId)
					.map((timing) => ({
						chapterId: timing.chapterId,
						showAtSeconds: timing.showAtSeconds
					}))
			: []}
		onClose={() => (illustrationDialog = null)}
		onSaved={handleIllustrationSaved}
		onToast={notify}
	/>
{/if}

{#if toast}
	<div
		class={cn(
			'fixed right-4 bottom-4 z-[60] flex max-w-sm items-start gap-2 rounded-xl border bg-background p-3 text-sm shadow-lg',
			toast.kind === 'error'
				? 'border-destructive/30 text-destructive'
				: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
		)}
		role={toast.kind === 'error' ? 'alert' : 'status'}
	>
		{#if toast.kind === 'error'}
			<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
		{:else}
			<CircleCheck class="mt-0.5 h-4 w-4 shrink-0" />
		{/if}
		<p class="min-w-0 flex-1">{toast.text}</p>
		<button
			type="button"
			class="shrink-0 rounded-md p-0.5 opacity-70 transition hover:bg-foreground/10 hover:opacity-100"
			aria-label="Скрыть сообщение"
			onclick={dismissToast}
		>
			<X class="h-3.5 w-3.5" />
		</button>
	</div>
{/if}

<MediaLightbox bind:open={mediaOpen} src={mediaSrc} title={mediaTitle} kind={mediaKind} />
