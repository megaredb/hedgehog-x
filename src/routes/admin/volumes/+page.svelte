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
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { PaginationBar } from '$lib/components/ui/pagination';
	import { Layers, Plus, Trash2, Edit, ExternalLink, Image as ImageIcon } from '@lucide/svelte';

	let { data, form } = $props();

	const isEditing = $derived(!!data.editVolume);

	function getInitialPage(): number {
		if (data.editVolume) {
			const index = data.volumes.findIndex((v) => v.id === data.editVolume?.id);
			if (index !== -1) {
				return Math.floor(index / 10) + 1;
			}
		}
		return 1;
	}

	let currentPage = $state(getInitialPage());
	let pageSize = $state(10);

	const paginatedVolumes = $derived(
		data.volumes.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);
</script>

<div class="space-y-8">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Управление томами</h1>
			<p class="text-sm text-muted-foreground">
				Список всех томов книг. При загрузке обложки файл загружается в Cloudflare R2 и
				конвертируется в WebP.
			</p>
		</div>
		{#if isEditing}
			<Button href="/admin/volumes" variant="outline" size="sm" class="gap-1">
				<Plus class="h-4 w-4" />
				Создать новый том
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

	<div class="grid items-start gap-8 lg:grid-cols-12">
		<!-- Volumes Table -->
		<div class="lg:col-span-7">
			<Card class="border-border/50">
				<CardHeader class="pb-3">
					<CardTitle class="flex items-center gap-2 text-base">
						<Layers class="h-4 w-4 text-primary" />
						Список томов ({data.volumes.length})
					</CardTitle>
					<CardDescription class="text-xs">Все тома, привязанные к книгам</CardDescription>
				</CardHeader>
				<CardContent class="p-0 sm:p-2">
					{#if data.volumes.length === 0}
						<div class="py-12 text-center text-sm text-muted-foreground">
							Тома пока не созданы. Добавьте первый том через форму справа.
						</div>
					{:else}
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead class="w-16">Обложка</TableHead>
									<TableHead>Том / Книга</TableHead>
									<TableHead class="w-24">Статус</TableHead>
									<TableHead class="w-24 text-right">Действия</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each paginatedVolumes as vol (vol.id)}
									<TableRow class={data.editVolume?.id === vol.id ? 'bg-primary/5' : ''}>
										<TableCell class="p-2">
											{#if vol.coverUrl}
												<img
													src={vol.coverUrl}
													alt={vol.title}
													class="h-12 w-9 rounded border border-border/40 object-cover shadow-xs"
												/>
											{:else}
												<div class="flex h-12 w-9 items-center justify-center rounded bg-muted">
													<ImageIcon class="h-4 w-4 text-muted-foreground" />
												</div>
											{/if}
										</TableCell>
										<TableCell>
											<div class="text-sm leading-snug font-medium">
												Том {vol.volumeNumber}: {vol.title}
											</div>
											<div class="text-xs text-muted-foreground">
												Книга: <span class="font-medium text-foreground"
													>{vol.bookTitle || vol.bookId}</span
												>
											</div>
											<div class="mt-0.5 font-mono text-[11px] text-muted-foreground/80">
												{vol.id}
											</div>
										</TableCell>
										<TableCell>
											<Badge
												variant={vol.status === 'completed' ? 'secondary' : 'default'}
												class="text-[10px] capitalize"
											>
												{vol.status === 'completed' ? 'Завершен' : 'Выходит'}
											</Badge>
										</TableCell>
										<TableCell class="text-right">
											<div class="flex items-center justify-end gap-1">
												<Button
													href="/admin/volumes?edit={vol.id}"
													variant="ghost"
													size="icon"
													class="h-8 w-8"
													title="Редактировать"
												>
													<Edit class="h-3.5 w-3.5" />
												</Button>
												<Button
													href="/books/{vol.bookId}/{vol.id}"
													variant="ghost"
													size="icon"
													class="h-8 w-8"
													title="Открыть на сайте"
												>
													<ExternalLink class="h-3.5 w-3.5" />
												</Button>
												<form
													method="POST"
													action="?/delete"
													onsubmit={(e) => {
														if (
															!confirm(
																`Удалить том «${vol.title}»? Все связанные главы также будут удалены.`
															)
														)
															e.preventDefault();
													}}
												>
													<input type="hidden" name="id" value={vol.id} />
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

						<div class="border-t px-4 py-2">
							<PaginationBar totalItems={data.volumes.length} bind:currentPage bind:pageSize />
						</div>
					{/if}
				</CardContent>
			</Card>
		</div>

		<!-- Create / Edit Form -->
		<div class="lg:col-span-5" id="create">
			{#key data.editVolume?.id ?? 'new'}
				{@const current = data.editVolume}
				<Card class="sticky top-20 border-border/50">
					<CardHeader class="pb-3">
						<CardTitle class="flex items-center gap-2 text-base">
							{#if current}
								<Edit class="h-4 w-4 text-primary" />
								Редактировать том
							{:else}
								<Plus class="h-4 w-4 text-primary" />
								Новый том
							{/if}
						</CardTitle>
						<CardDescription class="text-xs">
							{#if current}
								Изменение тома «{current.title}»
							{:else}
								Заполните данные для создания нового тома
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
								<div class="space-y-1.5">
									<Label class="text-xs">ID тома</Label>
									<Input value={current.id} disabled class="bg-muted/40 font-mono text-xs" />
								</div>
							{:else}
								<div class="space-y-1.5">
									<Label for="vol-id" class="text-xs">ID тома (опционально)</Label>
									<Input
										id="vol-id"
										name="id"
										placeholder="overlord_vol_1 (по умолчанию генерируется автоматически)"
										class="font-mono text-xs"
									/>
								</div>
							{/if}

							<div class="space-y-1.5">
								<Label for="vol-book" class="text-xs">Родительская книга *</Label>
								<select
									id="vol-book"
									name="bookId"
									defaultValue={current?.bookId ?? ''}
									required
									class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
								>
									<option value="" disabled>-- Выберите книгу --</option>
									{#each data.books as b (b.id)}
										<option value={b.id}>{b.title} ({b.id})</option>
									{/each}
								</select>
							</div>

							<div class="grid grid-cols-3 gap-3">
								<div class="space-y-1.5">
									<Label for="vol-num" class="text-xs">Номер тома *</Label>
									<Input
										id="vol-num"
										name="volumeNumber"
										type="number"
										min="1"
										defaultValue={current?.volumeNumber ?? 1}
										required
									/>
								</div>

								<div class="col-span-2 space-y-1.5">
									<Label for="vol-status" class="text-xs">Статус тома</Label>
									<select
										id="vol-status"
										name="status"
										defaultValue={current?.status ?? 'ongoing'}
										class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
									>
										<option value="ongoing">Выходит (ongoing)</option>
										<option value="completed">Завершен (completed)</option>
									</select>
								</div>
							</div>

							<div class="space-y-1.5">
								<Label for="vol-title" class="text-xs">Название тома *</Label>
								<Input
									id="vol-title"
									name="title"
									defaultValue={current?.title ?? ''}
									required
									placeholder="Король-нежить"
								/>
							</div>

							<div class="space-y-1.5">
								<Label for="vol-desc" class="text-xs">Описание тома</Label>
								<Textarea
									id="vol-desc"
									name="description"
									defaultValue={current?.description ?? ''}
									rows={3}
									placeholder="Описание событий тома..."
								/>
							</div>

							<div class="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-3">
								<Label class="flex items-center gap-1.5 text-xs font-semibold">
									<ImageIcon class="h-3.5 w-3.5 text-primary" />
									Обложка тома (WebP + Blurhash)
								</Label>

								<div class="mt-2 space-y-2">
									<input
										type="file"
										name="coverFile"
										accept="image/*"
										class="cursor-pointer text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
									/>

									<div class="pt-1">
										<Label for="vol-cover-url" class="text-[11px] text-muted-foreground"
											>Или прямой URL:</Label
										>
										<Input
											id="vol-cover-url"
											name="coverUrl"
											defaultValue={current?.coverUrl ?? ''}
											placeholder="https://..."
											class="mt-1 text-xs"
										/>
									</div>
								</div>
							</div>

							<div class="flex items-center gap-2 pt-2">
								<Button type="submit" class="flex-1">
									{current ? 'Сохранить изменения' : 'Создать том'}
								</Button>
								{#if current}
									<Button href="/admin/volumes" variant="outline">Отмена</Button>
								{/if}
							</div>
						</form>
					</CardContent>
				</Card>
			{/key}
		</div>
	</div>
</div>
