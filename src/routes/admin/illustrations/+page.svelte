<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { Image as ImageIcon, Plus, Trash2, Edit, ExternalLink } from '@lucide/svelte';

	let { data, form } = $props();

	const isEditing = $derived(!!data.editIllustration);
</script>

<div class="space-y-8">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Управление иллюстрациями</h1>
			<p class="text-sm text-muted-foreground">
				Иллюстрации томов. Все загруженные изображения автоматически конвертируются в формат WebP с
				расчетом BlurHash для плавного показа.
			</p>
		</div>
		{#if isEditing}
			<Button href="/admin/illustrations" variant="outline" size="sm" class="gap-1">
				<Plus class="h-4 w-4" />
				Новая иллюстрация
			</Button>
		{/if}
	</div>

	{#if form?.error}
		<div
			class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
		>
			{form.error}
		</div>
	{/if}

	<!-- Volume Filter -->
	<div class="flex items-center gap-3">
		<Label for="filter-ill-vol" class="shrink-0 text-xs font-medium">Фильтр по тому:</Label>
		<select
			id="filter-ill-vol"
			class="flex h-8 max-w-sm rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs"
			value={data.selectedVolumeId ?? ''}
			onchange={(e) => {
				const val = e.currentTarget.value;
				window.location.href = val
					? `/admin/illustrations?volumeId=${encodeURIComponent(val)}`
					: '/admin/illustrations';
			}}
		>
			<option value="">-- Все тома ({data.illustrations.length} иллюстраций) --</option>
			{#each data.volumes as v (v.id)}
				<option value={v.id}>{v.bookTitle}: Том {v.volumeNumber} ({v.title})</option>
			{/each}
		</select>
	</div>

	<div class="grid items-start gap-8 lg:grid-cols-12">
		<!-- Illustrations Table -->
		<div class="lg:col-span-7">
			<Card class="border-border/50">
				<CardHeader class="pb-3">
					<CardTitle class="flex items-center gap-2 text-base">
						<ImageIcon class="h-4 w-4 text-primary" />
						Список иллюстраций ({data.illustrations.length})
					</CardTitle>
					<CardDescription class="text-xs">
						{data.selectedVolumeId
							? 'Иллюстрации выбранного тома'
							: 'Последние добавленные иллюстрации'}
					</CardDescription>
				</CardHeader>
				<CardContent class="p-0 sm:p-2">
					{#if data.illustrations.length === 0}
						<div class="py-12 text-center text-sm text-muted-foreground">
							Иллюстрации не найдены. Загрузите первый арт через форму справа.
						</div>
					{:else}
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead class="w-16">Превью</TableHead>
									<TableHead>Подпись / Том</TableHead>
									<TableHead class="w-16">Порядок</TableHead>
									<TableHead class="w-24 text-right">Действия</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each data.illustrations as ill (ill.id)}
									<TableRow class={data.editIllustration?.id === ill.id ? 'bg-primary/5' : ''}>
										<TableCell class="p-2">
											<img
												src={ill.imageUrl}
												alt={ill.caption || 'Иллюстрация'}
												class="h-14 w-11 rounded border border-border/40 object-cover shadow-xs"
											/>
										</TableCell>
										<TableCell>
											<div class="text-sm leading-snug font-medium">
												{ill.caption || 'Без подписи'}
											</div>
											<div class="text-xs text-muted-foreground">
												{ill.bookTitle} &bull; Том {ill.volumeNumber} ({ill.volumeTitle})
											</div>
											{#if ill.blurhash}
												<div
													class="mt-0.5 max-w-[150px] truncate font-mono text-[10px] text-muted-foreground/70"
												>
													hash: {ill.blurhash}
												</div>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-xs">
											{ill.sortOrder}
										</TableCell>
										<TableCell class="text-right">
											<div class="flex items-center justify-end gap-1">
												<Button
													href={ill.imageUrl}
													target="_blank"
													variant="ghost"
													size="icon"
													class="h-8 w-8"
													title="Открыть в полном размере"
												>
													<ExternalLink class="h-3.5 w-3.5" />
												</Button>
												<Button
													href="/admin/illustrations?edit={ill.id}{data.selectedVolumeId
														? `&volumeId=${data.selectedVolumeId}`
														: ''}"
													variant="ghost"
													size="icon"
													class="h-8 w-8"
													title="Редактировать"
												>
													<Edit class="h-3.5 w-3.5" />
												</Button>
												<form
													method="POST"
													action="?/delete"
													onsubmit={(e) => {
														if (!confirm(`Удалить иллюстрацию?`)) e.preventDefault();
													}}
												>
													<input type="hidden" name="id" value={ill.id} />
													<Button
														type="submit"
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
														title="Удалить"
													>
														<Trash2 class="h-3.5 w-3.5" />
													</Button>
												</form>
											</div>
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					{/if}
				</CardContent>
			</Card>
		</div>

		<!-- Create / Edit Form -->
		<div class="lg:col-span-5" id="create">
			{#key data.editIllustration?.id ?? 'new'}
				{@const current = data.editIllustration}
				<Card class="sticky top-20 border-border/50">
					<CardHeader class="pb-3">
						<CardTitle class="flex items-center gap-2 text-base">
							{#if current}
								<Edit class="h-4 w-4 text-primary" />
								Редактировать иллюстрацию
							{:else}
								<Plus class="h-4 w-4 text-primary" />
								Новая иллюстрация
							{/if}
						</CardTitle>
						<CardDescription class="text-xs">
							{#if current}
								Изменение данных иллюстрации
							{:else}
								Загрузка арта в WebP с расчетом BlurHash
							{/if}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							method="POST"
							action={current ? '?/update' : '?/create'}
							enctype="multipart/form-data"
							class="space-y-4"
						>
							{#if current}
								<input type="hidden" name="id" value={current.id} />
							{/if}

							<div class="space-y-1.5">
								<Label for="ill-vol" class="text-xs">Том книги *</Label>
								<select
									id="ill-vol"
									name="volumeId"
									defaultValue={current?.volumeId ?? data.selectedVolumeId ?? ''}
									required
									class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
								>
									<option value="" disabled>-- Выберите том --</option>
									{#each data.volumes as v (v.id)}
										<option value={v.id}>{v.bookTitle}: Том {v.volumeNumber} ({v.title})</option>
									{/each}
								</select>
							</div>

							<div class="grid grid-cols-3 gap-3">
								<div class="col-span-2 space-y-1.5">
									<Label for="ill-caption" class="text-xs">Подпись (опционально)</Label>
									<Input
										id="ill-caption"
										name="caption"
										defaultValue={current?.caption ?? ''}
										placeholder="Цветная вклейка / Персонажи"
									/>
								</div>

								<div class="space-y-1.5">
									<Label for="ill-sort" class="text-xs">Порядок</Label>
									<Input
										id="ill-sort"
										name="sortOrder"
										type="number"
										defaultValue={current?.sortOrder ?? 0}
									/>
								</div>
							</div>

							<div class="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-3">
								<Label class="flex items-center gap-1.5 text-xs font-semibold">
									<ImageIcon class="h-3.5 w-3.5 text-primary" />
									Файл изображения (WebP + BlurHash)
								</Label>

								<div class="mt-2 space-y-2">
									<input
										type="file"
										name="imageFile"
										accept="image/*"
										class="cursor-pointer text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
									/>
									<p class="text-[11px] text-muted-foreground">
										Автоматическая конвертация в WebP с сжатием без видимых потерь.
									</p>

									<div class="pt-1">
										<Label for="ill-url" class="text-[11px] text-muted-foreground"
											>Или прямой URL:</Label
										>
										<Input
											id="ill-url"
											name="imageUrl"
											defaultValue={current?.imageUrl ?? ''}
											placeholder="https://pub-r2.cloudflarestorage.com/..."
											class="mt-1 text-xs"
										/>
									</div>
								</div>
							</div>

							<div class="flex items-center gap-2 pt-2">
								<Button type="submit" class="flex-1">
									{current ? 'Сохранить изменения' : 'Загрузить иллюстрацию'}
								</Button>
								{#if current}
									<Button
										href="/admin/illustrations{data.selectedVolumeId
											? `?volumeId=${data.selectedVolumeId}`
											: ''}"
										variant="outline"
									>
										Отмена
									</Button>
								{/if}
							</div>
						</form>
					</CardContent>
				</Card>
			{/key}
		</div>
	</div>
</div>
