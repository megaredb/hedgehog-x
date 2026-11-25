<script lang="ts">
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { cn } from '$lib/utils';
	import {
		ChevronRight,
		FileAudio,
		FileVideo,
		HardDrive,
		Loader2,
		Search,
		UploadCloud
	} from '@lucide/svelte';
	import type { MediaLibraryFile, MediaType } from '$lib/server/storage/r2';

	interface Props {
		open?: boolean;
		type: MediaType;
		onSelect: (file: MediaLibraryFile) => void;
	}

	let { open = $bindable(false), type, onSelect }: Props = $props();

	let files = $state<MediaLibraryFile[]>([]);
	let loading = $state(false);
	let uploading = $state(false);
	let error = $state('');
	let cursor = $state<string | null>(null);
	let search = $state('');
	let dragActive = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let requestId = 0;

	const typeLabel = $derived(
		type === 'image' ? 'изображение' : type === 'audio' ? 'аудио' : 'видео'
	);
	const title = $derived(
		type === 'image' ? 'Выбрать изображение' : type === 'audio' ? 'Выбрать аудио' : 'Выбрать видео'
	);
	const accept = $derived(
		type === 'image'
			? 'image/png,image/jpeg,image/webp,image/gif,image/avif'
			: type === 'audio'
				? 'audio/*,.mp3,.m4a,.ogg,.opus,.wav,.aac'
				: 'video/*,.webm,.mp4,.mov,.m4v'
	);
	const filteredFiles = $derived(
		files.filter((file) => {
			const needle = search.trim().toLowerCase();
			return (
				!needle ||
				file.name.toLowerCase().includes(needle) ||
				file.key.toLowerCase().includes(needle)
			);
		})
	);

	$effect(() => {
		if (!open) return;
		void loadFiles(true);
	});

	async function loadFiles(reset: boolean) {
		const id = ++requestId;
		if (reset) {
			files = [];
			cursor = null;
			search = '';
			error = '';
		}
		loading = true;
		try {
			const query = `type=${encodeURIComponent(type)}${!reset && cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
			const res = await fetch('/api/admin/r2/files?' + query, { cache: 'no-store' });
			const payload = await res.json().catch(() => null);
			if (!res.ok) throw new Error(payload?.message ?? 'Не удалось загрузить список файлов');
			if (id !== requestId) return;
			files = reset ? payload.files : [...files, ...payload.files];
			cursor = payload.nextCursor ?? null;
		} catch (e) {
			if (id === requestId) error = e instanceof Error ? e.message : 'Не удалось загрузить файлы';
		} finally {
			if (id === requestId) loading = false;
		}
	}

	async function uploadFile(file: File): Promise<void> {
		if (!file || uploading) return;
		uploading = true;
		error = '';
		try {
			const form = new FormData();
			form.set('type', type);
			form.set('file', file);
			const res = await fetch('/api/admin/r2/files', { method: 'POST', body: form });
			const payload = await res.json().catch(() => null);
			if (!res.ok) throw new Error(payload?.message ?? 'Не удалось загрузить файл');
			const uploaded = payload.file as MediaLibraryFile;
			files = [uploaded, ...files.filter((item) => item.key !== uploaded.key)];
			onSelect(uploaded);
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Не удалось загрузить файл';
		} finally {
			uploading = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragActive = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) void uploadFile(file);
	}

	function formatBytes(bytes: number): string {
		if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
		const mb = bytes / (1024 * 1024);
		if (mb >= 1) return mb.toFixed(mb >= 10 ? 0 : 1) + ' МБ';
		return Math.max(1, Math.round(bytes / 1024)) + ' КБ';
	}

	function formatDate(value: string | null): string {
		if (!value) return '';
		return new Date(value).toLocaleDateString('ru-RU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<BaseModal
	bind:open
	{title}
	description="Все папки R2 storage. Ключи плоские: папка — это часть ключа. Выберите файл, загрузите новый или перетащите его в окно."
	widthClass="sm:max-w-4xl"
>
	<div class="space-y-4">
		<button
			type="button"
			class={cn(
				'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition',
				dragActive
					? 'border-primary bg-primary/10'
					: 'border-border/70 bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
			)}
			onclick={() => fileInput?.click()}
			ondragover={(event) => {
				event.preventDefault();
				dragActive = true;
			}}
			ondragleave={() => (dragActive = false)}
			ondrop={handleDrop}
			disabled={uploading}
		>
			{#if uploading}
				<Loader2 class="h-7 w-7 animate-spin text-primary" />
				<span class="text-sm font-medium">Загружаем в R2 storage…</span>
			{:else}
				<UploadCloud class="h-7 w-7 text-primary" />
				<span class="text-sm font-medium">Загрузить {typeLabel} в R2 storage</span>
				<span class="text-[11px] text-muted-foreground">
					Нажмите, чтобы выбрать на устройстве, или перетащите файл сюда
				</span>
			{/if}
		</button>
		<input
			bind:this={fileInput}
			type="file"
			class="hidden"
			{accept}
			onchange={(event) => {
				const file = event.currentTarget.files?.[0];
				if (file) void uploadFile(file);
			}}
		/>

		{#if error}
			<p
				class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
			>
				{error}
			</p>
		{/if}

		<div class="flex items-center gap-2">
			<div class="relative min-w-0 flex-1">
				<Search
					class="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					class="h-8 pl-8 text-xs"
					placeholder="Поиск по загруженным файлам"
					bind:value={search}
				/>
			</div>
			<Button variant="outline" size="sm" onclick={() => loadFiles(true)} disabled={loading}>
				{loading ? 'Обновляем…' : 'Обновить'}
			</Button>
		</div>

		<div class="max-h-[45vh] min-h-40 overflow-y-auto rounded-xl border border-border/50">
			{#if loading && files.length === 0}
				<div
					class="flex flex-col items-center justify-center gap-2 p-10 text-xs text-muted-foreground"
				>
					<Loader2 class="h-5 w-5 animate-spin" />
					Загружаем файлы…
				</div>
			{:else if filteredFiles.length === 0}
				<div class="flex flex-col items-center justify-center gap-2 p-10 text-center">
					<HardDrive class="h-7 w-7 text-muted-foreground/50" />
					<p class="text-sm font-medium">Файлы не найдены</p>
					<p class="text-[11px] text-muted-foreground">
						{search ? 'Попробуйте другой запрос.' : 'Загрузите первый файл в R2 storage.'}
					</p>
					{#if cursor && !search}
						<Button variant="outline" size="sm" onclick={() => loadFiles(false)} disabled={loading}>
							{loading ? 'Ищем…' : 'Искать дальше'}
						</Button>
					{/if}
				</div>
			{:else}
				<ul class="divide-y divide-border/40">
					{#each filteredFiles as file (file.key)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/40"
								onclick={() => {
									onSelect(file);
									open = false;
								}}
							>
								<span
									class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted/40"
								>
									{#if type === 'image'}
										<img src={file.url} alt="" class="h-full w-full object-cover" loading="lazy" />
									{:else if type === 'audio'}
										<FileAudio class="h-5 w-5 text-primary" />
									{:else}
										<FileVideo class="h-5 w-5 text-primary" />
									{/if}
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-xs font-medium">{file.name}</span>
									<span class="block truncate font-mono text-[10px] text-muted-foreground"
										>{file.key}</span
									>
									<span class="mt-0.5 block text-[10px] text-muted-foreground">
										{formatBytes(file.size)}
										{#if file.lastModified}
											· {formatDate(file.lastModified)}{/if}
									</span>
								</span>
								<ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
							</button>
						</li>
					{/each}
				</ul>
				{#if cursor}
					<div class="border-t border-border/40 p-2">
						<Button
							variant="ghost"
							size="sm"
							class="w-full text-xs"
							onclick={() => loadFiles(false)}
							disabled={loading}
						>
							{loading ? 'Загружаем…' : 'Показать ещё файлы'}
						</Button>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</BaseModal>
