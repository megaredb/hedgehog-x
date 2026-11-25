<script lang="ts">
	import { Copy, X } from '@lucide/svelte';
	import CryptoIcon from '$lib/components/common/CryptoIcon.svelte';
	import GramIcon from '$lib/components/ui/brand-icons/GramIcon.svelte';
	import { CRYPTO_COIN_LABELS, type CryptoCoin } from '$lib/types/site';
	import * as Dialog from '$lib/components/ui/dialog';
	import QRCode from 'qrcode';

	let {
		open = $bindable(false),
		qrValue = '',
		copyValue = '',
		copyLabel = 'Копировать',
		title = 'QR-код',
		hint = 'Скопируйте значение или сканируйте QR-код.',
		colorFrom = '#0b84ff',
		colorTo = '#087cf5',
		colorMid,
		colorEnd,
		accent = '#55b7ff',
		flat = false,
		light = false,
		marqueeRepeat = 2,
		coins = [],
		centerLogo,
		network
	}: {
		open?: boolean;
		qrValue?: string;
		copyValue?: string;
		copyLabel?: string;
		title?: string;
		hint?: string;
		colorFrom?: string;
		colorTo?: string;
		colorMid?: string;
		colorEnd?: string;
		accent?: string;
		flat?: boolean;
		light?: boolean;
		marqueeRepeat?: number;
		coins?: CryptoCoin[];
		centerLogo?: 'gram' | 'network';
		network?: import('$lib/types/site').CryptoNetwork;
	} = $props();

	let rotation = $state(0);
	let qr = $state('');
	let marqueeCanvas: HTMLCanvasElement | null = $state(null);

	const compactValue = $derived(copyValue.replace(/\s+/g, ''));
	const groups = $derived(compactValue.match(/.{1,4}/g) ?? []);
	const formatted = $derived(groups.join(' '));
	const sheetBackground = $derived(
		flat
			? colorFrom
			: `radial-gradient(ellipse at 50% 30%, ${accent} 0%, transparent 58%), linear-gradient(145deg, ${colorFrom}, ${colorMid ?? colorTo} 55%, ${colorEnd ?? colorFrom})`
	);

	function makeQrDataUrl(value: string): string {
		try {
			const qrCode = QRCode.create(value, { errorCorrectionLevel: 'H' });
			const size = qrCode.modules.size;
			const data = qrCode.modules.data;
			const pad = 2;
			const total = size + pad * 2;
			const inFinder = (x: number, y: number) =>
				(x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
			let modules = '';
			for (let y = 0; y < size; y++) {
				for (let x = 0; x < size; x++) {
					if (data[y * size + x] && !inFinder(x, y)) {
						modules += `<rect x="${x + pad}" y="${y + pad}" width="1" height="1" rx=".5" ry=".5"/>`;
					}
				}
			}
			const finders = [
				[0, 0],
				[size - 7, 0],
				[0, size - 7]
			]
				.map(
					([x, y]) =>
						`<rect x="${x + pad + 0.5}" y="${y + pad + 0.5}" width="6" height="6" rx="1.35" fill="none" stroke="#0f172a" stroke-width="1"/>` +
						`<rect x="${x + pad + 2}" y="${y + pad + 2}" width="3" height="3" rx=".75" fill="#0f172a"/>`
				)
				.join('');
			const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="640" height="640" shape-rendering="geometricPrecision"><rect width="${total}" height="${total}" fill="#fff"/><g fill="#0f172a">${modules}</g>${finders}</svg>`;
			return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
		} catch {
			return '';
		}
	}

	function startMarquee(canvas: HTMLCanvasElement) {
		const context = canvas.getContext('2d');
		if (!context) return;
		const ctx = context;

		const W = 320;
		const H = 355;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.style.cssText =
			'position:absolute;left:-9999px;top:0;width:10px;height:10px;overflow:hidden;';
		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute(
			'd',
			'M 40 8 H 280 Q 312 8 312 40 V 315 Q 312 347 280 347 H 40 Q 8 347 8 315 V 40 Q 8 8 40 8 Z'
		);
		svg.appendChild(path);
		document.body.appendChild(svg);

		let pathLength = 0;
		try {
			pathLength = path.getTotalLength();
		} catch {
			pathLength = 0;
		}
		if (!pathLength) {
			svg.remove();
			return;
		}

		const samples: { x: number; y: number }[] = [];
		const steps = Math.max(240, Math.round(pathLength / 1.2));
		for (let i = 0; i < steps; i++) {
			const point = path.getPointAtLength((pathLength * i) / steps);
			samples.push({ x: point.x, y: point.y });
		}

		const characters = Array.from(formatted);
		const repetitions = Math.max(1, marqueeRepeat);
		const unit = pathLength / repetitions;
		const denominator = characters.length + 1;
		let charSpacing = (unit - 25) / denominator;
		if (!Number.isFinite(charSpacing) || charSpacing < 0.5) charSpacing = unit / denominator;
		const effectiveGap = Math.max(0, unit - denominator * charSpacing);
		const fontSize = Math.max(7, Math.min(charSpacing * 1.5, 14));

		function sampleAt(distance: number) {
			let position = distance % pathLength;
			if (position < 0) position += pathLength;
			const index = (position / pathLength) * steps;
			const i0 = Math.floor(index);
			const i = ((i0 % steps) + steps) % steps;
			const t = index - i0;
			const a = samples[i];
			const b = samples[(i + 1) % steps];
			const prev = samples[(i - 1 + steps) % steps];
			const next = samples[(i + 1) % steps];
			return {
				x: a.x + (b.x - a.x) * t,
				y: a.y + (b.y - a.y) * t,
				angle: Math.atan2(next.y - prev.y, next.x - prev.x)
			};
		}

		function drawCharacter(character: string, distance: number, color: string, size = fontSize) {
			const point = sampleAt(distance);
			ctx.save();
			ctx.translate(point.x, point.y);
			ctx.rotate(point.angle);
			ctx.font = `600 ${size.toFixed(2)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
			ctx.fillStyle = color;
			ctx.fillText(character, 0, 0);
			ctx.restore();
		}

		let offset = 0;
		let lastTime = 0;
		let frameId = 0;

		function frame(time: number) {
			if (!lastTime) lastTime = time;
			let delta = (time - lastTime) / 1000;
			lastTime = time;
			if (delta > 0.05) delta = 0.05;
			offset = (offset + 20 * delta) % pathLength;
			if (offset < 0) offset += pathLength;

			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, W, H);
			ctx.font = `600 ${fontSize.toFixed(2)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';

			const textColor = light ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.68)';
			const separatorColor = light ? 'rgba(15,23,42,0.3)' : 'rgba(255,255,255,0.42)';
			for (let r = 0; r < repetitions; r++) {
				const base = offset - r * unit;
				for (let j = 0; j < characters.length; j++) {
					drawCharacter(characters[j], base + j * charSpacing, textColor);
				}
				drawCharacter(
					'•',
					base + characters.length * charSpacing + effectiveGap / 2,
					separatorColor
				);
			}

			frameId = requestAnimationFrame(frame);
		}

		frameId = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(frameId);
			svg.remove();
		};
	}

	$effect(() => {
		if (!open || !marqueeCanvas) return;
		return startMarquee(marqueeCanvas);
	});

	$effect(() => {
		if (open) {
			rotation = 0;
			if (qrValue) qr = makeQrDataUrl(qrValue);
		}
	});

	async function copyValueToClipboard() {
		try {
			await navigator.clipboard.writeText(compactValue);
		} catch {
			// Clipboard may be restricted.
		}
		rotation += 180;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		showCloseButton={false}
		class="max-h-[94dvh] w-[calc(100%-1rem)] max-w-[400px] overflow-hidden border-0 bg-transparent p-0 shadow-none ring-0"
	>
		<div
			class="relative max-h-[94dvh] overflow-y-auto rounded-[32px] px-4 pt-14 pb-5 shadow-2xl {light
				? 'text-slate-900'
				: 'text-white'}"
			style={`background: ${sheetBackground}`}
		>
			<Dialog.Close
				class="absolute top-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border shadow-md transition {light
					? 'border-slate-900/20 bg-white/45 text-slate-900 hover:bg-white/70'
					: 'border-white/30 bg-black/15 text-white hover:bg-black/25'}"
			>
				<X class="h-5 w-5" />
			</Dialog.Close>
			<Dialog.Title class="sr-only">{title}</Dialog.Title>
			<Dialog.Description class="sr-only">{hint}</Dialog.Description>

			<div class="support-card-stage relative mx-auto w-[320px] max-w-full">
				<div class="relative mx-auto h-[355px] w-[320px] max-w-full">
					<canvas bind:this={marqueeCanvas} class="support-card-marquee-canvas" aria-hidden="true"
					></canvas>

					<div class="support-card-flip-container absolute top-1/2 left-1/2">
						<div class="support-card-flip-inner" style={`transform: rotateY(${rotation}deg)`}>
							<div class="support-card-face support-card-face-front">
								<div class="relative flex items-center justify-center">
									{#if qr}
										<img
											src={qr}
											alt="QR-код"
											class="h-[262px] w-[262px] rounded-[18px] object-contain"
										/>
									{:else}
										<div
											class="flex h-[262px] w-[262px] items-center justify-center rounded-[18px] bg-slate-50 text-xs text-slate-400"
										>
											QR-код
										</div>
									{/if}
									{#if centerLogo}
										<div
											class="pointer-events-none absolute flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-white"
										>
											{#if centerLogo === 'gram'}
												<GramIcon size={32} />
											{:else if network}
												<CryptoIcon symbol={network} size={30} kind="network" />
											{/if}
										</div>
									{/if}
								</div>
								{#if copyValue}
									<button
										type="button"
										class="shrink-0 rounded-full bg-[#e9f3ff] px-4 py-1.5 text-[13px] font-semibold text-[#0878e2]"
										onclick={copyValueToClipboard}
									>
										<Copy class="mr-1 inline h-3.5 w-3.5" />
										{copyLabel}
									</button>
								{/if}
							</div>

							<div class="support-card-face support-card-face-back">
								<div class="flex min-h-0 flex-1 flex-col items-center justify-center">
									<div
										class="grid w-full grid-cols-3 gap-x-2 gap-y-2 px-5 text-center font-mono text-[16px] font-bold text-slate-800"
									>
										{#each groups as group, index (index)}
											<span class={index % 2 === 1 ? 'text-slate-400' : ''}>{group}</span>
										{/each}
									</div>
									<p class="mt-4 text-center text-[13px] font-semibold text-[#0878dc]">
										✓ Скопировано
									</p>
								</div>
								<button
									type="button"
									class="shrink-0 rounded-full bg-[#e9f3ff] px-4 py-1.5 text-[13px] font-semibold text-[#0878e2]"
									onclick={() => (rotation += 180)}
								>
									Показать QR-код
								</button>
							</div>
						</div>
					</div>
				</div>

				{#if coins.length > 0}
					<div class="mt-3 flex flex-wrap items-center justify-center gap-1.5">
						{#each coins as coin (coin)}
							<span
								class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold {light
									? 'border-slate-900/15 bg-white/40 text-slate-900'
									: 'border-white/25 bg-black/15 text-white'}"
							>
								<CryptoIcon symbol={coin} size={13} />
								{CRYPTO_COIN_LABELS[coin]}
							</span>
						{/each}
					</div>
				{/if}

				<p
					class="mx-auto mt-2 max-w-[340px] text-center text-sm leading-5 {light
						? 'text-slate-800'
						: 'text-white'}"
				>
					{hint}
				</p>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	.support-card-flip-container {
		width: 280px;
		height: 315px;
		perspective: 1200px;
		transform: translate(-50%, -50%);
		z-index: 2;
	}
	.support-card-flip-inner {
		position: relative;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		-webkit-transform-style: preserve-3d;
		transition: transform 0.8s cubic-bezier(0.22, 0.68, 0, 1);
	}
	.support-card-face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 6px;
		border-radius: 32px;
		background: #fff;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.support-card-face-front {
		justify-content: flex-end;
		gap: 0;
		padding: 0 6px;
		transform: rotateY(0deg);
	}
	.support-card-face-front > button {
		margin-bottom: 7.35px;
	}
	.support-card-face-back {
		transform: rotateY(180deg);
	}
	.support-card-marquee-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 3;
	}

	@media (orientation: landscape) and (max-height: 500px) {
		.support-card-stage {
			zoom: 0.68;
		}
	}
</style>
