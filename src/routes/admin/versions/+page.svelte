<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '$lib/components/ui/card';
	import { formatDuration } from '$lib/utils/time';
	import { AudioLines, Upload, Archive, Play, Trash2 } from '@lucide/svelte';

	let { data, form } = $props();
	const oldVersion = $derived(data.versions.find((version) => version.id === 'old'));

	function chapterLabel(chapter: (typeof data.chapters)[number]) {
		return `${chapter.bookTitle} → Том ${chapter.volumeNumber} → Глава ${chapter.chapterNumber}. ${chapter.title}`;
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
			<AudioLines class="h-6 w-6 text-primary" />
			Версии озвучки
		</h1>
		<p class="mt-2 max-w-3xl text-sm text-muted-foreground">
			Текущая озвучка хранится в главе и всегда доступна как «Новая версия». Архивные дорожки
			хранятся отдельно и показываются как «Старая версия». При выходе новой озвучки сначала
			сохраните текущую как архивную, затем замените файл главы.
		</p>
	</div>

	{#if form?.error}
		<div
			class="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
		>
			{form.error}
		</div>
	{:else if form?.success}
		<div
			class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
		>
			Изменения сохранены.
		</div>
	{/if}

	<Card class="border-border/50">
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-base">
				<Archive class="h-4 w-4 text-amber-500" />
				Добавить архивную версию
			</CardTitle>
			<CardDescription>
				Можно загрузить отдельный файл или не выбирать файл — тогда текущая озвучка главы сохранится
				как архивная без копирования. Для объединённого файла укажите диапазон глав.
			</CardDescription>
		</CardHeader>
		<CardContent>
			<form
				method="POST"
				action="?/add"
				enctype="multipart/form-data"
				class="grid gap-4 lg:grid-cols-2"
			>
				<label class="space-y-1.5 text-sm lg:col-span-2">
					<span class="font-medium">Глава-якорь</span>
					<select
						name="chapterId"
						required
						class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
					>
						<option value="">Выберите главу</option>
						{#each data.chapters as chapter (chapter.id)}
							<option value={chapter.id}>{chapterLabel(chapter)}</option>
						{/each}
					</select>
				</label>

				<label class="space-y-1.5 text-sm">
					<span class="font-medium">Название версии</span>
					<input
						name="title"
						required
						placeholder="Например: Главы 1–6"
						class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
					/>
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="font-medium">Версия</span>
					<select
						name="versionId"
						class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
					>
						{#each data.versions as version (version.id)}
							{#if version.id !== 'default'}
								<option value={version.id}>{version.label}</option>
							{/if}
						{/each}
					</select>
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="font-medium">Первая глава диапазона</span>
					<input
						name="chapterStart"
						type="number"
						min="0"
						required
						class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
					/>
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="font-medium">Последняя глава диапазона</span>
					<input
						name="chapterEnd"
						type="number"
						min="0"
						required
						class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
					/>
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="font-medium">Длительность, секунд</span>
					<input
						name="durationSeconds"
						type="number"
						min="0"
						class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
					/>
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="font-medium">Аудиофайл (необязательно)</span>
					<input name="audioFile" type="file" accept="audio/*" class="block w-full text-sm" />
				</label>
				<label class="space-y-1.5 text-sm lg:col-span-2">
					<span class="font-medium">Или URL аудио</span>
					<input
						name="audioUrl"
						placeholder="/api/media/... или https://..."
						class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
					/>
				</label>
				<div class="lg:col-span-2">
					<Button type="submit" class="gap-2">
						<Upload class="h-4 w-4" />
						Сохранить архивную версию
					</Button>
					<p class="mt-2 text-xs text-muted-foreground">
						Если файл не выбран и URL пуст, будет сохранена ссылка на текущую озвучку главы.
					</p>
				</div>
			</form>
		</CardContent>
	</Card>

	<Card class="border-border/50">
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-base">
				<Play class="h-4 w-4 text-primary" />
				Архивные дорожки
			</CardTitle>
			<CardDescription>
				«Сделать основной» меняет текущую главу и архивную дорожку местами. Для объединённого файла
				сначала разделите его на отдельные главы.
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if data.tracks.length === 0}
				<p class="py-6 text-center text-sm text-muted-foreground">Архивных версий пока нет.</p>
			{:else}
				<div class="divide-y divide-border/40">
					{#each data.tracks as track (track.id)}
						<div
							class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<Badge variant="secondary">{oldVersion?.label ?? 'Старая версия'}</Badge>
									<span class="text-xs text-muted-foreground">
										{track.bookTitle} → {track.volumeTitle} → Глава {track.chapterNumber}
									</span>
								</div>
								<p class="mt-1 truncate text-sm font-semibold">{track.title}</p>
								<p class="mt-0.5 text-xs text-muted-foreground">
									{formatDuration(track.durationSeconds)} · главы {track.chapterStart}–{track.chapterEnd}
								</p>
							</div>
							<div class="flex shrink-0 flex-wrap gap-2">
								<form method="POST" action="?/promote">
									<input type="hidden" name="id" value={track.id} />
									<Button
										type="submit"
										size="sm"
										variant="outline"
										disabled={track.chapterStart !== track.chapterEnd}
									>
										Сделать основной
									</Button>
								</form>
								<form method="POST" action="?/delete">
									<input type="hidden" name="id" value={track.id} />
									<Button
										type="submit"
										size="icon"
										variant="ghost"
										class="text-muted-foreground hover:text-destructive"
										aria-label="Удалить версию"
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</form>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
