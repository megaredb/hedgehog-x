<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import ImageField from './ImageField.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Plus, TriangleAlert, X } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { AdminChapter, AdminIllustration } from './types';

	interface Props {
		illustration?: AdminIllustration | null;
		volumeId: string;
		nextSortOrder: number;
		chapters?: AdminChapter[];
		timings?: Array<{ chapterId: string; showAtSeconds: number }>;
		onClose: () => void;
		onSaved: (illustrationId: string) => void;
		onToast: (kind: 'success' | 'error', text: string) => void;
	}

	let {
		illustration = null,
		volumeId,
		nextSortOrder,
		chapters = [],
		timings = [],
		onClose,
		onSaved,
		onToast
	}: Props = $props();

	let open = $state(true);
	let pending = $state(false);
	let error = $state('');
	const isEditing = $derived(Boolean(illustration));
	const chapterById = $derived(new SvelteMap(chapters.map((chapter) => [chapter.id, chapter])));
	interface TimingRow {
		chapterId: string;
		seconds: string;
	}
	let timingRows = $state<TimingRow[]>(
		untrack(() =>
			timings
				.filter((timing) => chapters.some((chapter) => chapter.id === timing.chapterId))
				.map((timing) => ({
					chapterId: timing.chapterId,
					seconds: String(timing.showAtSeconds)
				}))
		)
	);
	const timingJson = $derived(
		JSON.stringify(
			timingRows
				.filter((row) => row.chapterId && chapterById.has(row.chapterId))
				.map((row) => ({
					chapterId: row.chapterId,
					showAtSeconds: Math.max(0, Math.floor(Number(row.seconds) || 0))
				}))
		)
	);

	function addTiming() {
		const used = new Set(timingRows.map((row) => row.chapterId));
		const chapter = chapters.find((item) => !used.has(item.id));
		if (chapter) timingRows = [...timingRows, { chapterId: chapter.id, seconds: '0' }];
	}

	function removeTiming(index: number) {
		timingRows = timingRows.filter((_, i) => i !== index);
	}

	function setTimingChapter(index: number, chapterId: string) {
		timingRows = timingRows.map((row, i) => (i === index ? { ...row, chapterId } : row));
	}

	function setTimingSeconds(index: number, seconds: string) {
		timingRows = timingRows.map((row, i) => (i === index ? { ...row, seconds } : row));
	}

	const submit: SubmitFunction = () => {
		pending = true;
		error = '';
		return async ({ result, update }) => {
			pending = false;
			if (result.type === 'success') {
				const data = result.data as { illustrationId?: string } | undefined;
				await update({ reset: false });
				open = false;
				onToast('success', isEditing ? 'Иллюстрация сохранена' : 'Иллюстрация добавлена');
				onSaved(data?.illustrationId ?? illustration?.id ?? '');
			} else if (result.type === 'failure') {
				const data = result.data as { error?: string } | undefined;
				error = data?.error ?? 'Не удалось сохранить иллюстрацию';
				await update({ reset: false });
			} else {
				error = 'Ошибка сервера. Попробуйте ещё раз.';
			}
		};
	};

	function close() {
		open = false;
		onClose();
	}
</script>

<BaseModal
	bind:open
	title={isEditing ? 'Редактировать иллюстрацию' : 'Новая иллюстрация'}
	description="WebP + BlurHash, до 15 МБ"
	widthClass="sm:max-w-xl"
	onClose={close}
>
	<div class="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
		{#if error}
			<div
				class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
				role="alert"
			>
				<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
				<span>{error}</span>
			</div>
		{/if}

		<form
			method="POST"
			action="?/illustrationSave"
			enctype="multipart/form-data"
			use:enhance={submit}
			class="space-y-4"
		>
			<input type="hidden" name="volumeId" value={volumeId} />
			{#if isEditing}
				<input type="hidden" name="id" value={illustration?.id ?? ''} />
			{/if}

			<div class="grid gap-3 sm:grid-cols-3">
				<div class="space-y-1.5 sm:col-span-2">
					<Label for="illustration-caption" class="text-xs">Подпись</Label>
					<Input
						id="illustration-caption"
						name="caption"
						defaultValue={illustration?.caption ?? ''}
						maxlength={255}
						placeholder="Цветная вклейка / Персонажи"
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="illustration-sort" class="text-xs">Порядок</Label>
					<Input
						id="illustration-sort"
						name="sortOrder"
						type="number"
						defaultValue={illustration?.sortOrder ?? nextSortOrder}
						disabled={timingRows.length > 0}
						class="font-mono text-xs"
					/>
				</div>
			</div>

			<ImageField
				urlField="imageUrl"
				value={illustration?.imageUrl ?? null}
				blurhash={illustration?.blurhash}
				label="Изображение иллюстрации"
				aspect="wide"
				hint="Изображение выбирается из R2 storage."
			/>

			<div class="space-y-2 rounded-xl border border-border/60 p-3">
				<div>
					<p class="text-sm font-semibold">Тайминги иллюстрации</p>
					<p class="text-[11px] text-muted-foreground">
						Если указан таймкод, порядок иллюстраций сортируется автоматически. Без таймкода порядок
						задаётся вручную.
					</p>
				</div>
				{#each timingRows as row, index (row.chapterId)}
					<div class="grid grid-cols-[minmax(0,1fr)_7rem_2rem] items-end gap-2">
						<div class="space-y-1">
							<Label class="text-[10px] text-muted-foreground">Глава</Label>
							<select
								class="h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-primary"
								value={row.chapterId}
								onchange={(event) => setTimingChapter(index, event.currentTarget.value)}
							>
								{#each chapters as chapter (chapter.id)}
									<option
										value={chapter.id}
										disabled={timingRows.some(
											(item) => item.chapterId === chapter.id && item !== row
										)}
									>
										Гл. {chapter.chapterNumber} · {chapter.title}
									</option>
								{/each}
							</select>
						</div>
						<div class="space-y-1">
							<Label class="text-[10px] text-muted-foreground">Секунда</Label>
							<Input
								type="number"
								min="0"
								max={chapterById.get(row.chapterId)?.durationSeconds ?? undefined}
								value={row.seconds}
								oninput={(event) => setTimingSeconds(index, event.currentTarget.value)}
								class="font-mono text-xs"
							/>
						</div>
						<Button
							type="button"
							size="icon-xs"
							variant="ghost"
							title="Удалить таймкод"
							aria-label="Удалить таймкод"
							onclick={() => removeTiming(index)}
						>
							<X class="h-3.5 w-3.5" />
						</Button>
					</div>
				{/each}
				<input type="hidden" name="timings" value={timingJson} />
				<Button
					type="button"
					size="sm"
					variant="outline"
					class="gap-1.5"
					onclick={addTiming}
					disabled={chapters.length === 0 || timingRows.length >= chapters.length}
				>
					<Plus class="h-3.5 w-3.5" />
					Добавить таймкод
				</Button>
			</div>

			<div class="flex items-center gap-2 pt-1">
				<Button type="submit" class="flex-1" disabled={pending}>
					{pending ? 'Сохраняем…' : isEditing ? 'Сохранить иллюстрацию' : 'Добавить иллюстрацию'}
				</Button>
				<Button type="button" variant="outline" onclick={close}>Отмена</Button>
			</div>
		</form>
	</div>
</BaseModal>
