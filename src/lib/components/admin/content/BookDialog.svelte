<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import ImageField from './ImageField.svelte';
	import VideoField from './VideoField.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { TriangleAlert } from '@lucide/svelte';
	import type { AdminBook } from './types';

	interface Props {
		book?: AdminBook | null;
		onClose: () => void;
		onSaved: (bookId: string) => void;
	}

	let { book = null, onClose, onSaved }: Props = $props();

	let open = $state(true);
	let pending = $state(false);
	let error = $state('');
	const isEditing = $derived(Boolean(book));

	const submit: SubmitFunction = () => {
		pending = true;
		error = '';
		return async ({ result, update }) => {
			pending = false;
			if (result.type === 'success') {
				const data = result.data as { bookId?: string } | undefined;
				await update({ reset: false });
				open = false;
				onSaved(data?.bookId ?? book?.id ?? '');
			} else if (result.type === 'failure') {
				const data = result.data as { error?: string } | undefined;
				error = data?.error ?? 'Не удалось сохранить книгу';
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
	title={isEditing ? 'Редактировать книгу' : 'Новая книга'}
	description={isEditing ? (book?.id ?? '') : 'Создайте серию, к которой будут привязаны тома'}
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
			action="?/bookSave"
			enctype="multipart/form-data"
			use:enhance={submit}
			class="space-y-4"
		>
			{#if isEditing}
				<input type="hidden" name="id" value={book?.id ?? ''} />
			{:else}
				<div class="space-y-1.5">
					<Label for="book-dialog-id" class="text-xs">ID книги (slug, опционально)</Label>
					<Input
						id="book-dialog-id"
						name="id"
						placeholder="overlord — по умолчанию из названия"
						class="font-mono text-xs"
					/>
				</div>
			{/if}

			<div class="space-y-1.5">
				<Label for="book-dialog-title" class="text-xs">Название книги *</Label>
				<Input
					id="book-dialog-title"
					name="title"
					defaultValue={book?.title ?? ''}
					required
					maxlength={255}
					placeholder="Владыка (Overlord)"
				/>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="book-dialog-status" class="text-xs">Статус</Label>
					<select
						id="book-dialog-status"
						name="status"
						defaultValue={book?.status ?? 'ongoing'}
						class="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
					>
						<option value="ongoing">Выходит</option>
						<option value="completed">Завершён</option>
						<option value="hiatus">Пауза</option>
						<option value="dropped">Заморожен</option>
					</select>
				</div>
				<div class="space-y-1.5">
					<Label for="book-dialog-color" class="text-xs">Цвет темы (HEX)</Label>
					<Input
						id="book-dialog-color"
						name="themeColor"
						defaultValue={book?.themeColor ?? ''}
						placeholder="auto из обложки"
						class="font-mono text-xs uppercase"
						maxlength={6}
					/>
				</div>
			</div>

			<div class="space-y-1.5">
				<Label for="book-dialog-description" class="text-xs">Описание</Label>
				<Textarea
					id="book-dialog-description"
					name="description"
					defaultValue={book?.description ?? ''}
					rows={3}
					placeholder="Краткое описание произведения..."
				/>
			</div>

			<ImageField
				urlField="coverUrl"
				value={book?.coverUrl ?? null}
				blurhash={book?.blurhash}
				label="Обложка книги"
				aspect="cover"
				hint="Обложка выбирается из R2 storage."
			/>

			<div class="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3">
				<div>
					<p class="text-xs font-semibold">Главная страница</p>
					<p class="mt-0.5 text-[11px] text-muted-foreground">
						Отдельные изображение и видео для витрины. Не привязаны к обложке книги.
					</p>
				</div>
				<ImageField
					urlField="homeImageUrl"
					value={book?.homeImageUrl ?? null}
					label="Изображение на главной"
					aspect="wide"
					hint="Фон витрины выбирается из R2 storage."
				/>
				<VideoField
					urlField="homeVideoUrl"
					value={book?.homeVideoUrl ?? null}
					label="Видео на главной"
					hint="WebM или MP4, до 100 МБ. Проигрывается поверх изображения."
				/>
			</div>

			<div class="flex items-center gap-2 pt-1">
				<Button type="submit" class="flex-1" disabled={pending}>
					{pending ? 'Сохраняем…' : isEditing ? 'Сохранить книгу' : 'Создать книгу'}
				</Button>
				<Button type="button" variant="outline" onclick={close}>Отмена</Button>
			</div>
		</form>
	</div>
</BaseModal>
