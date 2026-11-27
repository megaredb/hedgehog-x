<script lang="ts">
	import { QrCode } from '@lucide/svelte';
	import GramIcon from '$lib/components/ui/brand-icons/GramIcon.svelte';

	let { class: className = '' }: { class?: string } = $props();
</script>

<div
	class="relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_55%_72%,#36c5ff_0%,transparent_43%),radial-gradient(ellipse_at_15%_10%,#278bff,transparent_55%),linear-gradient(135deg,#087aff,#0860db_65%,#087bff)] p-4 text-white shadow-[0_14px_35px_rgba(8,96,219,0.25)] sm:p-5 {className}"
>
	<div
		class="pointer-events-none absolute inset-0 [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:48px_48px] opacity-20"
	></div>
	<div
		class="pointer-events-none absolute top-[28%] left-[42%] h-1 w-1 rounded-full bg-white/50"
	></div>
	<div
		class="pointer-events-none absolute top-[62%] right-[27%] h-1.5 w-1.5 rounded-full bg-white/30"
	></div>

	<div class="relative flex items-start justify-between gap-3">
		<div class="flex items-center gap-2.5">
			<GramIcon size={30} />
			<p class="text-xl font-extrabold tracking-tight sm:text-2xl">GRAM</p>
		</div>
		<span
			class="flex h-9 w-9 items-center justify-center rounded-lg border border-white/30 bg-white/20 text-white shadow-sm backdrop-blur-sm"
		>
			<QrCode class="h-5 w-5" />
		</span>
	</div>

	<div class="absolute inset-x-4 bottom-4 sm:inset-x-5 sm:bottom-5">
		<p class="text-[10px] font-semibold tracking-[0.16em] text-white/70 uppercase">TELEGRAM</p>
	</div>
</div>
