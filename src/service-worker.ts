/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { RangeRequestsPlugin } from 'workbox-range-requests';

declare const self: ServiceWorkerGlobalScope;

// Precache SvelteKit assets (JS, CSS, images from the build output)
precacheAndRoute(self.__WB_MANIFEST);

// Cache audio files (Range Requests support is required for audio streaming!)
registerRoute(
	({ url }) => url.pathname.endsWith('.mp3') || url.pathname.includes('/audio/'),
	new CacheFirst({
		cacheName: 'audio-cache',
		plugins: [new RangeRequestsPlugin()]
	})
);

// Cache other assets (images, fonts)
registerRoute(
	({ request }) => request.destination === 'image' || request.destination === 'font',
	new CacheFirst({
		cacheName: 'assets-cache'
	})
);

// Network first for API requests
registerRoute(
	({ url }) => url.pathname.startsWith('/api/'),
	new NetworkFirst({
		cacheName: 'api-cache'
	})
);

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});
