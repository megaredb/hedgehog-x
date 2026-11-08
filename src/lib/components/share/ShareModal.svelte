<script lang="ts">
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { OfflineBook, OfflineVolume, OfflineChapter } from '$lib/client/db';
	import { buildShareUrl, buildShareText, formatShareTime } from './share.js';
	import { Share2, Copy, Check, Clock, BookOpen, Radio } from '@lucide/svelte';

	interface Props {
		open?: boolean;
		book?: { id?: string; title?: string } | OfflineBook | null;
		volume?:
			| {
					id: string;
					title: string;
					volumeNumber?: number;
					coverUrl?: string;
					description?: string | null;
					bookId?: string;
			  }
			| OfflineVolume
			| null;
		chapters?: OfflineChapter[];
		currentChapterId?: string | null;
		currentTime?: number;
	}

	let {
		open = $bindable(false),
		book = null,
		volume = null,
		chapters = [],
		currentChapterId = null,
		currentTime = 0
	}: Props = $props();

	type ShareScope = 'volume' | 'chapter';

	let userScope = $state<ShareScope | null>(null);
	let userSelectedChapterId = $state<string | null>(null);
	let userIncludeTimestamp = $state<boolean | null>(null);
	let userCustomTimestamp = $state<number | null>(null);

	let copiedLink = $state(false);
	let copiedText = $state(false);

	let linkTimeout: ReturnType<typeof setTimeout> | null = null;
	let textTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleModalClose() {
		userScope = null;
		userSelectedChapterId = null;
		userIncludeTimestamp = null;
		userCustomTimestamp = null;
	}

	const defaultScope: ShareScope = $derived(
		currentChapterId && chapters.some((c) => c.id === currentChapterId) ? 'chapter' : 'volume'
	);
	const scope: ShareScope = $derived(userScope ?? defaultScope);

	const defaultChapterId = $derived(
		currentChapterId && chapters.some((c) => c.id === currentChapterId)
			? currentChapterId
			: chapters[0]?.id || ''
	);
	const selectedChapterId = $derived(userSelectedChapterId ?? defaultChapterId);

	const defaultSeconds = $derived(Math.max(0, Math.floor(currentTime || 0)));
	const customTimestamp = $derived(userCustomTimestamp ?? defaultSeconds);

	const defaultIncludeTimestamp = $derived(defaultScope === 'chapter' && defaultSeconds > 0);
	const includeTimestamp = $derived(userIncludeTimestamp ?? defaultIncludeTimestamp);

	const origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
	const bookId = $derived(volume?.bookId || book?.id || '');
	const volumeId = $derived(volume?.id || '');

	const selectedChapter = $derived(
		chapters.find((c) => c.id === selectedChapterId) || chapters[0] || null
	);

	const shareUrl = $derived.by(() => {
		return buildShareUrl({
			origin,
			bookId,
			volumeId,
			chapterId: scope === 'chapter' ? selectedChapter?.id : null,
			timestamp: scope === 'chapter' && includeTimestamp ? customTimestamp : null
		});
	});

	const shareTitle = $derived.by(() => {
		if (scope === 'chapter' && selectedChapter) {
			return `${selectedChapter.title} | ${volume?.title || 'Том'} | Hedgehog X`;
		}
		return `${volume?.title || 'Том'} | Hedgehog X`;
	});

	const shareText = $derived.by(() => {
		return buildShareText({
			bookTitle: book?.title,
			volumeTitle: volume?.title,
			volumeNumber: volume?.volumeNumber,
			chapterTitle: scope === 'chapter' ? selectedChapter?.title : null,
			chapterNumber: scope === 'chapter' ? selectedChapter?.chapterNumber : null,
			timestamp: customTimestamp,
			includeTimestamp: scope === 'chapter' && includeTimestamp,
			url: shareUrl
		});
	});

	const canNativeShare = $derived(
		typeof navigator !== 'undefined' && typeof navigator.share === 'function'
	);

	async function handleCopyLink() {
		if (typeof navigator === 'undefined' || !navigator.clipboard) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			copiedLink = true;
			if (linkTimeout) clearTimeout(linkTimeout);
			linkTimeout = setTimeout(() => {
				copiedLink = false;
			}, 2000);
		} catch {
			/* ignore clipboard failure */
		}
	}

	async function handleCopyText() {
		if (typeof navigator === 'undefined' || !navigator.clipboard) return;
		try {
			await navigator.clipboard.writeText(shareText);
			copiedText = true;
			if (textTimeout) clearTimeout(textTimeout);
			textTimeout = setTimeout(() => {
				copiedText = false;
			}, 2000);
		} catch {
			/* ignore clipboard failure */
		}
	}

	async function handleNativeShare() {
		if (!canNativeShare) return;
		try {
			await navigator.share({
				title: shareTitle,
				text: shareText,
				url: shareUrl
			});
		} catch {
			/* user cancelled share */
		}
	}
</script>

<BaseModal
	bind:open
	title="Поделиться"
	description="Отправьте ссылку на весь том или конкретный таймкод главы."
	widthClass="sm:max-w-lg"
	onClose={handleModalClose}
