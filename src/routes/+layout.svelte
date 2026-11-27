<script lang="ts">
	import './layout.css';
	import AppNavigation from '$lib/components/header/AppNavigation.svelte';
	import BroadcastRail from '$lib/components/header/BroadcastRail.svelte';
	import { page } from '$app/state';
	import AppBreadcrumbs from '$lib/components/layout/AppBreadcrumbs.svelte';
	import GlobalPlayer from '$lib/components/audio/GlobalPlayer.svelte';
	import { ModeWatcher, mode } from 'mode-watcher';
	import { onNavigate, afterNavigate } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount, untrack } from 'svelte';
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
	import { configureMirrors } from '$lib/utils/mirror';
	import { BROADCAST_CHECK_INTERVAL_MS, broadcastWasDeleted } from '$lib/client/broadcast-player';
	import { isPageCacheDenied } from '$lib/client/page-cache';

	const log = createLogger('SW');

	let { data, children } = $props();
	const broadcastFocus = $derived(page.url.pathname.startsWith('/broadcasts'));
	const defaultOg = $derived(
		!page.url.pathname.startsWith('/admin') &&
			!page.url.pathname.startsWith('/books/') &&
			!page.url.pathname.startsWith('/broadcasts/')
	);
	const defaultOgImage = $derived(new URL('/logo.webp', page.url.origin).href);

	configureMirrors(untrack(() => data.mirrors ?? []));

	$effect(() => {
		configureMirrors(data.mirrors ?? []);
	});

	const umamiWebsiteId = env.PUBLIC_UMAMI_WEBSITE_ID || import.meta.env.PUBLIC_UMAMI_WEBSITE_ID;
	const umamiHost =
		env.PUBLIC_UMAMI_HOST || import.meta.env.PUBLIC_UMAMI_HOST || 'https://cloud.umami.is';

	const themeColor = $derived(mode.current === 'dark' ? '#09090b' : '#ffffff');
	let displayVolume = $derived(`${Math.round(audioStore.volume * 100)}%`);
	let displayRate = $derived(`${Math.round(audioStore.playbackRate * 100)}%`);

	const session = useSession();
	let lastSyncedUserId: string | null = null;

	$effect(() => {
		if (!browser) return;
		const broadcastId = audioStore.currentTrack?.broadcastId;
		if (!broadcastId) return;

		let cancelled = false;
		const checkStillExists = async () => {
			if (cancelled) return;
			const deleted = await broadcastWasDeleted(String(broadcastId));
			if (!cancelled && deleted) await audioStore.removeBroadcast(String(broadcastId));
		};
		void checkStillExists();
		const timer = setInterval(() => void checkStillExists(), BROADCAST_CHECK_INTERVAL_MS);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	});

	$effect(() => {
		if (!browser) return;
		const broadcastId = audioStore.currentTrack?.broadcastId;
		const isLive = audioStore.currentTrack?.broadcastLive === true;
		if (!broadcastId || !isLive || !audioStore.isPlaying) return;
		let stopped = false;
		let timer: ReturnType<typeof setInterval> | null = null;
		const stop = () => {
			stopped = true;
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
		};
		const sendHeartbeat = async () => {
			if (stopped) return;
			try {
				const res = await fetch(`/api/broadcasts/${broadcastId}/heartbeat`, { method: 'POST' });
				if (stopped) return;
				if (res.status === 409 || res.status === 404) {
					stop();
					if (audioStore.currentTrack?.broadcastId === broadcastId) {
						audioStore.currentTrack = {
							...audioStore.currentTrack,
							broadcastLive: false
						};
					}
				}
			} catch {
				// Ignore transient network errors
			}
		};
		void sendHeartbeat();
		timer = setInterval(() => void sendHeartbeat(), 10_000);
		return () => {
			stop();
			// The page itself keeps presence while it is open. If playback is paused
			// elsewhere, remove the listener immediately instead of waiting 30s.
			if (page.url.pathname === `/broadcasts/${broadcastId}`) return;
			void fetch(`/api/broadcasts/${broadcastId}/leave`, {
				method: 'POST',
				keepalive: true
			}).catch(() => {});
		};
	});

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
			if (isPageCacheDenied(to.url.pathname)) return;
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
	<link rel="icon" href="/pwa-64x64.png" type="image/png" />
	<meta name="theme-color" content={themeColor} />
	{#if defaultOg}
		<meta property="og:site_name" content="Hedgehog X" />
		<meta property="og:type" content="website" />
		<meta property="og:title" content="Hedgehog X — аудиокниги HEDGEHOG.INC" />
		<meta property="og:description" content="Слушайте аудиокниги HEDGEHOG.INC онлайн и офлайн." />
		<meta property="og:image" content={defaultOgImage} />
		<meta property="og:url" content={page.url.href} />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content="Hedgehog X — аудиокниги HEDGEHOG.INC" />
		<meta name="twitter:description" content="Слушайте аудиокниги HEDGEHOG.INC онлайн и офлайн." />
		<meta name="twitter:image" content={defaultOgImage} />
	{/if}
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
		<ModeWatcher defaultMode="dark" track={false} disableTransitions={false} />

		<div class="flex min-h-screen w-full flex-col lg:flex-row">
			<!-- Navigation (Desktop Sidebar + Mobile Header) -->
			<div class="app-navigation-shell contents">
				{#if broadcastFocus}
					<BroadcastRail />
					<div class="lg:hidden"><AppNavigation /></div>
				{:else}
					<AppNavigation />
				{/if}
			</div>

			<!-- Main content area -->
			<div
				class="relative flex min-w-0 flex-1 flex-col bg-no-repeat"
				style="background-image: radial-gradient(circle 800px at 50% -300px, color-mix(in oklch, var(--color-secondary) 100%, transparent) 0%, transparent 100%);"
			>
				<div class="app-breadcrumbs contents">
					{#if !page.url.pathname.startsWith('/broadcasts/')}<AppBreadcrumbs />{/if}
				</div>
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

<style>
	:global(body.broadcast-expanded) .app-navigation-shell,
	:global(body.broadcast-expanded) .app-breadcrumbs {
		display: none;
	}
</style>
