<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import ImageField from './ImageField.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { TriangleAlert } from '@lucide/svelte';
	import type { AdminIllustration } from './types';

	interface Props {
		illustration?: AdminIllustration | null;
		volumeId: string;
		nextSortOrder: number;
		onClose: () => void;
		onSaved: (illustrationId: string) => void;
		onToast: (kind: 'success' | 'error', text: string) => void;
	}

	let { illustration = null, volumeId, nextSortOrder, onClose, onSaved, onToast }: Props = $props();

	let open = $state(true);
	let pending = $state(false);
	let error = $state('');
	const isEditing = $derived(Boolean(illustration));

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
						class="font-mono text-xs"
					/>
				</div>
			</div>

			<ImageField
				fileField="imageFile"
				urlField="imageUrl"
				value={illustration?.imageUrl ?? null}
				label="Изображение иллюстрации"
				aspect="wide"
				hint="Загрузите изображение или укажите прямой URL"
			/>

			<div class="flex items-center gap-2 pt-1">
				<Button type="submit" class="flex-1" disabled={pending}>
					{pending ? 'Сохраняем…' : isEditing ? 'Сохранить иллюстрацию' : 'Добавить иллюстрацию'}
				</Button>
				<Button type="button" variant="outline" onclick={close}>Отмена</Button>
			</div>
		</form>
	</div>
</BaseModal>
