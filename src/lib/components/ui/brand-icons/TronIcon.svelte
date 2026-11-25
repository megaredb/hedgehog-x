<script lang="ts">
	let { class: className = '', size = 20 }: { class?: string; size?: number } = $props();
</script>

<svg
	viewBox="0 0 64 64"
	width={size}
	height={size}
	class={className}
	fill="currentColor"
	role="img"
	aria-label="Tron"
>
	<path
		d="M61.55 19.28c-3-2.77-7.15-7-10.53-10l-.2-.14a3.82 3.82 0 0 0-1.11-.62C41.56 7 3.63-.09 2.89 0a1.4 1.4 0 0 0-.58.22L2.12.37a2.23 2.23 0 0 0-.52.84l-.05.13v.71c3.27 12 20.13 50.95 23.45 60.09.2.62.58 1.8 1.29 1.86h.16c.38 0 2-2.14 2-2.14S58.41 26.74 61.34 23a9.46 9.46 0 0 0 1-1.48 2.41 2.41 0 0 0-.79-2.24zM36.88 23.37 49.24 13.12l7.25 6.68zm-4.8-.67L10.8 5.26l34.43 6.35zM34 27.27l21.78-3.51-24.9 30zM7.91 7 30.3 26l-3.24 27.78z"
	/>
</svg>
