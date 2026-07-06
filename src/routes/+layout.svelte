<script lang="ts">
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';
	import favicon from '$lib/assets/favicon.svg';
	import PwaReloadPrompt from '$lib/components/PwaReloadPrompt.svelte';
	import GlobalPlayer from '$lib/components/GlobalPlayer.svelte';
	import Header from '$lib/components/Header.svelte';
	import AnimatedGradient from '$lib/components/AnimatedGradient.svelte';
	import DownloadPopup from '$lib/components/DownloadPopup.svelte';
	import { player } from '$lib/client/player.svelte';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if pwaInfo}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html pwaInfo.webManifest.linkTag}
	{/if}
</svelte:head>

<ModeWatcher />

<main
	class="min-h-screen bg-background text-foreground antialiased transition-all duration-300 relative overflow-x-hidden"
	class:pb-20={player.currentTrack !== null}
	class:md:pb-24={player.currentTrack !== null}
>
	<AnimatedGradient />
	<Header user={data.user} />
	{@render children()}
	<PwaReloadPrompt />
	<DownloadPopup />
	<GlobalPlayer />
</main>
