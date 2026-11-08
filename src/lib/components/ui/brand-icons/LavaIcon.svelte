<script lang="ts">
	let { class: className = '', size = 20 }: { class?: string; size?: number } = $props();
</script>

<!-- Vector Lava.top icon -->
<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	class={className}
	fill="currentColor"
	role="img"
	aria-label="Lava"
>
	<path
		d="M12.017 1.5C9.742 4.633 6.2 8.528 6.2 13.43c0 4.17 3.014 7.57 6.983 7.57 4.103 0 7.417-3.376 7.417-7.57 0-4.062-2.825-7.892-4.996-10.43a.62.62 0 0 0-1.042.043c-.732 1.408-1.558 3.328-1.558 4.672 0 1.62 1.11 2.932 2.48 2.932.18 0 .356-.022.525-.065-1.01 2.502-3.238 3.65-4.73 3.65-1.92 0-3.35-1.46-3.35-3.35 0-2.87 2.14-5.6 3.57-7.88a.62.62 0 0 0-.482-.998z"
	/>
</svg>
