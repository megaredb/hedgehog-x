<script lang="ts">
	import { cn } from '$lib/utils.js';

	interface Props {
		value?: number; // 0–100
		bufferValue?: number; // 0–100
		markers?: Array<{ id: string; percent: number; endPercent?: number; note?: string }>;
		disabled?: boolean;
		class?: string;
		onValueChange?: (values: number[]) => void;
		onMouseMove?: (e: MouseEvent) => void;
		onTouchStart?: (e: TouchEvent) => void;
		onTouchMove?: (e: TouchEvent) => void;
	}

	let {
		value = 0,
		bufferValue = 0,
		markers = [],
		disabled = false,
		class: className = '',
		onValueChange,
		onMouseMove,
		onTouchStart,
		onTouchMove
	}: Props = $props();

	const pct = (v: number) => `${Math.max(0, Math.min(100, v))}%`;

	function handleInput(e: Event & { currentTarget: HTMLInputElement }) {
		onValueChange?.([Number(e.currentTarget.value)]);
	}

	let isPointerDown = false;
	let isDragging = $state(false);
	let hoveredMarker = $state<{
		id: string;
		percent: number;
		endPercent?: number;
		note?: string;
	} | null>(null);

	function handleHover(event: MouseEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
		hoveredMarker =
			markers.find((marker) => {
				const end = marker.endPercent ?? marker.percent;
				return percent >= marker.percent - 1 && percent <= end + 1;
			}) ?? null;
	}
</script>

<div
	class={cn(
		'group relative flex w-full cursor-pointer touch-none items-center py-2 select-none',
		disabled && 'pointer-events-none opacity-50',
		className
	)}
	role="presentation"
	onmousemove={(event) => {
		handleHover(event);
		onMouseMove?.(event);
	}}
	onmouseleave={() => (hoveredMarker = null)}
>
	<div
		class={cn(
			'relative w-full overflow-hidden rounded-full bg-muted/60 transition-all duration-200',
			isDragging ? 'h-2' : 'h-1 group-hover:h-2'
		)}
	>
		<div
			class="absolute left-0 h-full rounded-full bg-muted-foreground/40 transition-[width] duration-200"
			style="width: {pct(bufferValue)}"
		></div>

		<div
			class={cn(
				'absolute left-0 h-full rounded-full bg-primary',
				!isDragging && 'transition-[width] duration-200'
			)}
			style="width: {pct(value)}"
		></div>

		{#each markers as marker (marker.id)}
			{#if marker.endPercent && marker.endPercent > marker.percent}
				<span
					class="pointer-events-none absolute inset-y-0 bg-amber-400/25"
					style="left: {pct(marker.percent)}; width: {pct(marker.endPercent - marker.percent)}"
				></span>
			{/if}
			<span
				class="pointer-events-none absolute inset-y-0 w-0.5 rounded-full bg-amber-400 shadow-sm"
				style="left: {pct(marker.percent)}"
			></span>
		{/each}
	</div>

	{#if hoveredMarker}
		<div
			class="pointer-events-none absolute bottom-full left-0 z-40 mb-1 -translate-x-1/2 rounded-md border border-border/60 bg-popover px-2 py-1 text-[11px] font-medium whitespace-nowrap text-popover-foreground shadow-md"
			style="left: {pct(hoveredMarker.percent)}"
		>
			{hoveredMarker.note || 'Закладка'}
		</div>
	{/if}

	<div
		class={cn(
			'pointer-events-none absolute top-1/2 z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm',
			isDragging
				? 'scale-100 opacity-100'
				: 'scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100',
			!isDragging && 'transition-all duration-200'
		)}
		style="left: {pct(value)}"
	></div>

	<input
		type="range"
		min="0"
		max="100"
		step="0.1"
		{value}
		{disabled}
		aria-valuenow={value}
		class="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
		oninput={handleInput}
		onmousemove={onMouseMove}
		ontouchstart={(e) => {
			isPointerDown = true;
			onTouchStart?.(e);
		}}
		ontouchmove={(e) => {
			if (isPointerDown) isDragging = true;
			onTouchMove?.(e);
		}}
		ontouchend={() => {
			isPointerDown = false;
			isDragging = false;
		}}
		onpointerdown={() => {
			isPointerDown = true;
		}}
		onpointermove={() => {
			if (isPointerDown) isDragging = true;
		}}
		onpointerup={() => {
			isPointerDown = false;
			isDragging = false;
		}}
		onpointercancel={() => {
			isPointerDown = false;
			isDragging = false;
		}}
	/>
</div>
