Архитектура и План разработки (TRD)

Контекст для ИИ-агента

Этот документ описывает технический стек, инфраструктуру, структуру БД и пошаговый план реализации проекта. Проанализируй текущую структуру SvelteKit-проекта (созданного через npx sv create) перед началом работы. Выполняй задачи строго по очереди, запрашивая подтверждение перед переходом к следующей.

1. Технический стек

Фреймворк: SvelteKit 5 (с использованием $state, $derived, $effect).

Язык: Strict TypeScript.

База данных: PostgreSQL + Drizzle ORM.

Стили: Tailwind CSS, shadcn-svelte, Lucide Icons.

PWA: vite-plugin-pwa (Workbox) для Cache API, Dexie.js для IndexedDB (метаданные).

Медиа: Cloudflare R2 (S3 API).

Авторизация: Better Auth (с плагинами WebAuthn).

2. Инфраструктура (Docker & Traefik)

Проект должен запускаться локально на домене https://hedgehog-inc.localhost.

mkcert: Используется для генерации локальных SSL сертификатов (Traefik читает их через volume). SSL обязателен для WebAuthn, Service Workers и Media Session API.

Traefik: Reverse proxy, слушающий порты 80 и 443, маршрутизирующий hedgehog-inc.localhost на сервис SvelteKit.

SvelteKit App: Собирается через @sveltejs/adapter-node (в проде) или запускается через Vite dev server (локально).

PostgreSQL: Запускается в Docker-сети.

3. Схема Базы Данных (Drizzle)

// books
export const books = pgTable('books', {
id: varchar('id', { length: 36 }).primaryKey(),
title: varchar('title', { length: 255 }).notNull(),
description: text('description'),
coverUrl: varchar('cover_url', { length: 255 }),
status: varchar('status', { length: 50 }).default('ongoing'),
createdAt: timestamp('created_at').defaultNow(),
});

// volumes
export const volumes = pgTable('volumes', {
id: varchar('id', { length: 36 }).primaryKey(),
bookId: varchar('book_id', { length: 36 }).references(() => books.id, { onDelete: 'cascade' }).notNull(),
volumeNumber: integer('volume_number').notNull(),
title: varchar('title', { length: 255 }).notNull(),
coverUrl: varchar('cover_url', { length: 255 }),
createdAt: timestamp('created_at').defaultNow(),
});

// chapters
export const chapters = pgTable('chapters', {
id: varchar('id', { length: 36 }).primaryKey(),
volumeId: varchar('volume_id', { length: 36 }).references(() => volumes.id, { onDelete: 'cascade' }).notNull(),
chapterNumber: integer('chapter_number').notNull(),
title: varchar('title', { length: 255 }).notNull(),
audioUrl: varchar('audio_url', { length: 512 }).notNull(),
durationSeconds: integer('duration_seconds').notNull(),
telegramPostUrl: varchar('telegram_post_url', { length: 255 }),
createdAt: timestamp('created_at').defaultNow(),
});

// progress
export const listeningProgress = pgTable('listening_progress', {
userId: varchar('user_id', { length: 36 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
chapterId: varchar('chapter_id', { length: 36 }).references(() => chapters.id, { onDelete: 'cascade' }).notNull(),
progressSeconds: integer('progress_seconds').notNull().default(0),
isCompleted: boolean('is_completed').default(false),
updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.chapterId] }) }));

// likes & bookmarks (schema outlines)
// volume_likes (userId, volumeId, PK)
// chapter_likes (userId, chapterId, PK)
// bookmarks (id, userId, chapterId, timestampSeconds, note)

(Структура пользователей и сессий управляется автоматически Better Auth).

4. Пошаговый план разработки

Этап 1: Базовая инфраструктура и БД

[ ] 1.1 Настроить docker-compose.yml (Postgres, Traefik, Node app).

[ ] 1.2 Создать скрипт/инструкцию для mkcert (создание сертификатов hedgehog-inc.localhost и монтирование их в Traefik).

[ ] 1.3 Инициализировать Drizzle ORM (drizzle-kit), подключить PostgreSQL.

[ ] 1.4 Написать схемы Drizzle (Books, Volumes, Chapters, Progress, Likes, Bookmarks).

[ ] 1.5 Сгенерировать и накатить первую миграцию.

