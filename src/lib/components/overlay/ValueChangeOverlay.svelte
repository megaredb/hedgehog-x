<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { untrack } from 'svelte';

	interface Props {
		supervisedValues: (string | number)[];
	}

	let { supervisedValues }: Props = $props();

	let isVisible = $state(false);
	let displayValue = $state<string | number | null>(null);

	let timeout: ReturnType<typeof setTimeout>;

	let previousValues: (string | number)[] = [];
	let isFirstRun = true;

	$effect(() => {
		const currentValues = supervisedValues;

		untrack(() => {
			if (isFirstRun) {
				previousValues = [...currentValues];
				isFirstRun = false;
				return;
			}

			let changedValue: string | number | null = null;

			for (let i = 0; i < currentValues.length; i++) {
				if (currentValues[i] !== previousValues[i]) {
					changedValue = currentValues[i];
					break;
				}
			}

			if (changedValue !== null) {
				displayValue = changedValue;
				isVisible = true;

				clearTimeout(timeout);
				timeout = setTimeout(() => {
					isVisible = false;
				}, 700);
			}

			previousValues = [...currentValues];
		});

		return () => clearTimeout(timeout);
	});
</script>

{#if isVisible}
	<div
		transition:fade={{ duration: 150 }}
		class="pointer-events-none absolute inset-0 z-50 flex items-center justify-center select-none"
	>
		<div
			transition:scale={{ duration: 150, start: 0.85 }}
			class="relative flex items-center justify-center"
		>
			<div
				class="pointer-events-none absolute -inset-4 -z-10 rounded-full bg-primary/30 blur-xl"
			></div>

			<span class="font-mono text-4xl font-bold text-primary tabular-nums">
				{displayValue}
			</span>
		</div>
	</div>
{/if}
