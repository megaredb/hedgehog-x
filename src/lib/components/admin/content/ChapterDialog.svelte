<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import {
		Archive,
		ArrowUpToLine,
		FolderOpen,
		Plus,
		Trash2,
		TriangleAlert,
		Upload,
		X
	} from '@lucide/svelte';
	import R2FilePicker from './R2FilePicker.svelte';
	import type { MediaLibraryFile } from '$lib/server/storage/r2';
	import { formatDuration } from '$lib/utils/time';
	import type { AdminArchiveTrack, AdminAudioVersion, AdminChapter } from './types';

	interface Props {
		chapter?: AdminChapter | null;
		volumeId: string;
		volumeTitle: string;
		tracks: AdminArchiveTrack[];
		audioVersions: AdminAudioVersion[];
		onClose: () => void;
		onSaved: (chapterId: string) => void;
		onToast: (kind: 'success' | 'error', text: string) => void;
	}

	let {
		chapter = null,
		volumeId,
		volumeTitle,
		tracks,
		audioVersions,
		onClose,
		onSaved,
		onToast
	}: Props = $props();

	let open = $state(true);
	let pendingSave = $state(false);
	let saveError = $state('');
	let durationValue = $state<number | string>(untrack(() => chapter?.durationSeconds ?? 0));
	let published = $state(untrack(() => chapter?.published ?? false));
	let audioUrlValue = $state(untrack(() => chapter?.audioUrl ?? ''));
	let chapterAudioPickerOpen = $state(false);
	let audioPreview = $derived(audioUrlValue);
	let loadedChapterKey = $state('');

	let showArchiveForm = $state(false);
	let archiveTitle = $state(untrack(() => chapter?.title ?? ''));
	let archiveVersionId = $state('old');
	let archiveAudioUrl = $state('');
	let archiveAudioPickerOpen = $state(false);
	let archiveError = $state('');
	let archivePending = $state(false);
	let promoteConfirmId = $state<string | null>(null);
	let deleteConfirmId = $state<string | null>(null);

	const isEditing = $derived(Boolean(chapter));
	const versionsById = $derived(
		new Map(audioVersions.map((version) => [version.id, version] as const))
	);
	const versionOptions = $derived.by(() => {
		const options = audioVersions
			.filter((version) => version.id !== 'default')
			.map((version) => ({ id: version.id, label: version.label }));
		if (!options.some((option) => option.id === 'old')) {
			options.unshift({ id: 'old', label: 'Старая версия' });
		}
		return options;
	});

	$effect(() => {
		const key = (chapter?.id ?? 'new') + ':' + (chapter?.audioUrl ?? '');
		if (key === loadedChapterKey) return;
		loadedChapterKey = key;
		durationValue = chapter?.durationSeconds ?? 0;
		published = chapter?.published ?? false;
		archiveTitle = chapter?.title ?? '';
		audioUrlValue = chapter?.audioUrl ?? '';
		archiveAudioUrl = '';
		chapterAudioPickerOpen = false;
		archiveAudioPickerOpen = false;
	});

	function versionLabel(versionId: string): string {
		const version = versionsById.get(versionId);
		if (version) return version.label;
		return versionId === 'old' ? 'Старая версия' : versionId;
	}

	function rangeLabel(track: AdminArchiveTrack): string {
		return track.chapterStart === track.chapterEnd
			? 'Глава ' + track.chapterStart
			: 'Главы ' + track.chapterStart + '–' + track.chapterEnd;
	}

	function formatDate(value: Date | string | null): string {
		if (!value) return '';
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
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

	function readAudioDuration(url: string) {
		const audio = new Audio(url);
		audio.addEventListener('loadedmetadata', () => {
			if (Number.isFinite(audio.duration) && audio.duration > 0) {
				durationValue = Math.round(audio.duration * 1000) / 1000;
			}
		});
	}

	function selectChapterAudio(file: MediaLibraryFile) {
		audioUrlValue = file.url;
		readAudioDuration(file.url);
	}

	function selectArchiveAudio(file: MediaLibraryFile) {
		archiveAudioUrl = file.url;
	}

	const submitSave: SubmitFunction = () => {
		pendingSave = true;
		saveError = '';
		return async ({ result, update }) => {
			pendingSave = false;
			if (result.type === 'success') {
				const data = result.data as { chapterId?: string } | undefined;
				await update({ reset: false });
				open = false;
				onToast('success', isEditing ? 'Глава сохранена' : 'Глава создана');
				onSaved(data?.chapterId ?? chapter?.id ?? '');
			} else if (result.type === 'failure') {
				const data = result.data as { error?: string } | undefined;
				saveError = data?.error ?? 'Не удалось сохранить главу';
				await update({ reset: false });
			} else {
				saveError = 'Ошибка сервера. Попробуйте ещё раз.';
			}
		};
	};

	const submitArchiveAdd: SubmitFunction = () => {
		archivePending = true;
		archiveError = '';
		return async ({ result, update }) => {
			archivePending = false;
			if (result.type === 'success') {
				archiveAudioUrl = '';
				await update({ reset: false });
				showArchiveForm = false;
				onToast('success', 'Архивная версия добавлена');
			} else if (result.type === 'failure') {
				const data = result.data as { error?: string } | undefined;
				archiveError = data?.error ?? 'Не удалось добавить версию';
				await update({ reset: false });
			} else {
				archiveError = 'Ошибка сервера. Попробуйте ещё раз.';
			}
		};
	};

	function makeArchiveAction(successText: string): SubmitFunction {
		return () => {
			archivePending = true;
			archiveError = '';
			return async ({ result, update }) => {
				archivePending = false;
				if (result.type === 'success') {
					promoteConfirmId = null;
					deleteConfirmId = null;
					await update({ reset: false });
					onToast('success', successText);
				} else if (result.type === 'failure') {
					const data = result.data as { error?: string } | undefined;
					archiveError = data?.error ?? 'Не удалось изменить версию';
					await update({ reset: false });
				} else {
					archiveError = 'Ошибка сервера. Попробуйте ещё раз.';
				}
			};
		};
	}

	const promoteEnhance = makeArchiveAction('Версия стала основной');
	const deleteEnhance = makeArchiveAction('Архивная версия удалена');

	function promoteDisabled(track: AdminArchiveTrack): boolean {
		return track.chapterStart !== track.chapterEnd || track.audioUrl === (chapter?.audioUrl ?? '');
	}

	function promoteTitle(track: AdminArchiveTrack): string {
		if (track.chapterStart !== track.chapterEnd) return 'Объединённый файл нельзя сделать основной';
		if (track.audioUrl === (chapter?.audioUrl ?? '')) return 'Версия ссылается на текущий файл';
		return 'Сделать эту версию основной';
	}

	function close() {
		open = false;
		onClose();
	}
</script>

<BaseModal
	bind:open
	title={isEditing ? 'Глава ' + chapter?.chapterNumber + ' · ' + chapter?.title : 'Новая глава'}
	description={volumeTitle}
	widthClass="sm:max-w-3xl"
	onClose={close}
>
	<div class="max-h-[76vh] space-y-5 overflow-y-auto pr-1">
		{#if saveError}
			<div
				class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
				role="alert"
			>
				<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
				<span>{saveError}</span>
			</div>
		{/if}

		<form
			method="POST"
			action="?/chapterSave"
			enctype="multipart/form-data"
			use:enhance={submitSave}
			class="space-y-4"
		>
			<input type="hidden" name="volumeId" value={volumeId} />
			<input type="hidden" name="published" value={String(published)} />
			{#if isEditing}
				<input type="hidden" name="id" value={chapter?.id ?? ''} />
			{/if}

			<div class="grid gap-3 sm:grid-cols-4">
				<div class="space-y-1.5">
					<Label for="chapter-number" class="text-xs">Номер *</Label>
					<Input
						id="chapter-number"
						name="chapterNumber"
						type="number"
						min="0"
						required
						defaultValue={chapter?.chapterNumber ?? 1}
						class="font-mono text-xs"
					/>
				</div>
				<div class="space-y-1.5 sm:col-span-3">
					<Label for="chapter-title" class="text-xs">Название главы *</Label>
					<Input
						id="chapter-title"
						name="title"
						required
						maxlength={255}
						defaultValue={chapter?.title ?? ''}
						placeholder="Пролог / Глава 1"
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="chapter-duration" class="text-xs">Длительность, сек</Label>
					<Input
						id="chapter-duration"
						name="durationSeconds"
						type="number"
						min="0"
						step="0.001"
						bind:value={durationValue}
						class="font-mono text-xs"
					/>
				</div>
				<div class="space-y-1.5 sm:col-span-3">
					<Label for="chapter-telegram" class="text-xs">Пост Telegram</Label>
					<Input
						id="chapter-telegram"
						name="telegramPostUrl"
						defaultValue={chapter?.telegramPostUrl ?? ''}
						placeholder="https://t.me/..."
						class="text-xs"
					/>
				</div>
			</div>

			<label
				class="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs"
			>
				<span class="font-medium">Опубликована</span>
				<Switch bind:checked={published} aria-label="Опубликовать главу" />
			</label>

			<div class="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<p class="text-xs font-semibold">Текущая озвучка</p>
					<p class="font-mono text-[11px] text-muted-foreground">
						{formatDuration(chapter?.durationSeconds ?? 0)}
					</p>
				</div>

				{#if audioPreview}
					<audio
						class="w-full"
						controls
						preload="none"
						src={audioPreview}
						aria-label="Текущая озвучка главы"
					></audio>
					<p class="truncate font-mono text-[11px] text-muted-foreground">
						{fileName(audioUrlValue)}
					</p>
				{/if}
				<input type="hidden" name="audioUrl" value={audioUrlValue} />
				<div class="flex flex-wrap items-center gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						class="gap-1.5"
						onclick={() => (chapterAudioPickerOpen = true)}
					>
						<FolderOpen class="h-3.5 w-3.5" />
						{audioUrlValue ? 'Заменить аудио в R2' : 'Выбрать аудио в R2'}
					</Button>
					{#if audioUrlValue}
						<Button type="button" size="sm" variant="ghost" onclick={() => (audioUrlValue = '')}
							>Убрать</Button
						>
					{/if}
				</div>
				<p class="text-[11px] text-muted-foreground">
					Для новой главы аудио обязательно. Файл выбирается из R2 storage.
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<Button type="submit" disabled={pendingSave}>
					{pendingSave ? 'Сохраняем…' : isEditing ? 'Сохранить главу' : 'Создать главу'}
				</Button>
				<Button type="button" variant="outline" onclick={close}>Отмена</Button>
			</div>
		</form>

		{#if isEditing && chapter}
			<div class="space-y-3 border-t border-border/50 pt-4">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<div>
						<p class="flex items-center gap-1.5 text-sm font-semibold">
							<Archive class="h-4 w-4 text-amber-500" />
							Архивные версии
							<span class="font-mono text-xs text-muted-foreground">({tracks.length})</span>
						</p>
						<p class="mt-0.5 text-[11px] text-muted-foreground">
							«Сделать основной» меняет текущую и архивную версии местами.
						</p>
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

				{#if archiveError}
					<div
						class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
						role="alert"
					>
						<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
						<span>{archiveError}</span>
					</div>
				{/if}

				{#if tracks.length === 0}
					<p
						class="rounded-lg border border-dashed border-border/60 px-3 py-5 text-center text-xs text-muted-foreground"
					>
						Архивных версий нет. Сохраните текущую озвучку или загрузите старую.
					</p>
				{:else}
					<ul class="space-y-3">
						{#each tracks as track (track.id)}
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
													объединённый
												</Badge>
											{/if}
											{#if isSameFile}
												<Badge variant="outline" class="text-[10px]">ссылка на текущий</Badge>
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
									<div class="flex flex-wrap items-center gap-1.5">
										{#if promoteConfirmId === track.id}
											<form
												method="POST"
												action="?/audioPromote"
												use:enhance={promoteEnhance}
												class="flex items-center gap-1"
											>
												<input type="hidden" name="id" value={track.id} />
												<Button type="submit" size="xs" disabled={archivePending}
													>Да, сделать</Button
												>
												<Button
													type="button"
													size="xs"
													variant="ghost"
													onclick={() => (promoteConfirmId = null)}
												>
													Нет
												</Button>
											</form>
										{:else}
											<Button
												size="sm"
												variant="outline"
												class="gap-1.5"
												disabled={promoteDisabled(track) || archivePending}
												title={promoteTitle(track)}
												onclick={() => (promoteConfirmId = track.id)}
											>
												<ArrowUpToLine class="h-3.5 w-3.5" />
												Сделать основной
											</Button>
										{/if}

										{#if deleteConfirmId === track.id}
											<form
												method="POST"
												action="?/audioDelete"
												use:enhance={deleteEnhance}
												class="flex items-center gap-1"
											>
												<input type="hidden" name="id" value={track.id} />
												<Button
													type="submit"
													size="xs"
													variant="destructive"
													disabled={archivePending}
												>
													Удалить
												</Button>
												<Button
													type="button"
													size="xs"
													variant="ghost"
													onclick={() => (deleteConfirmId = null)}
												>
													Отмена
												</Button>
											</form>
										{:else}
											<Button
												size="icon-sm"
												variant="ghost"
												class="text-muted-foreground hover:text-destructive"
												title="Удалить архивную версию"
												aria-label={'Удалить архивную версию ' + track.title}
												disabled={archivePending}
												onclick={() => (deleteConfirmId = track.id)}
											>
												<Trash2 class="h-3.5 w-3.5" />
											</Button>
										{/if}
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
					<div class="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
						<p class="text-sm font-semibold">Добавить архивную версию</p>
						<form
							method="POST"
							action="?/audioAdd"
							enctype="multipart/form-data"
							use:enhance={submitArchiveAdd}
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
										bind:value={archiveTitle}
										class="text-sm"
									/>
								</div>
								<div class="space-y-1.5">
									<Label for="archive-version" class="text-xs">Вид версии</Label>
									{#if versionOptions.length < 3}
										<div
											class="flex flex-wrap gap-1 rounded-md border border-input bg-muted/40 p-0.5"
											role="group"
											aria-label="Вид версии"
										>
											{#each versionOptions as option (option.id)}
												<button
													type="button"
													aria-pressed={archiveVersionId === option.id}
													class="rounded px-2 py-1.5 text-xs font-medium transition-colors {archiveVersionId ===
													option.id
														? 'bg-background text-foreground shadow-xs'
														: 'text-muted-foreground hover:text-foreground'}"
													onclick={() => (archiveVersionId = option.id)}
												>
													{option.label}
												</button>
											{/each}
										</div>
										<input type="hidden" name="versionId" value={archiveVersionId} />
									{:else}
										<select
											id="archive-version"
											name="versionId"
											bind:value={archiveVersionId}
											class="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
										>
											{#each versionOptions as option (option.id)}
												<option value={option.id}>{option.label}</option>
											{/each}
										</select>
									{/if}
								</div>
								<div class="space-y-1.5">
									<Label for="archive-duration" class="text-xs">Длительность, сек</Label>
									<Input
										id="archive-duration"
										name="durationSeconds"
										type="number"
										min="0"
										step="0.001"
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
									<input type="hidden" name="audioUrl" value={archiveAudioUrl} />
									<div class="flex flex-wrap items-center gap-2">
										<Button
											type="button"
											size="sm"
											variant="outline"
											class="gap-1.5"
											onclick={() => (archiveAudioPickerOpen = true)}
										>
											<FolderOpen class="h-3.5 w-3.5" />
											{archiveAudioUrl ? 'Заменить аудио в R2' : 'Выбрать аудио в R2'}
										</Button>
										{#if archiveAudioUrl}
											<Button
												type="button"
												size="sm"
												variant="ghost"
												onclick={() => (archiveAudioUrl = '')}>Убрать</Button
											>
										{/if}
									</div>
									<p class="text-[11px] text-muted-foreground">
										{archiveAudioUrl
											? fileName(archiveAudioUrl)
											: 'Оставьте пустым, чтобы сослаться на текущую озвучку'}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<Button type="submit" size="sm" class="gap-1.5" disabled={archivePending}>
									<Upload class="h-3.5 w-3.5" />
									{archivePending ? 'Сохраняем…' : 'Сохранить в архив'}
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
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<R2FilePicker bind:open={chapterAudioPickerOpen} type="audio" onSelect={selectChapterAudio} />
	<R2FilePicker bind:open={archiveAudioPickerOpen} type="audio" onSelect={selectArchiveAudio} />
</BaseModal>
