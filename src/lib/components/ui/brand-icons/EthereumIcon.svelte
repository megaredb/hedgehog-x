<script lang="ts">
	let { class: className = '', size = 20 }: { class?: string; size?: number } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	class={className}
	fill="currentColor"
	role="img"
	aria-label="Ethereum"
>
	<path
		d="M11.944 17.97 4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0 4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"
	/>
</svg>
