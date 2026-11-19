<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppNavigation from '$lib/components/header/AppNavigation.svelte';
	import AppBreadcrumbs from '$lib/components/layout/AppBreadcrumbs.svelte';
	import GlobalPlayer from '$lib/components/audio/GlobalPlayer.svelte';
	import { ModeWatcher, mode } from 'mode-watcher';
	import { onNavigate, afterNavigate } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';
	import { AudioProvider } from '$lib/components/ui/audio/provider';
	import { Tooltip } from 'bits-ui';
	import ValueChangeOverlay from '$lib/components/overlay/ValueChangeOverlay.svelte';
	import GuestDataAdoptionModal from '$lib/components/overlay/GuestDataAdoptionModal.svelte';
	import { audioStore } from '$lib/audio-store.svelte';
	import { useSession } from '$lib/client/session.svelte';
	import { syncService } from '$lib/client/services/syncService';
	import { createLogger } from '$lib/logger';
	import { env } from '$env/dynamic/public';

	const log = createLogger('SW');

	let { children } = $props();

	const umamiWebsiteId = env.PUBLIC_UMAMI_WEBSITE_ID || import.meta.env.PUBLIC_UMAMI_WEBSITE_ID;
	const umamiHost =
		env.PUBLIC_UMAMI_HOST || import.meta.env.PUBLIC_UMAMI_HOST || 'https://cloud.umami.is';

	const themeColor = $derived(mode.current === 'dark' ? '#09090b' : '#ffffff');
	let displayVolume = $derived(`${Math.round(audioStore.volume * 100)}%`);
	let displayRate = $derived(`${Math.round(audioStore.playbackRate * 100)}%`);

	const session = useSession();
	let lastSyncedUserId: string | null = null;

	// Load server-side personal data as soon as a user signs in, regardless of
	// whether the destination is a book page. Without this, /bookmarks and /
	// show stale empty Dexie until the user opens a book.
	$effect(() => {
		if (!browser) return;

		const userId = session.user?.id ?? null;
		if (!userId) {
			lastSyncedUserId = null;
			return;
		}
		if (lastSyncedUserId === userId) return;

		lastSyncedUserId = userId;
		void syncService.syncUserData();
	});

	// A reconnect must also refresh server data, not only flush local queues.
	$effect(() => {
		if (!browser) return;

		const onOnline = () => {
			if (session.user?.id) void syncService.syncUserData();
		};
		window.addEventListener('online', onOnline);
		return () => window.removeEventListener('online', onOnline);
	});

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	afterNavigate(async ({ to }) => {
		if (to && typeof navigator !== 'undefined' && navigator.onLine) {
			try {
				const cache = await caches.open('pages-cache');
				const exists = await cache.match(to.url.pathname);
				if (!exists) {
					const res = await fetch(to.url.pathname);
					if (res.ok) {
						await cache.put(to.url.pathname, res);
					}
				}
			} catch {
				// Background page caching errors should not affect the UI
			}
		}
	});

	onMount(async () => {
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegistered(r) {
					log.debug('Service Worker registered successfully:', r);
				},
				onRegisterError(error) {
					log.error('Service Worker registration error:', error);
				}
			});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content={themeColor} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html pwaInfo ? pwaInfo.webManifest.linkTag : ''}
	{#if umamiWebsiteId}
		<script
			defer
			src="{umamiHost.replace(/\/+$/, '')}/script.js"
			data-website-id={umamiWebsiteId}
		></script>
	{/if}
</svelte:head>

<AudioProvider>
	<Tooltip.Provider delayDuration={200}>
		<ModeWatcher disableTransitions={false} />

		<div class="flex min-h-screen w-full flex-col lg:flex-row">
			<!-- Navigation (Desktop Sidebar + Mobile Header) -->
			<AppNavigation />

			<!-- Main content area -->
			<div
				class="relative flex min-w-0 flex-1 flex-col bg-no-repeat"
				style="background-image: radial-gradient(circle 800px at 50% -300px, color-mix(in oklch, var(--color-secondary) 100%, transparent) 0%, transparent 100%);"
			>
				<AppBreadcrumbs />
				<!-- Page Content -->
				<main class="page-content-transition flex-1">
					{@render children()}
				</main>
				<GlobalPlayer />
				<GuestDataAdoptionModal />
			</div>
		</div>
	</Tooltip.Provider>
</AudioProvider>

<ValueChangeOverlay supervisedValues={[displayVolume, displayRate]} />