>
	<div class="flex flex-col gap-5 py-2">
		<!-- Карточка информации о томе -->
		{#if volume}
			<div class="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 p-3">
				{#if volume.coverUrl}
					<img
						src={volume.coverUrl}
						alt={volume.title}
						class="h-14 w-10 shrink-0 rounded-lg object-cover shadow-xs"
					/>
				{/if}
				<div class="min-w-0 flex-1">
					<p class="truncate text-xs font-medium text-muted-foreground">
						{book?.title || 'Аудиокнига'}
					</p>
					<h3 class="truncate text-sm font-bold text-foreground">
						{volume.title}
					</h3>
					{#if volume.volumeNumber}
						<span class="text-[11px] text-muted-foreground">Том {volume.volumeNumber}</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Переключатель: Весь том / Конкретная глава -->
		<div class="space-y-1.5">
			<div class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
				Что отправить
			</div>
			<div class="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-1">
				<button
					type="button"
					onclick={() => (userScope = 'volume')}
					class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all {scope ===
					'volume'
						? 'bg-background text-foreground shadow-xs'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					<BookOpen class="h-3.5 w-3.5" />
					<span>Весь том</span>
				</button>
				<button
					type="button"
					onclick={() => {
						userScope = 'chapter';
						if (!userSelectedChapterId && chapters.length > 0) {
							userSelectedChapterId = chapters[0].id;
						}
					}}
					class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all {scope ===
					'chapter'
						? 'bg-background text-foreground shadow-xs'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					<Radio class="h-3.5 w-3.5" />
					<span>Глава и таймкод</span>
				</button>
			</div>
		</div>

		<!-- Настройки главы и таймкода при выборе "Глава и таймкод" -->
		{#if scope === 'chapter'}
			<div class="space-y-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-2xs">
				<div class="space-y-1">
					<label for="share-chapter-select" class="text-xs font-medium text-foreground">
						Выберите главу:
					</label>
					{#if chapters.length > 0}
						<select
							id="share-chapter-select"
							value={selectedChapterId}
							onchange={(e) => (userSelectedChapterId = e.currentTarget.value)}
							class="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium shadow-xs focus:ring-2 focus:ring-primary focus:outline-none"
						>
							{#each chapters as ch (ch.id)}
								<option value={ch.id}>
									Глава {ch.chapterNumber}: {ch.title}
								</option>
							{/each}
						</select>
					{:else}
						<p class="text-xs text-muted-foreground">В этом томе нет доступных глав.</p>
					{/if}
				</div>

				<!-- Чекбокс привязки к текущему времени -->
				<div class="flex items-center justify-between border-t border-border/40 pt-1">
					<label
						for="share-timestamp-toggle"
						class="flex cursor-pointer items-center gap-2 text-xs font-medium select-none"
					>
						<input
							type="checkbox"
							id="share-timestamp-toggle"
							checked={includeTimestamp}
							onchange={(e) => (userIncludeTimestamp = e.currentTarget.checked)}
							class="h-4 w-4 rounded border-input text-primary focus:ring-primary"
						/>
						<span class="flex items-center gap-1">
							<Clock class="h-3.5 w-3.5 text-muted-foreground" />
							<span>Указать таймкод:</span>
							<strong class="font-bold text-foreground">
								{formatShareTime(customTimestamp)}
							</strong>
						</span>
					</label>

					{#if currentTime > 0}
						<button
							type="button"
							onclick={() => {
								userCustomTimestamp = defaultSeconds;
								userIncludeTimestamp = true;
							}}
							class="text-[11px] font-semibold text-primary hover:underline"
						>
							Сбросить на текущее
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Поле со ссылкой и кнопкой копирования -->
		<div class="space-y-1.5">
			<label
				for="share-url-input"
				class="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
			>
				Прямая ссылка
			</label>
			<div class="flex items-center gap-2">
				<Input
					id="share-url-input"
					readonly
					value={shareUrl}
					class="bg-muted/30 font-mono text-xs select-all"
				/>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="shrink-0 gap-1.5 font-medium"
					onclick={handleCopyLink}
				>
					{#if copiedLink}
						<Check class="h-3.5 w-3.5 text-emerald-500" />
						<span class="text-emerald-500">Скопировано</span>
					{:else}
						<Copy class="h-3.5 w-3.5" />
						<span>Копировать</span>
					{/if}
				</Button>
			</div>
		</div>

		<!-- Предпросмотр текста сообщения для мессенджеров -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between text-xs">
				<span class="font-semibold tracking-wider text-muted-foreground uppercase">
					Для мессенджеров
				</span>
				<button
					type="button"
					class="flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
					onclick={handleCopyText}
				>
					{#if copiedText}
						<Check class="h-3 w-3 text-emerald-500" />
						<span class="font-semibold text-emerald-500">Текст скопирован!</span>
					{:else}
						<Copy class="h-3 w-3" />
						<span>Скопировать текст</span>
					{/if}
				</button>
			</div>
			<div
				class="rounded-xl border border-border/60 bg-muted/40 p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap text-foreground/90 select-all"
			>
				{shareText}
			</div>
		</div>
	</div>

	{#snippet footer()}
		<div class="flex w-full items-center justify-between gap-2">
			<Button
				variant="ghost"
				size="sm"
				onclick={() => (open = false)}
				class="text-xs text-muted-foreground"
			>
				Закрыть
			</Button>

			<div class="flex items-center gap-2">
				{#if canNativeShare}
					<Button
						variant="default"
						size="sm"
						class="gap-1.5 text-xs shadow-sm"
						onclick={handleNativeShare}
					>
						<Share2 class="h-3.5 w-3.5" />
						<span>Поделиться...</span>
					</Button>
				{:else}
					<Button
						variant="default"
						size="sm"
						class="gap-1.5 text-xs shadow-sm"
						onclick={handleCopyLink}
					>
						<Copy class="h-3.5 w-3.5" />
						<span>Скопировать ссылку</span>
					</Button>
				{/if}
			</div>
		</div>
	{/snippet}
</BaseModal>
