<script lang="ts">
	import { player } from '$lib/client/player.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Clock } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { onDestroy } from 'svelte';
	import { untrack } from 'svelte';

	let isOpen = $state(false);
	let timerId: ReturnType<typeof setInterval> | null = null;
	let timeLeft = $state<number | null>(null); // in seconds
	let selectedOption = $state<string>('off');

	const options = [
		{ label: 'Выкл', value: 'off' },
		{ label: '5 мин', value: '300' },
		{ label: '15 мин', value: '900' },
		{ label: '30 мин', value: '1800' },
		{ label: '45 мин', value: '2700' },
		{ label: '60 мин', value: '3600' },
		{ label: 'В конце главы', value: 'end-of-chapter' }
	];

	function formatTimeLeft(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function startTimer(seconds: number) {
		clearActiveTimer();
		timeLeft = seconds;
		timerId = setInterval(() => {
			if (timeLeft !== null) {
				if (timeLeft <= 1) {
					clearActiveTimer();
					triggerFadeOutAndPause();
				} else {
					timeLeft--;
				}
			}
		}, 1000);
	}

	function clearActiveTimer() {
		if (timerId) {
			clearInterval(timerId);
			timerId = null;
		}
		timeLeft = null;
	}

	function selectOption(value: string) {
		selectedOption = value;
		isOpen = false;

		if (value === 'off') {
			clearActiveTimer();
		} else if (value === 'end-of-chapter') {
			clearActiveTimer();
			// Listen to time updates via player
		} else {
			const seconds = parseInt(value, 10);
			startTimer(seconds);
		}
	}

	// Watch end of chapter
	$effect(() => {
		if (selectedOption === 'end-of-chapter' && player.isPlaying && player.duration > 0) {
			const remaining = player.duration - player.currentTime;
			if (remaining <= 5) {
				// Fade out at the very end
				untrack(() => {
					selectedOption = 'off';
					triggerFadeOutAndPause();
				});
			}
		}
	});

	let fadeOutIntervalId: ReturnType<typeof setInterval> | null = null;

	async function triggerFadeOutAndPause() {
		if (!player.isPlaying) return;

		const startVolume = player.volume;
		const fadeSteps = 50; // 50 steps over 5 seconds
		const fadeInterval = 100; // 100ms per step
		let step = 0;

		if (fadeOutIntervalId) clearInterval(fadeOutIntervalId);

		fadeOutIntervalId = setInterval(() => {
			step++;
			const ratio = 1 - step / fadeSteps;
			player.setVolume(startVolume * ratio);

			if (step >= fadeSteps) {
				if (fadeOutIntervalId) {
					clearInterval(fadeOutIntervalId);
					fadeOutIntervalId = null;
				}
				player.pause();
				// Restore original volume
				player.setVolume(startVolume);
				selectedOption = 'off';
			}
		}, fadeInterval);
	}

	onDestroy(() => {
		clearActiveTimer();
		if (fadeOutIntervalId) clearInterval(fadeOutIntervalId);
	});
</script>

<div class="relative">
	<Button
		variant="ghost"
		size="icon"
		class="h-10 w-10 text-muted-foreground hover:text-foreground relative"
		onclick={() => (isOpen = !isOpen)}
	>
		<Clock class="h-5 w-5" />
		{#if timeLeft !== null}
			<span
				class="absolute -top-1 -right-2 bg-primary text-primary-foreground font-mono text-[9px] px-1 rounded-full scale-90"
			>
				{formatTimeLeft(timeLeft)}
			</span>
		{:else}
			{#if selectedOption === 'end-of-chapter'}
				<span
					class="absolute -top-1 -right-2 bg-primary text-primary-foreground font-bold text-[9px] px-1 rounded-full scale-90"
				>
					End
				</span>
			{/if}
		{/if}
	</Button>

	{#if isOpen}
		<div
			transition:slide={{ duration: 150 }}
			class="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 bg-popover border border-border rounded-lg shadow-xl p-1 min-w-[130px] flex flex-col"
		>
			{#each options as option (option.value)}
				<button
					class="w-full text-center px-3 py-1.5 text-xs rounded hover:bg-accent transition-colors"
					class:font-bold={selectedOption === option.value}
					onclick={() => selectOption(option.value)}
				>
					{option.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
