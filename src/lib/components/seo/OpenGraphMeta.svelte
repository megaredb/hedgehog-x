<script lang="ts">
	import { page } from '$app/state';
	import { resolveOgMetadata, type OpenGraphMetaProps } from './og.js';

	let {
		title,
		description = null,
		image = null,
		type = 'website',
		audio = null,
		url = null,
		siteName = 'Hedgehog X'
	}: OpenGraphMetaProps = $props();

	const meta = $derived.by(() => {
		const origin = page?.url?.origin || '';
		const currentHref = page?.url?.href || '';
		return resolveOgMetadata(
			{ title, description, image, type, audio, url, siteName },
			currentHref,
			origin
		);
	});
</script>

<svelte:head>
	<title>{meta.title}</title>
	<meta name="description" content={meta.description} />

	<!-- OpenGraph -->
	<meta property="og:title" content={meta.title} />
	<meta property="og:description" content={meta.description} />
	<meta property="og:type" content={meta.type} />
	<meta property="og:image" content={meta.image} />
	{#if meta.audio}
		<meta property="og:audio" content={meta.audio} />
	{/if}
	<meta property="og:url" content={meta.url} />
	<meta property="og:site_name" content={meta.siteName} />

	<!-- Twitter Cards -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={meta.title} />
	<meta name="twitter:description" content={meta.description} />
	<meta name="twitter:image" content={meta.image} />
</svelte:head>
