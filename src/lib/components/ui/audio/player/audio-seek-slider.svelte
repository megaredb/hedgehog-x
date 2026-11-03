<script lang="ts">
	import { cn } from '$lib/utils.js';

	interface Props {
		value?: number; // 0–100
		bufferValue?: number; // 0–100
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
</script>

<div
	class={cn(
		'group relative flex w-full cursor-pointer touch-none items-center py-2 select-none',
		disabled && 'pointer-events-none opacity-50',
		className
	)}
	role="presentation"
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
	</div>

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
