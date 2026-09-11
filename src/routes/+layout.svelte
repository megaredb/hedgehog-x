<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppNavigation from '$lib/components/header/AppNavigation.svelte';
	import AppBreadcrumbs from '$lib/components/layout/AppBreadcrumbs.svelte';
	import GlobalPlayer from '$lib/components/audio/GlobalPlayer.svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { onNavigate, afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';
	import { AudioProvider } from '$lib/components/ui/audio/provider';
	import { Tooltip } from 'bits-ui';
	import ValueChangeOverlay from '$lib/components/overlay/ValueChangeOverlay.svelte';
	import { audioStore } from '$lib/audio-store.svelte';
	import { createLogger } from '$lib/logger';

	const log = createLogger('SW');

	let { children } = $props();

	let displayVolume = $derived(`${Math.round(audioStore.volume * 100)}%`);
	let displayRate = $derived(`${Math.round(audioStore.playbackRate * 100)}%`);

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
				// Ошибки фонового кэширования страниц не должны влиять на UI
			}
		}
	});

	onMount(async () => {
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegistered(r) {
					log.debug('Service Worker успешно зарегистрирован:', r);
				},
				onRegisterError(error) {
					log.error('Ошибка регистрации Service Worker:', error);
				}
			});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html pwaInfo ? pwaInfo.webManifest.linkTag : ''}
</svelte:head>

<AudioProvider>
	<Tooltip.Provider delayDuration={200}>
		<ModeWatcher disableTransitions={false} />

		<div class="flex min-h-screen w-full flex-col lg:flex-row">
			<!-- Универсальная навигация (Десктопный Sidebar + Мобильный Header) -->
			<AppNavigation />

			<!-- Область контента -->
			<div
				class="relative flex min-w-0 flex-1 flex-col bg-no-repeat"
				style="background-image: radial-gradient(circle 800px at 50% -300px, color-mix(in oklch, var(--color-secondary) 100%, transparent) 0%, transparent 100%);"
			>
				<AppBreadcrumbs />
				<!-- Страницы -->
				<main class="page-content-transition flex-1">
					{@render children()}
				</main>
				<GlobalPlayer />
			</div>
		</div>
	</Tooltip.Provider>
</AudioProvider>

<ValueChangeOverlay supervisedValues={[displayVolume, displayRate]} />
