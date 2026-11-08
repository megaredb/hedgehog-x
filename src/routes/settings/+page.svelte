<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { audioStore } from '$lib/audio-store.svelte';
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Progress } from '$lib/components/ui/progress';
	import { Switch } from '$lib/components/ui/switch';
	import { Separator } from '$lib/components/ui/separator';
	import ConfirmModal from '$lib/components/overlay/ConfirmModal.svelte';
	import {
		SlidersHorizontal,
		Globe,
		HardDrive,
		ArrowUpDown,
		Check,
		CheckCircle2,
		Trash2,
		RefreshCw,
		Server,
		Wifi,
		WifiOff,
		Gauge,
		Layers
	} from '@lucide/svelte';
	import {
		SEEK_STEPS,
		PLAYBACK_RATES,
		MIRROR_OPTIONS,
		fetchStorageEstimate,
		clearAppCache,
		performManualSync,
		getMirrorPreference,
		setMirrorPreference,
		getActiveMirrorHost,
		type MirrorPreference,
		type StorageEstimateInfo,
		type SeekStep,
		type PlaybackRate
	} from './settings-helpers';
	import { strings } from '$lib/constants/strings';

	// ── State: Audio & Playback ──────────────────────────────────────────────
	let currentSeekStep = $state<SeekStep>(10);
	let currentPlaybackRate = $state<PlaybackRate>(1);
	let autoAdvance = $state(true);

	// ── State: Mirror & Network ──────────────────────────────────────────────
	let mirrorPref = $state<MirrorPreference>('auto');
	let activeHost = $derived(getActiveMirrorHost(mirrorPref));

	// ── State: Storage & Cache ───────────────────────────────────────────────
	let storageInfo = $state<StorageEstimateInfo>({
		usage: 0,
		quota: 0,
		formattedUsage: '0 МБ',
		formattedQuota: '0 МБ',
		percentage: 0
	});
	let isClearModalOpen = $state(false);
	let isClearing = $state(false);

	// Live Dexie queries
	const syncQueueCountQuery = useDexie(
		() => db.syncQueue.count(),
		() => 0
	);
	const downloadsCountQuery = useDexie(
		() => db.downloads.count(),
		() => 0
	);

	// ── State: Sync & Offline ────────────────────────────────────────────────
	let isOnline = $state(true);
	let isSyncing = $state(false);

	// ── Feedback toast ───────────────────────────────────────────────────────
	let toastMessage = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function showToast(msg: string) {
		toastMessage = msg;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			toastMessage = null;
		}, 3000);
	}

	// ── Handlers: Audio ──────────────────────────────────────────────────────
	function handleSeekStepSelect(step: SeekStep) {
		currentSeekStep = step;
		audioStore.setSeekStep(step);
		showToast(`Шаг перемотки изменён на ${step} сек`);
	}

	function handlePlaybackRateSelect(rate: PlaybackRate) {
		currentPlaybackRate = rate;
		audioStore.setDefaultPlaybackRate(rate);
		showToast(`Скорость по умолчанию: ${rate}x`);
	}

	function handleAutoAdvanceChange(enabled: boolean) {
		autoAdvance = enabled;
		audioStore.setAutoAdvance(enabled);
		showToast(enabled ? 'Автопереход включён' : 'Автопереход выключён');
	}

	// ── Handlers: Mirror ─────────────────────────────────────────────────────
	function handleMirrorSelect(pref: MirrorPreference) {
		mirrorPref = pref;
		setMirrorPreference(pref);
		showToast(`Источник CDN: ${MIRROR_OPTIONS.find((m) => m.value === pref)?.label ?? pref}`);
	}

	// ── Handlers: Cache ──────────────────────────────────────────────────────
	async function handleConfirmClearCache() {
		isClearing = true;
		try {
			const res = await clearAppCache({ clearDownloads: true });
			if (res.success) {
				showToast('Локальный кэш и загрузки успешно очищены');
			} else {
				showToast('Не удалось полностью очистить кэш');
			}
			storageInfo = await fetchStorageEstimate();
		} finally {
			isClearing = false;
			isClearModalOpen = false;
		}
	}

	// ── Handlers: Sync ───────────────────────────────────────────────────────
	async function handleManualSync() {
		if (!isOnline || isSyncing) return;
		isSyncing = true;
		try {
			const result = await performManualSync();
			if (result.success) {
				if (result.syncedLikes > 0) {
					showToast(`Синхронизировано ${result.syncedLikes} действий`);
				} else {
					showToast('Все данные уже синхронизированы с сервером');
				}
			} else {
				showToast('Ошибка при синхронизации данных');
			}
		} finally {
			isSyncing = false;
		}
	}

	function handleOnline() {
		isOnline = true;
		showToast('Подключение восстановлено');
	}

	function handleOffline() {
		isOnline = false;
		showToast('Нет подключения к сети');
	}

	onMount(async () => {
		// Initialize state from audioStore / storage
		currentSeekStep = (audioStore.seekStep as SeekStep) || 10;
		currentPlaybackRate = (audioStore.playbackRate as PlaybackRate) || 1;
		autoAdvance = audioStore.autoAdvance;
		mirrorPref = getMirrorPreference();

		// Realtime online status
		if (typeof navigator !== 'undefined') {
			isOnline = navigator.onLine;
		}
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		// Initial storage estimate
		storageInfo = await fetchStorageEstimate();
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		}
		if (toastTimer) clearTimeout(toastTimer);
	});
