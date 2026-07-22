/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { RangeRequestsPlugin } from 'workbox-range-requests';

declare let self: ServiceWorkerGlobalScope;

// 1. Автоматическое кэширование статики (UI, скрипты), сгенерированное Vite
precacheAndRoute(self.__WB_MANIFEST);

// 2. Настройка чтения аудио из кэша (с поддержкой перемотки)
// Если браузер запрашивает аудио, SW сначала ищет его в кэше 'audio-cache'
registerRoute(
	({ request }) => request.destination === 'audio' || request.url.endsWith('.mp3'),
	new CacheFirst({
		cacheName: 'audio-cache',
		plugins: [
			new CacheableResponsePlugin({ statuses: [200] }),
			new RangeRequestsPlugin() // ❗️ Критически важно для плеера!
		]
	})
);

// 3. Общение с клиентом (сохранение и удаление по кнопке)
self.addEventListener('message', async (event) => {
	if (!event.data) return;

	const { type, payload } = event.data;

	if (type === 'CACHE_AUDIO') {
		// Команда на скачивание книги
		try {
			const cache = await caches.open('audio-cache');

			// Отправляем сообщение клиенту, что начали
			event.source?.postMessage({ type: 'DOWNLOAD_START', url: payload.url });

			await cache.add(payload.url); // Скачиваем и кладем в кэш

			// Сообщаем об успехе
			event.source?.postMessage({ type: 'DOWNLOAD_SUCCESS', url: payload.url });
		} catch (error) {
			console.error('Ошибка кэширования аудио:', error);
			event.source?.postMessage({ type: 'DOWNLOAD_ERROR', url: payload.url });
		}
	}

	if (type === 'DELETE_AUDIO') {
		// Команда на удаление книги из кэша
		try {
			const cache = await caches.open('audio-cache');
			await cache.delete(payload.url);

			event.source?.postMessage({ type: 'DELETE_SUCCESS', url: payload.url });
		} catch (error) {
			console.error('Ошибка удаления аудио:', error);
		}
	}
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
