<script lang="ts">
	import { Copy, X } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import QRCode from 'qrcode';

	let { open = $bindable(false), address = '' }: { open?: boolean; address?: string } = $props();

	let flipped = $state(false);
	let qr = $state('');
	let copied = $state(false);

	const groups = $derived(address.match(/.{1,4}/g) ?? []);
	const formatted = $derived(groups.join(' '));
	const marqueeText = $derived(formatted ? `${formatted} · ${formatted}` : '');

	function makeQrDataUrl(value: string): string {
		try {
			const qrCode = QRCode.create(value, { errorCorrectionLevel: 'M' });
			const size = qrCode.modules.size;
			const data = qrCode.modules.data;
			const pad = 4;
			const total = size + pad * 2;
			const inFinder = (x: number, y: number) =>
				(x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
			let modules = '';
			for (let y = 0; y < size; y++) {
				for (let x = 0; x < size; x++) {
					if (data[y * size + x] && !inFinder(x, y)) {
						modules += `<rect x="${x + pad}" y="${y + pad}" width="1" height="1" rx=".4"/>`;
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

	$effect(() => {
		if (open) {
			flipped = false;
			if (address) qr = makeQrDataUrl(address);
		}
	});

	async function copyAddress() {
		try {
			await navigator.clipboard.writeText(address.replace(/\s+/g, ''));
		} catch {
			// Clipboard may be restricted.
		}
		copied = true;
		setTimeout(() => (copied = false), 2000);
		flipped = true;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		showCloseButton={false}
		class="max-h-[94dvh] w-[calc(100%-1rem)] max-w-[400px] overflow-hidden border-0 bg-transparent p-0 shadow-none ring-0"
	>
		<div
			class="relative max-h-[94dvh] overflow-y-auto rounded-[32px] bg-[radial-gradient(ellipse_at_50%_30%,#55b7ff_0%,transparent_58%),linear-gradient(145deg,#0b84ff,#2d9cff_55%,#087cf5)] px-4 pt-14 pb-5 text-white shadow-2xl"
		>
			<Dialog.Close
				class="absolute top-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-[#0876df]/80 text-white shadow-md transition hover:bg-[#0876df]"
			>
				<X class="h-5 w-5" />
			</Dialog.Close>
			<Dialog.Title class="sr-only">Telegram</Dialog.Title>
			<Dialog.Description class="sr-only"
				>Адрес кошелька и QR-код для получения GRAM.</Dialog.Description
			>

			<div class="relative mx-auto w-[320px] max-w-full">
				<div class="relative mx-auto h-[355px] w-[320px] max-w-full">
					<svg
						viewBox="0 0 320 355"
						class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
						xmlns="http://www.w3.org/2000/svg"
					>
						<defs>
							<path
								id="telegram-marquee-path"
								d="M 40 8 H 280 Q 312 8 312 40 V 315 Q 312 347 280 347 H 40 Q 8 347 8 315 V 40 Q 8 8 40 8 Z"
								pathLength="1000"
							/>
						</defs>
						<text class="telegram-marquee-text" textLength="2000" lengthAdjust="spacing">
							<textPath href="#telegram-marquee-path" startOffset="0">
								{marqueeText}
								<animate
									attributeName="startOffset"
									from="0"
									to="-1000"
									dur="30s"
									repeatCount="indefinite"
								/>
							</textPath>
						</text>
					</svg>

					<div class="telegram-flip-container absolute top-1/2 left-1/2">
						<div class="telegram-flip-inner {flipped ? 'flipped' : ''}">
							<div class="telegram-face telegram-face-front">
								<div class="flex min-h-0 flex-1 items-center justify-center">
									{#if qr}
										<img
											src={qr}
											alt="QR-код Telegram"
											class="h-[225px] w-[225px] rounded-[18px] object-contain"
										/>
									{:else}
										<div
											class="flex h-[225px] w-[225px] items-center justify-center rounded-[18px] bg-slate-50 text-xs text-slate-400"
										>
											QR-код
										</div>
									{/if}
								</div>
								<button
									type="button"
									class="shrink-0 rounded-full bg-[#e9f3ff] px-4 py-1.5 text-[13px] font-semibold text-[#0878e2]"
									onclick={copyAddress}
								>
									<Copy class="mr-1 inline h-3.5 w-3.5" /> Копировать адрес
								</button>
							</div>

							<div class="telegram-face telegram-face-back">
								<div class="flex min-h-0 flex-1 flex-col items-center justify-center">
									<div
										class="grid w-full grid-cols-3 gap-x-2 gap-y-2 px-5 text-center font-mono text-[16px] font-bold text-slate-800"
									>
										{#each groups as group, index (index)}
											<span class={index % 2 === 1 ? 'text-slate-400' : ''}>{group}</span>
										{/each}
									</div>
									<p class="mt-4 text-center text-[13px] font-semibold text-[#0878dc]">
										{#if copied}
											✓ Адрес скопирован
										{:else}
											Адрес кошелька
										{/if}
									</p>
								</div>
								<button
									type="button"
									class="shrink-0 rounded-full bg-[#e9f3ff] px-4 py-1.5 text-[13px] font-semibold text-[#0878e2]"
									onclick={() => (flipped = false)}
								>
									Показать QR-код
								</button>
							</div>
						</div>
					</div>
				</div>

				<p class="mx-auto mt-2 max-w-[340px] text-center text-sm leading-5 text-white">
					Скопируйте этот адрес или сканируйте QR-код.
				</p>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	.telegram-flip-container {
		width: 280px;
		height: 315px;
		perspective: 1200px;
		transform: translate(-50%, -50%);
		z-index: 2;
	}
	.telegram-flip-inner {
		position: relative;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		-webkit-transform-style: preserve-3d;
		transition: transform 0.8s cubic-bezier(0.22, 0.68, 0, 1);
	}
	.telegram-flip-inner.flipped {
		transform: rotateY(180deg);
	}
	.telegram-face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-radius: 32px;
		background: #fff;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.telegram-face-front {
		transform: rotateY(0deg);
	}
	.telegram-face-back {
		transform: rotateY(180deg);
	}
	.telegram-marquee-text {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 3px;
		fill: #0756a5;
		opacity: 0.58;
	}
</style>