</script>

<svelte:head>
	<title>{strings.settings.title} — {strings.common.appName}</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-8 p-4 sm:p-6 lg:p-8">
	<!-- Page Header -->
	<div class="space-y-1">
		<h1 class="text-3xl font-bold tracking-tight">{strings.settings.title}</h1>
		<p class="text-sm text-muted-foreground sm:text-base">
			{strings.settings.subtitle}
		</p>
	</div>

	<div class="grid grid-cols-1 gap-6">
		<!-- ─── CARD 1: Audio & Playback ────────────────────────────────────────── -->
		<Card class="border-border/60 shadow-xs">
			<CardHeader class="pb-4">
				<div class="flex items-center gap-2.5">
					<div class="rounded-lg bg-primary/10 p-2 text-primary">
						<SlidersHorizontal class="size-5" />
					</div>
					<div>
						<CardTitle class="text-lg">{strings.settings.audioSection}</CardTitle>
						<CardDescription>
							{strings.settings.seekStepDesc}
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent class="space-y-6 pt-2">
				<!-- Seek Step -->
				<div class="space-y-2.5">
					<div class="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
						<label for="seek-step-group" class="text-sm font-medium"
							>{strings.settings.seekStep}</label
						>
						<span class="text-xs text-muted-foreground">{strings.settings.seekStepDesc}</span>
					</div>
					<div id="seek-step-group" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
						{#each SEEK_STEPS as step (step)}
							<Button
								type="button"
								variant={currentSeekStep === step ? 'default' : 'outline'}
								class="h-10 text-sm font-medium transition"
								onclick={() => handleSeekStepSelect(step)}
							>
								{step} сек
							</Button>
						{/each}
					</div>
				</div>

				<Separator />

				<!-- Default playback rate -->
				<div class="space-y-2.5">
					<div class="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex items-center gap-1.5">
							<Gauge class="size-4 text-muted-foreground" />
							<span class="text-sm font-medium">{strings.settings.playbackRate}</span>
						</div>
						<span class="text-xs text-muted-foreground">{strings.settings.playbackRateDesc}</span>
					</div>
					<div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
						{#each PLAYBACK_RATES as rate (rate)}
							<Button
								type="button"
								variant={currentPlaybackRate === rate ? 'default' : 'outline'}
								class="h-10 font-mono text-sm font-medium transition"
								onclick={() => handlePlaybackRateSelect(rate)}
							>
								{rate}x
							</Button>
						{/each}
					</div>
				</div>

				<Separator />

				<!-- Auto advance -->
				<div class="flex items-center justify-between gap-4">
					<div class="space-y-0.5">
						<label for="auto-advance-toggle" class="cursor-pointer text-sm font-medium">
							{strings.settings.autoAdvance}
						</label>
						<p class="text-xs text-muted-foreground">
							{strings.settings.autoAdvanceDesc}
						</p>
					</div>
					<Switch
						id="auto-advance-toggle"
						checked={autoAdvance}
						onCheckedChange={handleAutoAdvanceChange}
						aria-label={strings.settings.autoAdvance}
					/>
				</div>
			</CardContent>
		</Card>

		<!-- ─── CARD 2: Network & CDN mirrors ──────────────────────────────────── -->
		<Card class="border-border/60 shadow-xs">
			<CardHeader class="pb-4">
				<div class="flex items-center gap-2.5">
					<div class="rounded-lg bg-primary/10 p-2 text-primary">
						<Globe class="size-5" />
					</div>
					<div>
						<CardTitle class="text-lg">{strings.settings.networkSection}</CardTitle>
						<CardDescription>
							{strings.settings.mirrorPreferenceDesc}
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent class="space-y-4 pt-2">
				<div
					class="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
					role="radiogroup"
					aria-label="CDN Зеркало"
				>
					{#each MIRROR_OPTIONS as opt (opt.value)}
						{@const isSelected = mirrorPref === opt.value}
						<button
							type="button"
							role="radio"
							aria-checked={isSelected}
							class="flex flex-col justify-between rounded-xl border p-4 text-left transition hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden {isSelected
								? 'border-primary bg-primary/5 shadow-xs'
								: 'border-border/60 bg-card'}"
							onclick={() => handleMirrorSelect(opt.value)}
						>
							<div class="space-y-1">
								<div class="flex items-center justify-between">
									<span
										class="text-sm font-semibold {isSelected ? 'text-primary' : 'text-foreground'}"
									>
										{opt.label}
									</span>
									{#if isSelected}
										<div
											class="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
										>
											<Check class="size-3 stroke-3" />
										</div>
									{/if}
								</div>
								<p class="text-xs leading-relaxed text-muted-foreground">
									{opt.description}
								</p>
							</div>
						</button>
					{/each}
				</div>

				<!-- Active host badge -->
				<div
					class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/30 p-3 sm:px-4"
				>
					<div class="flex items-center gap-2 text-xs text-muted-foreground">
						<Server class="size-4 text-primary" />
						<span>Текущий активный хост:</span>
					</div>
					<Badge variant="outline" class="font-mono text-xs font-medium">
						{activeHost}
					</Badge>
				</div>
			</CardContent>
		</Card>

		<!-- ─── CARD 3: Storage & Cache ──────────────────────────────────────── -->
		<Card class="border-border/60 shadow-xs">
			<CardHeader class="pb-4">
				<div class="flex items-center gap-2.5">
					<div class="rounded-lg bg-primary/10 p-2 text-primary">
						<HardDrive class="size-5" />
					</div>
					<div>
						<CardTitle class="text-lg">{strings.settings.storageSection}</CardTitle>
						<CardDescription>
							{strings.settings.storageUsage}
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent class="space-y-6 pt-2">
				<!-- Storage estimate -->
				<div class="space-y-2">
					<div class="flex items-center justify-between text-sm">
						<span class="font-medium">{strings.settings.storageUsage}</span>
						<span class="font-mono text-xs text-muted-foreground">
							{storageInfo.formattedUsage} из {storageInfo.formattedQuota} ({storageInfo.percentage}%)
						</span>
					</div>
					<Progress value={storageInfo.percentage} class="h-2" />
				</div>

				<Separator />

				<!-- Downloaded offline chapters -->
				<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div class="space-y-0.5">
						<div class="flex items-center gap-2">
							<Layers class="size-4 text-muted-foreground" />
							<span class="text-sm font-medium">Офлайн-главы в базе данных</span>
						</div>
						<p class="text-xs text-muted-foreground">
							Сохранено для прослушивания без подключения к сети
						</p>
					</div>
					<Badge variant="secondary" class="w-fit font-mono text-xs">
						{downloadsCountQuery.data}
						{downloadsCountQuery.data === 1
							? 'глава'
							: downloadsCountQuery.data >= 2 && downloadsCountQuery.data <= 4
								? 'главы'
								: 'глав'}
					</Badge>
				</div>

				<Separator />

				<!-- Clear Cache Button -->
				<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div class="space-y-0.5">
						<span class="text-sm font-medium text-destructive"
							>{strings.settings.clearCacheBtn}</span
						>
						<p class="text-xs text-muted-foreground">
							Удаляет кэш CacheStorage, загруженные аудиофайлы и данные из локальной БД
						</p>
					</div>
					<Button
						type="button"
						variant="destructive"
						size="sm"
						onclick={() => (isClearModalOpen = true)}
					>
						<Trash2 class="mr-1.5 size-4" />
						{strings.settings.clearCacheBtn}
					</Button>
				</div>
			</CardContent>
		</Card>

		<!-- ─── CARD 4: Sync & Offline ─────────────────────────────────────────── -->
		<Card class="border-border/60 shadow-xs">
			<CardHeader class="pb-4">
				<div class="flex items-center gap-2.5">
					<div class="rounded-lg bg-primary/10 p-2 text-primary">
						<ArrowUpDown class="size-5" />
					</div>
					<div>
						<CardTitle class="text-lg">{strings.settings.syncSection}</CardTitle>
						<CardDescription>
							{strings.settings.syncStatus}
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent class="space-y-6 pt-2">
				<!-- Online status -->
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<span class="text-sm font-medium">Статус подключения</span>
						<p class="text-xs text-muted-foreground">Реальное состояние сети в браузере</p>
					</div>
					{#if isOnline}
						<div
							class="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
						>
							<span class="relative flex size-2">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
								></span>
								<span class="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
							</span>
							<Wifi class="size-3.5" />
							<span>В сети (Онлайн)</span>
						</div>
					{:else}
						<div
							class="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400"
						>
							<span class="size-2 rounded-full bg-amber-500"></span>
							<WifiOff class="size-3.5" />
							<span>Нет подключения (Офлайн)</span>
						</div>
					{/if}
				</div>

				<Separator />

				<!-- Sync queue count -->
				<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div class="space-y-0.5">
						<span class="text-sm font-medium">{strings.settings.queueCount}</span>
						<p class="text-xs text-muted-foreground">
							Отложенные действия (лайки, закладки, прогресс), ожидающие отправки на сервер
						</p>
					</div>
					<Badge
						variant={syncQueueCountQuery.data > 0 ? 'default' : 'secondary'}
						class="w-fit font-mono text-xs"
					>
						{syncQueueCountQuery.data}
						{syncQueueCountQuery.data === 1
							? 'операция'
							: syncQueueCountQuery.data >= 2 && syncQueueCountQuery.data <= 4
								? 'операции'
								: 'операций'}
					</Badge>
				</div>

				<Separator />

				<!-- Manual sync trigger -->
				<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div class="space-y-0.5">
						<span class="text-sm font-medium">{strings.settings.syncNowBtn}</span>
						<p class="text-xs text-muted-foreground">
							Отправить все накопившиеся локальные изменения на сервер прямо сейчас
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={!isOnline || isSyncing}
						onclick={handleManualSync}
					>
						<RefreshCw class="mr-1.5 size-4 {isSyncing ? 'animate-spin' : ''}" />
						{isSyncing ? 'Синхронизация...' : strings.settings.syncNowBtn}
					</Button>
				</div>
			</CardContent>
		</Card>
	</div>
</div>

<!-- Cache clear confirmation modal -->
<ConfirmModal
	bind:open={isClearModalOpen}
	title="Очистить локальный кэш и загрузки?"
	description="Будет удалён кэш страниц, временные аудиофайлы и сохранённые офлайн-главы. При следующем прослушивании они будут скачиваться заново с CDN."
	confirmLabel="Очистить всё"
	cancelLabel="Отмена"
	confirming={isClearing}
	onConfirm={handleConfirmClearCache}
	onCancel={() => (isClearModalOpen = false)}
/>

<!-- Toast notification feedback -->
{#if toastMessage}
	<div
		transition:fade={{ duration: 150 }}
		role="status"
		aria-live="polite"
		class="fixed right-6 bottom-24 z-50 flex items-center gap-2 rounded-xl border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-xl backdrop-blur-md"
	>
		<CheckCircle2 class="size-4 shrink-0 text-emerald-500" />
		<span>{toastMessage}</span>
	</div>
{/if}
