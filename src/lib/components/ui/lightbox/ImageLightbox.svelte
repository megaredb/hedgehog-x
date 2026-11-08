<script lang="ts">
	import { X, ZoomIn, ZoomOut, RotateCcw } from '@lucide/svelte';
	import { fade, scale } from 'svelte/transition';
	import { Button } from '$lib/components/ui/button';
	import { Portal } from 'bits-ui';

	interface Props {
		open: boolean;
		src: string;
		alt?: string;
		caption?: string | null;
	}

	let { open = $bindable(false), src, alt = 'Изображение', caption = null }: Props = $props();

	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isDragging = $state(false);
	let startDragX = 0;
	let startDragY = 0;

	// Touch pinch state
	let initialTouchDistance = 0;
	let initialZoom = 1;

	function resetZoom() {
		zoom = 1;
		panX = 0;
		panY = 0;
	}

	function close() {
		open = false;
		resetZoom();
	}

	function handleZoomIn() {
		zoom = Math.min(zoom + 0.5, 4);
	}

	function handleZoomOut() {
		zoom = Math.max(zoom - 0.5, 1);
		if (zoom === 1) {
			panX = 0;
			panY = 0;
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		if (e.deltaY < 0) {
			zoom = Math.min(zoom + 0.25, 4);
		} else {
			zoom = Math.max(zoom - 0.25, 1);
			if (zoom === 1) {
				panX = 0;
				panY = 0;
			}
		}
	}

	function handleMouseDown(e: MouseEvent) {
		if (zoom <= 1) return;
		isDragging = true;
		startDragX = e.clientX - panX;
		startDragY = e.clientY - panY;
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		panX = e.clientX - startDragX;
		panY = e.clientY - startDragY;
	}

	function handleMouseUp() {
		isDragging = false;
	}

	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length === 2) {
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			initialTouchDistance = Math.hypot(dx, dy);
			initialZoom = zoom;
		} else if (e.touches.length === 1 && zoom > 1) {
			isDragging = true;
			startDragX = e.touches[0].clientX - panX;
			startDragY = e.touches[0].clientY - panY;
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (e.touches.length === 2 && initialTouchDistance > 0) {
			e.preventDefault();
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			const currentDistance = Math.hypot(dx, dy);
			const scaleChange = currentDistance / initialTouchDistance;
			zoom = Math.min(Math.max(initialZoom * scaleChange, 1), 4);
			if (zoom === 1) {
				panX = 0;
				panY = 0;
			}
		} else if (e.touches.length === 1 && isDragging) {
			panX = e.touches[0].clientX - startDragX;
			panY = e.touches[0].clientY - startDragY;
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		if (e.touches.length < 2) {
			initialTouchDistance = 0;
		}
		if (e.touches.length === 0) {
			isDragging = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			close();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<Portal>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			class="fixed inset-0 z-[100] flex touch-none flex-col items-center justify-between bg-black/90 p-4 backdrop-blur-md select-none"
			transition:fade={{ duration: 200 }}
			onclick={(e) => {
				if (e.target === e.currentTarget && !isDragging) close();
			}}
		>
			<!-- Top control bar -->
			<div class="z-10 flex w-full max-w-5xl items-center justify-between pt-2">
				<div class="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						class="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
						onclick={handleZoomIn}
						title="Zoom In (+)"
					>
						<ZoomIn class="h-4.5 w-4.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						class="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
						onclick={handleZoomOut}
						title="Zoom Out (-)"
					>
						<ZoomOut class="h-4.5 w-4.5" />
					</Button>
					{#if zoom > 1}
						<Button
							variant="ghost"
							size="sm"
							class="h-9 gap-1.5 rounded-full bg-white/10 px-3 text-xs text-white hover:bg-white/20"
							onclick={resetZoom}
							title="Reset zoom"
						>
							<RotateCcw class="h-3.5 w-3.5" />
							<span>100%</span>
						</Button>
					{/if}
				</div>

				<Button
					variant="ghost"
					size="icon"
					class="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
					onclick={close}
					title="Close (Esc)"
				>
					<X class="h-5 w-5" />
				</Button>
			</div>

			<!-- Image viewport -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="relative flex w-full max-w-5xl flex-1 items-center justify-center overflow-hidden"
				onwheel={handleWheel}
				onmousedown={handleMouseDown}
				onmousemove={handleMouseMove}
				onmouseup={handleMouseUp}
				onmouseleave={handleMouseUp}
				ontouchstart={handleTouchStart}
				ontouchmove={handleTouchMove}
				ontouchend={handleTouchEnd}
			>
				<img
					{src}
					{alt}
					class="max-h-[85vh] max-w-[90vw] object-contain select-none {isDragging
						? 'transition-none'
						: 'transition-transform duration-150 ease-out'}"
					style="transform: translate3d({panX}px, {panY}px, 0px) scale({zoom}); cursor: {zoom > 1
						? isDragging
							? 'grabbing'
							: 'grab'
						: 'default'}; will-change: transform;"
					transition:scale={{ duration: 200, start: 0.95 }}
					draggable="false"
				/>
			</div>

			<!-- Image caption -->
			{#if caption}
				<div class="z-10 pb-4 text-center">
					<p
						class="max-w-xl rounded-lg bg-black/60 px-4 py-2 text-sm text-white/90 backdrop-blur-sm"
					>
						{caption}
					</p>
				</div>
			{/if}
		</div>
	</Portal>
{/if}
