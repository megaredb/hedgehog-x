<script lang="ts">
	import { Moon, Timer, TimerOff } from '@lucide/svelte';
	import { audioStore } from '$lib/audio-store.svelte.js';
	import { cn } from '$lib/utils.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button, type ButtonSize, type ButtonVariant } from '$lib/components/ui/button/index.js';
	import { WheelPicker, type WheelPickerOption } from '@uinstinct/svelte-wheel-picker';

	interface Props {
		class?: string;
		size?: ButtonSize;
		variant?: ButtonVariant;
	}

	type SleepDuration = number | 'end_of_track';

	let { class: className = '', size = 'icon', variant = 'outline' }: Props = $props();

	let isOpen = $state(false);
	let selectedDuration = $state<SleepDuration>(30);

	const PRESETS: WheelPickerOption<SleepDuration>[] = [
		{ value: 5, label: '5 минут' },
		{ value: 10, label: '10 минут' },
		{ value: 15, label: '15 минут' },
		{ value: 20, label: '20 минут' },
		{ value: 25, label: '25 минут' },
		{ value: 30, label: '30 минут' },
		{ value: 45, label: '45 минут' },
		{ value: 60, label: '60 минут (1 час)' },
		{ value: 90, label: '90 минут (1.5 ч)' },
		{ value: 120, label: '120 минут (2 ч)' },
		{ value: 'end_of_track', label: 'В конце главы' }
	];

	const QUICK_PRESETS: SleepDuration[] = [15, 30, 60, 'end_of_track'];

	function formatRemaining(totalSec: number): string {
		const h = Math.floor(totalSec / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		const s = totalSec % 60;
		const pad = (n: number) => n.toString().padStart(2, '0');
		if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
		return `${pad(m)}:${pad(s)}`;
	}

	const isTimerActive = $derived(
		audioStore.sleepTimerEndsAt !== null || audioStore.sleepTimerEndOnTrack
	);

	const activeLabel = $derived.by(() => {
		if (audioStore.sleepTimerEndOnTrack) return 'До конца главы';
		if (audioStore.sleepTimerEndsAt) return formatRemaining(audioStore.sleepTimerRemainingSec);
		return null;
	});

	const tooltipLabel = $derived(isTimerActive ? `Таймер сна: ${activeLabel}` : 'Таймер сна');

	function handleStartTimer() {
		audioStore.startSleepTimer(selectedDuration);
		isOpen = false;
	}

	function handleCancelTimer() {
		audioStore.cancelSleepTimer();
		isOpen = false;
	}
</script>

<Dialog.Root bind:open={isOpen}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props: tooltipProps })}
				<Dialog.Trigger {...tooltipProps}>
					{#snippet child({ props: dialogProps })}
						<Button
							class={cn(
								'hidden items-center transition-all md:flex',
								isTimerActive && 'border-primary bg-primary/10 font-mono font-medium text-primary',
								className
							)}
							data-slot="audio-sleep-timer-button"
							size={isTimerActive ? 'default' : size}
							{variant}
							{...dialogProps}
						>
							<Moon class={cn('size-4 shrink-0', isTimerActive && 'fill-primary')} />
						</Button>
					{/snippet}
				</Dialog.Trigger>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content sideOffset={4}>{tooltipLabel}</Tooltip.Content>
	</Tooltip.Root>

	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-xl">
				<Timer class="size-5 text-primary" />
				Таймер сна
			</Dialog.Title>
			<Dialog.Description>
				Воспроизведение автоматически остановится по истечении выбранного времени.
			</Dialog.Description>
		</Dialog.Header>

		<!-- 3D Cylindrical Wheel Picker -->
		<div class="flex flex-col items-center gap-4 py-4">
			<WheelPicker
				options={PRESETS}
				value={selectedDuration}
				onValueChange={(val: SleepDuration | undefined) => {
					if (val !== undefined) selectedDuration = val;
				}}
				cylindrical={true}
				optionItemHeight={40}
				classNames={{
					wrapper: 'w-full rounded-md bg-muted/20 border border-border/50',
					option: 'font-mono font-semibold transition-colors',
					selection: 'bg-primary/10 border-y border-primary/40 rounded-sm'
				}}
			/>

			<!-- Quick Preset Buttons -->
			<div class="flex w-full flex-wrap items-center justify-center gap-2 pt-2">
				{#each QUICK_PRESETS as preset (preset)}
					<button
						type="button"
						onclick={() => (selectedDuration = preset)}
						class={cn(
							'cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-all',
							selectedDuration === preset
								? 'border-primary bg-primary text-primary-foreground'
								: 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
						)}
					>
						{preset === 'end_of_track' ? 'В конце главы' : `${preset} мин`}
					</button>
				{/each}
			</div>
		</div>

		<Dialog.Footer class="gap-2">
			{#if isTimerActive}
				<Button
					variant="outline"
					onclick={handleCancelTimer}
					class="gap-2 text-destructive hover:bg-destructive/10"
				>
					<TimerOff class="size-4" />
					Сбросить таймер
				</Button>
			{/if}

			<Button onclick={handleStartTimer} class="gap-2">
				<Timer class="size-4" />
				{isTimerActive ? 'Обновить таймер' : 'Запустить'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
