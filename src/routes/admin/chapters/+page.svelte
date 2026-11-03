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
	import { Disc3, Plus, Trash2, Edit, Play, MessageSquare } from '@lucide/svelte';

	let { data, form } = $props();

	const isEditing = $derived(!!data.editChapter);

	function formatDuration(sec: number): string {
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
</script>

<div class="space-y-8">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Управление аудиоглавами</h1>
			<p class="text-sm text-muted-foreground">
				Загрузка MP3 глав в Cloudflare R2, привязка ссылок на посты в Telegram для комментариев.
			</p>
		</div>
		{#if isEditing}
			<Button href="/admin/chapters" variant="outline" size="sm" class="gap-1">
				<Plus class="h-4 w-4" />
				Новая глава
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
		<Label for="filter-vol" class="shrink-0 text-xs font-medium">Фильтр по тому:</Label>
		<select
			id="filter-vol"
			class="flex h-8 max-w-sm rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs"
			value={data.selectedVolumeId ?? ''}
			onchange={(e) => {
				const val = e.currentTarget.value;
				window.location.href = val
					? `/admin/chapters?volumeId=${encodeURIComponent(val)}`
					: '/admin/chapters';
			}}
		>
			<option value="">-- Все тома ({data.chapters.length} глав) --</option>
			{#each data.volumes as v (v.id)}
				<option value={v.id}>{v.bookTitle}: Том {v.volumeNumber} ({v.title})</option>
			{/each}
		</select>
	</div>

	<div class="grid items-start gap-8 lg:grid-cols-12">
		<!-- Chapters Table -->
		<div class="lg:col-span-7">
			<Card class="border-border/50">
				<CardHeader class="pb-3">
					<CardTitle class="flex items-center gap-2 text-base">
						<Disc3 class="h-4 w-4 text-primary" />
						Список глав ({data.chapters.length})
					</CardTitle>
					<CardDescription class="text-xs">
						{data.selectedVolumeId ? 'Главы выбранного тома' : 'Последние добавленные главы'}
					</CardDescription>
				</CardHeader>
				<CardContent class="p-0 sm:p-2">
					{#if data.chapters.length === 0}
						<div class="py-12 text-center text-sm text-muted-foreground">
							Главы не найдены. Загрузите первую главу через форму справа.
						</div>
					{:else}
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead class="w-12">№</TableHead>
									<TableHead>Название / Том</TableHead>
									<TableHead class="w-20">Длительность</TableHead>
									<TableHead class="w-24 text-right">Действия</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each data.chapters as ch (ch.id)}
									<TableRow class={data.editChapter?.id === ch.id ? 'bg-primary/5' : ''}>
										<TableCell class="p-2 font-mono text-xs font-semibold">
											{ch.chapterNumber}
										</TableCell>
										<TableCell>
											<div class="text-sm leading-snug font-medium">{ch.title}</div>
											<div class="text-xs text-muted-foreground">
												{ch.bookTitle} &bull; Том {ch.volumeNumber} ({ch.volumeTitle})
											</div>
											{#if ch.telegramPostUrl}
												<div class="mt-1 flex items-center gap-1 text-[11px] text-blue-500">
													<MessageSquare class="h-3 w-3 shrink-0" />
													<span class="max-w-[200px] truncate">{ch.telegramPostUrl}</span>
												</div>
											{/if}
										</TableCell>
										<TableCell class="font-mono text-xs">
											{formatDuration(ch.durationSeconds)}
										</TableCell>
										<TableCell class="text-right">
											<div class="flex items-center justify-end gap-1">
												{#if ch.audioUrl}
													<Button
														href={ch.audioUrl}
														target="_blank"
														variant="ghost"
														size="icon"
														class="h-8 w-8"
														title="Слушать аудио"
													>
														<Play class="h-3.5 w-3.5" />
													</Button>
												{/if}
												<Button
													href="/admin/chapters?edit={ch.id}{data.selectedVolumeId
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
														if (!confirm(`Удалить главу «${ch.title}»?`)) e.preventDefault();
													}}
												>
													<input type="hidden" name="id" value={ch.id} />
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
			{#key data.editChapter?.id ?? 'new'}
				{@const current = data.editChapter}
				<Card class="sticky top-20 border-border/50">
					<CardHeader class="pb-3">
						<CardTitle class="flex items-center gap-2 text-base">
							{#if current}
								<Edit class="h-4 w-4 text-primary" />
								Редактировать главу
							{:else}
								<Plus class="h-4 w-4 text-primary" />
								Новая глава
							{/if}
						</CardTitle>
						<CardDescription class="text-xs">
							{#if current}
								Изменение данных главы «{current.title}»
							{:else}
								Загрузка аудиофайла и привязка к тому
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
							{:else}
								<div class="space-y-1.5">
									<Label for="ch-id" class="text-xs">ID главы (опционально)</Label>
									<Input
										id="ch-id"
										name="id"
										placeholder="авто-генерация"
										class="font-mono text-xs"
									/>
								</div>
							{/if}

							<div class="space-y-1.5">
								<Label for="ch-vol" class="text-xs">Том книги *</Label>
								<select
									id="ch-vol"
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
								<div class="space-y-1.5">
									<Label for="ch-num" class="text-xs">Номер главы *</Label>
									<Input
										id="ch-num"
										name="chapterNumber"
										type="number"
										min="1"
										defaultValue={current?.chapterNumber ?? 1}
										required
									/>
								</div>

								<div class="col-span-2 space-y-1.5">
									<Label for="ch-dur" class="text-xs">Длительность (сек)</Label>
									<Input
										id="ch-dur"
										name="durationSeconds"
										type="number"
										min="0"
										defaultValue={current?.durationSeconds ?? 0}
										placeholder="360 (6 мин)"
									/>
								</div>
							</div>

							<div class="space-y-1.5">
								<Label for="ch-title" class="text-xs">Название главы *</Label>
								<Input
									id="ch-title"
									name="title"
									defaultValue={current?.title ?? ''}
									required
									placeholder="Пролог / Глава 1"
								/>
							</div>

							<div class="space-y-1.5">
								<Label for="ch-tg" class="flex items-center gap-1.5 text-xs">
									<MessageSquare class="h-3.5 w-3.5 text-blue-500" />
									Ссылка на пост в Telegram для комментариев
								</Label>
								<Input
									id="ch-tg"
									name="telegramPostUrl"
									defaultValue={current?.telegramPostUrl ?? ''}
									placeholder="https://t.me/hedgehogincoverlord/10 или overlord/10"
									class="text-xs"
								/>
								<p class="text-[11px] text-muted-foreground">
									Формат: `канал/id_поста` или полная ссылка на пост в публичном канале Telegram.
								</p>
							</div>

							<div class="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-3">
								<Label class="flex items-center gap-1.5 text-xs font-semibold">
									<Disc3 class="h-3.5 w-3.5 text-primary" />
									Аудиофайл (Cloudflare R2)
								</Label>

								<div class="mt-2 space-y-2">
									<input
										type="file"
										name="audioFile"
										accept="audio/*,.mp3,.m4a"
										class="cursor-pointer text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:opacity-90"
									/>

									<div class="pt-1">
										<Label for="ch-audio-url" class="text-[11px] text-muted-foreground"
											>Или прямой URL к аудиофайлу:</Label
										>
										<Input
											id="ch-audio-url"
											name="audioUrl"
											defaultValue={current?.audioUrl ?? ''}
											placeholder="https://pub-r2.cloudflarestorage.com/..."
											class="mt-1 text-xs"
										/>
									</div>
								</div>
							</div>

							<div class="flex items-center gap-2 pt-2">
								<Button type="submit" class="flex-1">
									{current ? 'Сохранить изменения' : 'Загрузить главу'}
								</Button>
								{#if current}
									<Button
										href="/admin/chapters{data.selectedVolumeId
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