Этап 2: SvelteKit Setup и Базовый UI

[ ] 2.1 Настроить `@sveltejs/adapter-node` в `svelte.config.js` (предварительно удалив `adapter-auto` из зависимостей).

[ ] 2.2 Инициализировать Tailwind CSS и установить shadcn-svelte (npx shadcn-svelte@latest init).

[ ] 2.3 Создать базовый Layout (+layout.svelte) с поддержкой тем (Dark/Light mode).

[ ] 2.4 Настроить Lucide Icons.

Этап 3: Аутентификация (Better Auth)

[ ] 3.1 Установить и настроить Better Auth в SvelteKit (server/auth.ts, client/auth.ts).

[ ] 3.2 Настроить Discord OAuth2 провайдер.

[ ] 3.3 Реализовать мост для Telegram Auth (кастомный плагин Better Auth + верификация хэша).

[ ] 3.4 Включить и настроить плагин Passkey (WebAuthn).

[ ] 3.5 Создать UI: Модалка/Страница логина.

Этап 4: Ядро — Глобальный Аудиоплеер

[ ] 4.1 Создать глобальное состояние плеера lib/stores/player.svelte.ts (используя Runes).

[ ] 4.2 Создать UI плеера (Мини-плеер для футера, Полноэкранный плеер для мобилок).

[ ] 4.3 Реализовать базовую логику HTMLAudioElement (Play, Pause, Seek, Volume, Speed).

[ ] 4.4 Интегрировать Media Session API (обновление метаданных системы).

[ ] 4.5 Добавить поддержку горячих клавиш на десктопе (через svelte:window).

[ ] 4.6 Добавить жесты для мобилок (Double tap по обложке).

[ ] 4.7 Реализовать логику Слип-таймера.

Этап 5: Каталог Контента

[ ] 5.1 Создать API-роуты SvelteKit для получения списка книг, томов и глав.

[ ] 5.2 Создать UI: Главная страница со списком книг (Card UI).

[ ] 5.3 Создать UI: Страница Книги (Список томов).

[ ] 5.4 Создать UI: Страница Тома (Список глав, кнопка Play).

[ ] 5.5 Добавить Skeleton Loaders для всех загрузок страниц.

Этап 6: Оффлайн-режим (PWA & IndexedDB)

[ ] 6.1 Настроить vite-plugin-pwa (Service Worker). Убедиться, что манифест генерируется.

[ ] 6.2 Интегрировать Dexie.js (lib/db/local.ts).

[ ] 6.3 Реализовать логику синхронизации прогресса: каждые 10 секунд писать в Dexie, если онлайн — слать в Drizzle.

[ ] 6.4 Кэширование аудио (PWA): Реализовать логику загрузки кусков аудио в Cache API через Service Worker.

[ ] 6.5 Скачивание файлов: Написать endpoint или логику для прямой загрузки .mp3 на устройство (заголовок attachment).

[ ] 6.6 Создать UI: Менеджер загрузок (просмотр и удаление сохраненных глав из кэша).

Этап 7: Социальные фичи

[ ] 7.1 Реализовать API и UI для добавления/удаления личных закладок по таймкоду.

[ ] 7.2 Реализовать API и UI для Лайков (Тома и Главы).

[ ] 7.3 Интегрировать виджет комментариев Telegram на страницу Тома/Главы (по telegramPostUrl).

Этап 8: Админ-панель и Cloudflare R2

[ ] 8.1 Создать Middleware для проверки роли админа на /admin/*.

[ ] 8.2 Настроить AWS SDK v3 (S3 client) для работы с Cloudflare R2.

[ ] 8.3 Создать endpoint для генерации Presigned URLs на загрузку файлов.

[ ] 8.4 Реализовать CRUD интерфейсы для Книг, Томов и Глав. При загрузке аудиофайлов на сервере использовать библиотеку `music-metadata` для извлечения `durationSeconds` и сохранения в БД.

Инструкция ИИ-агенту по процессу разработки:

При начале новой задачи, сначала проверь существующий код.

Предложи архитектурное решение или структуру компонента перед написанием полного кода.

Используй Svelte 5 Runes. Избегай старых stores (writable), если это возможно.

Весь серверный код (запросы к БД) пиши в +page.server.ts или API роутах +server.ts.

Валидацию форм выполняй через Zod.
