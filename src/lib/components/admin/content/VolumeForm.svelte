<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ImageField from './ImageField.svelte';
	import ConfirmDeleteForm from '$lib/components/admin/ConfirmDeleteForm.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { TriangleAlert } from '@lucide/svelte';
	import type { AdminVolume } from './types';

	interface Props {
		bookId: string;
		volume?: AdminVolume | null;
		onSaved?: (volumeId: string) => void;
		onDeleted?: () => void;
	}

	let { bookId, volume = null, onSaved, onDeleted }: Props = $props();

	let pending = $state(false);
	let error = $state('');
	const isEditing = $derived(Boolean(volume));

	const submit: SubmitFunction = () => {
		pending = true;
		error = '';
		return async ({ result, update }) => {
			pending = false;
			if (result.type === 'success') {
				const data = result.data as { volumeId?: string } | undefined;
				await update({ reset: false });
				onSaved?.(data?.volumeId ?? volume?.id ?? '');
			} else if (result.type === 'failure') {
				const data = result.data as { error?: string } | undefined;
				error = data?.error ?? 'Не удалось сохранить том';
				await update({ reset: false });
			} else {
				error = 'Ошибка сервера. Попробуйте ещё раз.';
			}
		};
	};

	function handleDeleted() {
		onDeleted?.();
	}

	function handleDeleteError(message: string) {
		error = message;
	}
</script>

<div class="space-y-4">
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
		action="?/volumeSave"
		enctype="multipart/form-data"
		use:enhance={submit}
		class="space-y-4"
	>
		<input type="hidden" name="bookId" value={bookId} />
		{#if isEditing}
			<input type="hidden" name="id" value={volume?.id ?? ''} />
		{/if}

		<div class="grid gap-3 sm:grid-cols-3">
			<div class="space-y-1.5">
				<Label for="volume-form-number" class="text-xs">Номер тома *</Label>
				<Input
					id="volume-form-number"
					name="volumeNumber"
					type="number"
					min="0"
					required
					defaultValue={volume?.volumeNumber ?? 1}
					class="font-mono text-xs"
				/>
			</div>
			<div class="space-y-1.5 sm:col-span-2">
				<Label for="volume-form-status" class="text-xs">Статус</Label>
				<select
					id="volume-form-status"
					name="status"
					defaultValue={volume?.status ?? 'ongoing'}
					class="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
				>
					<option value="ongoing">Выходит</option>
					<option value="completed">Завершён</option>
					<option value="hiatus">Пауза</option>
					<option value="dropped">Заморожен</option>
				</select>
			</div>
		</div>

		<div class="space-y-1.5">
			<Label for="volume-form-title" class="text-xs">Название тома *</Label>
			<Input
				id="volume-form-title"
				name="title"
				required
				maxlength={255}
				defaultValue={volume?.title ?? ''}
				placeholder="Король-нежить"
			/>
		</div>

		<div class="space-y-1.5">
			<Label for="volume-form-description" class="text-xs">Описание</Label>
			<Textarea
				id="volume-form-description"
				name="description"
				rows={3}
				defaultValue={volume?.description ?? ''}
				placeholder="Описание событий тома..."
			/>
		</div>

		<ImageField
			urlField="coverUrl"
			value={volume?.coverUrl ?? null}
			blurhash={volume?.blurhash}
			label="Обложка тома"
			aspect="cover"
			hint="WebP + BlurHash, до 15 МБ"
		/>

		<div class="flex flex-wrap items-center gap-2 pt-1">
			<Button type="submit" disabled={pending}>
				{pending ? 'Сохраняем…' : isEditing ? 'Сохранить том' : 'Создать том'}
			</Button>
		</div>
	</form>

	{#if isEditing}
		<div
			class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
		>
			<div>
				<p class="text-sm font-medium">Удаление тома</p>
				<p class="mt-0.5 text-xs text-muted-foreground">
					Вместе с томом удалятся главы, архивные версии и иллюстрации.
				</p>
			</div>
			<ConfirmDeleteForm
				id={volume?.id ?? ''}
				action="?/volumeDelete"
				title={'Удалить том «' + (volume?.title ?? '') + '»?'}
				description="Все главы, версии озвучки и иллюстрации этого тома также будут удалены."
				text="Удалить том"
				onDeleted={handleDeleted}
				onError={handleDeleteError}
			/>
		</div>
	{/if}
</div>
