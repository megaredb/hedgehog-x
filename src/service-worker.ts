/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { createLogger } from './lib/logger';

const log = createLogger('SW');

declare let self: ServiceWorkerGlobalScope;

// 1. Автоматическое кэширование статики (UI, скрипты), сгенерированное Vite
precacheAndRoute(self.__WB_MANIFEST);

// 2. Стратегия кэширования навигационных HTML-запросов (страниц)
const navigationStrategy = new NetworkFirst({
	cacheName: 'pages-cache',
	networkTimeoutSeconds: 3,
	plugins: [new CacheableResponsePlugin({ statuses: [200] })]
});

const navigationRoute = new NavigationRoute(async (params) => {
	try {
		const response = await navigationStrategy.handle(params);
		if (response) return response;
	} catch (error) {
		log.warn('Сетевой запрос страницы не удался, пробуем кэш:', error);
	}

	// 1. Ищем точное совпадение для этого URL в кэше
	const cachedResponse = await caches.match(params.request);
	if (cachedResponse) return cachedResponse;

	// 2. Если конкретная страница не была сохранена, отдаем закэшированный корень ('/')
	const fallbackShell = await caches.match('/');
	if (fallbackShell) return fallbackShell;

	// 3. Запасной оффлайн-ответ, если кэш пуст
	return new Response(
		'<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Оффлайн | Hedgehog X</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#09090b;color:#fafafa;text-align:center;padding:1rem;"><h2>Нет подключения к сети</h2><p style="color:#a1a1aa;max-width:400px;">Эта страница ещё не была загружена в оффлайн-кэш. Подключитесь к интернету и откройте её снова.</p><a href="/" style="color:#60a5fa;text-decoration:none;margin-top:1rem;">Вернуться на главную</a></body></html>',
		{
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
			status: 200
		}
	);
});
registerRoute(navigationRoute);

// 3. Настройка чтения аудио из кэша (с поддержкой перемотки)
// Если браузер запрашивает аудио, SW сначала ищет его в кэше 'audio-cache'
registerRoute(
	({ request }) => request.destination === 'audio' || request.url.endsWith('.mp3'),
	new CacheFirst({
		cacheName: 'audio-cache',
		plugins: [
			new CacheableResponsePlugin({ statuses: [200] }),
			new RangeRequestsPlugin() // ❗️ Критически важно для плеера (особенно для iOS/Safari)!
		]
	})
);

// 4. Мгновенная активация Service Worker'а и прогрев кэша главной страницы
self.addEventListener('install', (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open('pages-cache').then((cache) => {
			return cache.add('/').catch((err) => log.warn('Ошибка прогрева кэша /:', err));
		})
	);
});
self.addEventListener('activate', () => self.clients.claim());
