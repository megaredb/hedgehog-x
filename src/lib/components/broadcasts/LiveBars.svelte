<script lang="ts">
	let {
		tone = 'red',
		size = 'md',
		class: className = ''
	}: { tone?: 'red' | 'light'; size?: 'md' | 'xs'; class?: string } = $props();
</script>

<span class="live-bars {tone} {size} {className}" aria-hidden="true">
	<span></span>
	<span></span>
	<span></span>
</span>

<style>
	.live-bars {
		--bar-unit: 1px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		height: 20px;
		padding: 3px 5px;
		border-radius: 7px;
	}

	.live-bars.xs {
		--bar-unit: 0.5px;
		gap: 1px;
		height: 8px;
		padding: 0 2px;
		border-radius: 3px;
	}

	.live-bars.red {
		background-color: rgba(255, 59, 48, 0.18);
	}

	.live-bars.light {
		background-color: rgba(0, 0, 0, 0.35);
	}

	.live-bars span {
		display: block;
		width: 3px;
		height: calc(var(--bar-unit) * 4);
		border-radius: 999px;
	}

	.live-bars.xs span {
		width: 1px;
	}

	.live-bars.red span {
		background-color: #ff3b30;
	}

	.live-bars.light span {
		background-color: #fff;
	}

	.live-bars span:nth-child(1) {
		animation: live-voice-1 0.95s ease-in-out infinite;
	}

	.live-bars span:nth-child(2) {
		animation: live-voice-2 1.25s ease-in-out infinite;
	}

	.live-bars span:nth-child(3) {
		animation: live-voice-3 1.05s ease-in-out infinite;
	}

	@keyframes live-voice-1 {
		0%,
		100% {
			height: calc(var(--bar-unit) * 4);
		}
		25% {
			height: calc(var(--bar-unit) * 12);
		}
		50% {
			height: calc(var(--bar-unit) * 6);
		}
		75% {
			height: calc(var(--bar-unit) * 14);
		}
	}

	@keyframes live-voice-2 {
		0%,
		100% {
			height: calc(var(--bar-unit) * 6);
		}
		20% {
			height: calc(var(--bar-unit) * 16);
		}
		45% {
			height: calc(var(--bar-unit) * 5);
		}
		70% {
			height: calc(var(--bar-unit) * 13);
		}
		85% {
			height: calc(var(--bar-unit) * 8);
		}
	}

	@keyframes live-voice-3 {
		0%,
		100% {
			height: calc(var(--bar-unit) * 4);
		}
		30% {
			height: calc(var(--bar-unit) * 10);
		}
		60% {
			height: calc(var(--bar-unit) * 15);
		}
		80% {
			height: calc(var(--bar-unit) * 5);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.live-bars span {
			animation: none;
			height: calc(var(--bar-unit) * 6);
		}
	}
</style>
