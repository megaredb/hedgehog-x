<script lang="ts">
	let { tone = 'red', class: className = '' }: { tone?: 'red' | 'light'; class?: string } =
		$props();
</script>

<span class="live-bars {tone} {className}" aria-hidden="true">
	<span></span>
	<span></span>
	<span></span>
</span>

<style>
	.live-bars {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		height: 20px;
		padding: 3px 5px;
		border-radius: 7px;
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
		height: 4px;
		border-radius: 999px;
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
			height: 4px;
		}
		25% {
			height: 12px;
		}
		50% {
			height: 6px;
		}
		75% {
			height: 14px;
		}
	}

	@keyframes live-voice-2 {
		0%,
		100% {
			height: 6px;
		}
		20% {
			height: 16px;
		}
		45% {
			height: 5px;
		}
		70% {
			height: 13px;
		}
		85% {
			height: 8px;
		}
	}

	@keyframes live-voice-3 {
		0%,
		100% {
			height: 4px;
		}
		30% {
			height: 10px;
		}
		60% {
			height: 15px;
		}
		80% {
			height: 5px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.live-bars span {
			animation: none;
			height: 6px;
		}
	}
</style>
