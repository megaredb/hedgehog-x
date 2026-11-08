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
	import {
		BookOpen,
		Plus,
		Trash2,
		Edit,
		ExternalLink,
		Image as ImageIcon,
		Sparkles
	} from '@lucide/svelte';

	let { data, form } = $props();

	const isEditing = $derived(!!data.editBook);

	function getInitialPage(): number {
		if (data.editBook) {
			const index = data.books.findIndex((b) => b.id === data.editBook?.id);
			if (index !== -1) {
				return Math.floor(index / 10) + 1;
			}
		}
		return 1;
	}

	let currentPage = $state(getInitialPage());
	let pageSize = $state(10);

	const paginatedBooks = $derived(
		data.books.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);
</script>

<div class="space-y-8">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Управление книгами</h1>
			<p class="text-sm text-muted-foreground">
				Каталог основных книжных серий. При загрузке обложки файл автоматически конвертируется в
				WebP и генерируется BlurHash.
			</p>
		</div>
		{#if isEditing}
			<Button href="/admin/books" variant="outline" size="sm" class="gap-1">
				<Plus class="h-4 w-4" />
				Создать новую книгу
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
		<!-- Books Table -->
		<div class="lg:col-span-7">
			<Card class="border-border/50">
				<CardHeader class="pb-3">
					<CardTitle class="flex items-center gap-2 text-base">
						<BookOpen class="h-4 w-4 text-primary" />
						Список книг ({data.books.length})
					</CardTitle>
					<CardDescription class="text-xs">Все серии в базе данных</CardDescription>
				</CardHeader>
				<CardContent class="p-0 sm:p-2">
					{#if data.books.length === 0}
						<div class="py-12 text-center text-sm text-muted-foreground">
							Книги не найдены. Создайте первую книгу через форму справа.
						</div>
					{:else}
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead class="w-16">Обложка</TableHead>
									<TableHead>Название / ID</TableHead>
									<TableHead class="w-24">Статус</TableHead>
									<TableHead class="w-24 text-right">Действия</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each paginatedBooks as book (book.id)}
									<TableRow class={data.editBook?.id === book.id ? 'bg-primary/5' : ''}>
										<TableCell class="p-2">
											{#if book.coverUrl}
												<img
													src={book.coverUrl}
													alt={book.title}
													class="h-12 w-9 rounded border border-border/40 object-cover shadow-xs"
												/>
											{:else}
												<div class="flex h-12 w-9 items-center justify-center rounded bg-muted">
													<ImageIcon class="h-4 w-4 text-muted-foreground" />
												</div>
											{/if}
										</TableCell>
										<TableCell>
											<div class="text-sm leading-snug font-medium">{book.title}</div>
											<div class="font-mono text-xs text-muted-foreground">{book.id}</div>
											{#if book.themeColor}
												<div
													class="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"
												>
													<span
														class="inline-block h-2.5 w-2.5 rounded-full"
														style="background-color: #{book.themeColor};"
													></span>
													<span>#{book.themeColor}</span>
												</div>
											{/if}
										</TableCell>
										<TableCell>
											<Badge
												variant={book.status === 'completed' ? 'secondary' : 'default'}
												class="text-[10px] capitalize"
											>
												{book.status === 'completed' ? 'Завершен' : 'Выходит'}
											</Badge>
										</TableCell>
										<TableCell class="text-right">
											<div class="flex items-center justify-end gap-1">
												<Button
													href="/admin/books?edit={book.id}"
													variant="ghost"
													size="icon"
													class="h-8 w-8"
													title="Редактировать"
												>
													<Edit class="h-3.5 w-3.5" />
												</Button>
												<Button
													href="/books/{book.id}"
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
																`Удалить книгу «${book.title}»? Все связанные тома также будут удалены.`
															)
														)
															e.preventDefault();
													}}
												>
													<input type="hidden" name="id" value={book.id} />
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
							<PaginationBar totalItems={data.books.length} bind:currentPage bind:pageSize />
						</div>
					{/if}
				</CardContent>
			</Card>
		</div>

		<!-- Create / Edit Form -->
		<div class="lg:col-span-5" id="create">
			{#key data.editBook?.id ?? 'new'}
				{@const current = data.editBook}
				<Card class="sticky top-20 border-border/50">
					<CardHeader class="pb-3">
						<CardTitle class="flex items-center gap-2 text-base">
							{#if current}
								<Edit class="h-4 w-4 text-primary" />
								Редактировать книгу
							{:else}
								<Plus class="h-4 w-4 text-primary" />
								Новая книга
							{/if}
						</CardTitle>
						<CardDescription class="text-xs">
							{#if current}
								Изменение данных книги «{current.title}»
							{:else}
								Заполните поля для добавления серии аудиокниг
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
									<Label class="text-xs">ID книги</Label>
									<Input value={current.id} disabled class="bg-muted/40 font-mono text-xs" />
								</div>
							{:else}
								<div class="space-y-1.5">
									<Label for="book-id" class="text-xs">ID (Slug, опционально)</Label>
									<Input
										id="book-id"
										name="id"
										placeholder="overlord (по умолчанию из названия)"
										class="font-mono text-xs"
									/>
								</div>
							{/if}

							<div class="space-y-1.5">
								<Label for="book-title" class="text-xs">Название книги *</Label>
								<Input
									id="book-title"
									name="title"
									defaultValue={current?.title ?? ''}
									required
									placeholder="Владыка (Overlord)"
								/>
							</div>

							<div class="grid grid-cols-2 gap-3">
								<div class="space-y-1.5">
									<Label for="book-status" class="text-xs">Статус</Label>
									<select
										id="book-status"
										name="status"
										defaultValue={current?.status ?? 'ongoing'}
										class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
									>
										<option value="ongoing">Выходит (ongoing)</option>
										<option value="completed">Завершен (completed)</option>
									</select>
								</div>

								<div class="space-y-1.5">
									<Label for="book-color" class="flex items-center gap-1 text-xs">
										<Sparkles class="h-3 w-3 text-amber-500" />
										Цвет темы (HEX)
									</Label>
									<Input
										id="book-color"
										name="themeColor"
										defaultValue={current?.themeColor ?? ''}
										placeholder="auto из обложки"
										class="font-mono text-xs uppercase"
										maxlength={6}
									/>
								</div>
							</div>

							<div class="space-y-1.5">
								<Label for="book-desc" class="text-xs">Описание книги</Label>
								<Textarea
									id="book-desc"
									name="description"
									defaultValue={current?.description ?? ''}
									rows={3}
									placeholder="Краткое описание произведения..."
								/>
							</div>

							<div class="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-3">
								<Label class="flex items-center gap-1.5 text-xs font-semibold">
									<ImageIcon class="h-3.5 w-3.5 text-primary" />
									Обложка книги (авто-конвертация в .webp)
								</Label>

								<div class="mt-2 space-y-2">
									<input
										type="file"
										name="coverFile"
										accept="image/*"
										class="cursor-pointer text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
									/>
									<p class="text-[11px] text-muted-foreground">
										JPG/PNG конвертируются в оптимизированный WebP с расчетом BlurHash и
										определением среднего цвета.
									</p>

									<div class="pt-1">
										<Label for="book-cover-url" class="text-[11px] text-muted-foreground"
											>Или укажите готовый URL обложки:</Label
										>
										<Input
											id="book-cover-url"
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
									{current ? 'Сохранить изменения' : 'Создать книгу'}
								</Button>
								{#if current}
									<Button href="/admin/books" variant="outline">Отмена</Button>
								{/if}
							</div>
						</form>
					</CardContent>
				</Card>
			{/key}
		</div>
	</div>
</div>
