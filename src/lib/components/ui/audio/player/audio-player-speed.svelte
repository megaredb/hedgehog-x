<script lang="ts">
	import { Gauge } from '@lucide/svelte';
	import { audioStore } from '$lib/audio-store.svelte.js';
	import { cn } from '$lib/utils.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button, type ButtonSize, type ButtonVariant } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';

	interface Props {
		class?: string;
		size?: ButtonSize;
		variant?: ButtonVariant;
	}

	let { class: className = '', size = 'icon', variant = 'outline' }: Props = $props();

	let speedPercent = $derived(Math.round(audioStore.playbackRate * 100));

	const tooltipLabel = $derived(`Скорость ${speedPercent}%`);

	function handleSliderChange(v: number) {
		if (v === undefined) return;
		audioStore.setPlaybackRate(v / 100);
	}

	function resetSpeed() {
		audioStore.setPlaybackRate(1);
	}
</script>

<DropdownMenu.Root>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props: tooltipProps })}
				<DropdownMenu.Trigger {...tooltipProps}>
					{#snippet child({ props: dropdownProps })}
						<Button
							class={cn('hidden md:flex', className)}
							data-slot="audio-speed-button"
							{size}
							{variant}
							{...dropdownProps}
						>
							<Gauge class={cn(audioStore.playbackRate !== 1 && 'text-primary', 'size-4')} />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content sideOffset={4}>{tooltipLabel}</Tooltip.Content>
	</Tooltip.Root>

	<DropdownMenu.Content align="center" class={cn('flex min-w-8 flex-col gap-1.5 p-1.5', className)}>
		<div class="flex flex-col items-center gap-2">
			<!-- Fast reset to 100% button -->
			<button
				type="button"
				aria-label="Сбросить скорость на 100%"
				class="cursor-pointer font-mono text-xs tabular-nums transition-colors hover:text-primary"
				onclick={resetSpeed}
			>
				{speedPercent}%
			</button>

			<Gauge class="size-4 opacity-60" />

			<Slider
				type="single"
				orientation="vertical"
				class={className}
				max={200}
				min={25}
				step={5}
				bind:value={speedPercent}
				onValueChange={(e) => {
					handleSliderChange(e);
				}}
			/>

			<button
				type="button"
				aria-label="Сбросить скорость на 100%"
				class="shrink-0 cursor-pointer opacity-60 transition-opacity hover:opacity-100"
				onclick={resetSpeed}
			>
				<Gauge class="size-4 -scale-x-100" />
			</button>
		</div>
	</DropdownMenu.Content>
</DropdownMenu.Root>
