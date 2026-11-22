# PROJECT_MAP.md — подробная карта проекта

> Снимок: 2026-11-18, `dev`/`5f67c5d`. Проверяй код, если сомневаешься.
> Карта перечисляет **фактические** файлы, маршруты, таблицы и связи, а не желаемое.

## 1. Масштаб и верхний уровень

| Метрика                            | Значение                                              |
| ---------------------------------- | ----------------------------------------------------- |
| Файлов в `src/`                    | 324                                                   |
| `.svelte`                          | 203 (159 — `components/ui`)                           |
| `.ts`                              | 118                                                   |
| Всего строк `src/**/*.{ts,svelte}` | ~25 147                                               |
| Маршрутов-страниц                  | 19 путей (19 директорий)                              |
| API-эндпоинтов своих               | 11 обработчиков (9 путей) + `/api/auth/*` better-auth |
| Таблиц БД                          | 16 (12 доменных + 4 auth)                             |
| Dexie-хранилищ                     | 11 (v3; `meta` + `syncQueue.ownerUserId`)             |
| Unit-тестов                        | 198 в 26 файлах                                       |
| E2E-тестов                         | 47 в 9 файлах                                         |

```
.
├── AGENTS.md                  # инструкции агенту (вход)
├── GEMINI.md                  # указатель на AGENTS.md
├── README.md                  # краткий обзор проекта
├── docs/                      # эта документация
├── package.json               # скрипты, deps, packageManager/engines
├── pnpm-lock.yaml
├── pnpm-workspace.yaml        # allowBuilds (sharp, esbuild, ...)
├── vite.config.ts             # SvelteKit + adapter-node + PWA + Tailwind
├── tsconfig.json              # extends .svelte-kit/tsconfig.json
├── drizzle.config.ts          # schema: src/lib/server/db/schema.ts
├── playwright.config.ts       # preview :4192, testMatch **/*.e2e.ts
├── eslint.config.js
├── prettier.config.js
├── components.json            # shadcn-svelte: style vega, alias $lib
├── compose.yaml               # db, traefik, db-init, umami
├── compose.dev.yml            # ports, dbgate, certs, dynamic
├── compose.prod.yml           # app + traefik LE + umami
├── compose.test.yml           # test-db + playwright
├── Dockerfile                 # multi-stage production image
├── Dockerfile.test            # Playwright image: db:migrate -> seed -> build -> test
├── server.js                  # compression + immutable cache headers + adapter-node handler
├── scripts/                   # migrate.mjs + docker-entrypoint.sh
├── drizzle/                   # 14 SQL-миграций 0000–0013 + meta (актуальны)
├── e2e/                       # 9 файлов Playwright
├── dynamic/dev.yaml           # Traefik file-provider для dev
├── docker/init-umami-db.sh
├── static/                    # assets (аудио, картинки, видео, QR, PWA)
└── src/                       # приложение
```

**Важно:** `svelte.config.js` отсутствует. Конфиг SvelteKit передан прямо в
`vite.config.ts` (`sveltekit({ adapter, compilerOptions, ... })`); `svelte-kit sync`
и `vite build` с этим работают.

## 2. Маршруты (страницы)

Легенда: **SSR** — что реально рендерится сервером; **Данные** — откуда берётся контент.

| Путь                         | Файлы                                                                    | SSR              | Данные                                        | Заметки                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------ | ---------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `/`                          | `routes/+page.svelte`, `+page.server.ts`                                 | SSR (БД)         | `books` (обложки/видео, порядок)              | `?book=id`; видеофоны из R2; обложки из БД; нет OG                                            |
| `/books`                     | `routes/books/+page.svelte`, `+page.server.ts`                           | SSR (БД)         | Drizzle `books`                               | порядок `books.sort_order`, затем title                                                       |
| `/books/[bookId]`            | `+layout.ts`, `+page.svelte`                                             | «Загрузка...»    | Dexie (`books`, `volumes`)                    | layout фоново `syncBookDetails` + `syncUserData`; grid/list                                   |
| `/books/[bookId]/[volumeId]` | `+page.svelte`, `+page.server.ts`                                        | SSR (БД) + Dexie | Dexie                                         | табы главы/закладки/иллюстрации/обсуждение; выбор версии озвучки; `?ch=&t=`; completion modal |
| `/bookmarks`                 | `+page.svelte`                                                           | каркас           | Dexie `bookmarks` + enrich                    | пагинация, удаление, play                                                                     |
| `/history`                   | `+page.svelte`                                                           | каркас           | Dexie `progress` + enrich                     | пагинация, «очистить» только локально                                                         |
| `/downloads`                 | `+page.svelte`                                                           | каркас           | Dexie `downloads` + `chapters`/`volumes`      | очередь и сохранённые тома                                                                    |
| `/settings`                  | `+page.svelte`, `settings-helpers.ts`                                    | каркас           | localStorage/audioStore/Dexie counts          | seek step, rate, auto-advance, mirror, cache, sync                                            |
| `/profile`                   | `+page.svelte`                                                           | каркас           | `useSession`, `useAccounts`                   | редирект на `/auth`; link/unlink/delete                                                       |
| `/auth`                      | `+page.svelte`                                                           | каркас           | `useSession`                                  | Telegram/Discord; ошибки; `?from=`                                                            |
| `/community`                 | `+page.svelte`                                                           | статика          | константы                                     | VK/TG/Discord/Boosty                                                                          |
| `/support`                   | `+page.svelte`                                                           | статика          | `strings`                                     | карта/TON/QR                                                                                  |
| `/about`                     | `+page.svelte`                                                           | статика          | константы                                     | авторы/разработчики                                                                           |
| `/admin`                     | `+layout.server.ts`, `+layout.svelte`, `+page.server.ts`, `+page.svelte` | SSR (БД)         | Drizzle counts/recent                         | только admin; dev self-promote                                                                |
| `/admin/analytics`           | `+page.server.ts`, `+page.svelte`                                        | SSR (БД)         | агрегаты                                      | admin; Umami-статус                                                                           |
| `/admin/content`             | `+page.server.ts`, `+page.svelte`, `$lib/components/admin/content/*`     | SSR (БД)         | books/volumes/chapters/versions/illustrations | единое рабочее пространство: книги, тома, главы, версии озвучки и иллюстрации                 |

Старые URL `/admin/books`, `/admin/volumes`, `/admin/chapters`, `/admin/versions`,
`/admin/illustrations` отдают 303 на `/admin/content` (`src/routes/admin/[legacy]/+page.server.ts`).

**Нет** файлов `+error.svelte` (ни в `src/routes`, ни в `src`), `hooks.client.ts`,
`+layout.server.ts` (кроме admin). Неизвестные book/volume отдают 200.

### 2.1. Клиентские загрузчики

| Файл                                            | Что делает                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/routes/books/[bookId]/+layout.ts`          | В браузере запускает `syncService.syncBookDetails(bookId)` и `syncUserData()` без `await`; возвращает `{bookId}`. |
| `src/routes/books/[bookId]/[volumeId]/+page.ts` | Возвращает `{bookId, volumeId}`; данных нет.                                                                      |
| `src/routes/admin/+layout.server.ts`            | `locals.user ? user/isAdmin/isDev : redirect('/auth?from=/admin')`.                                               |
| `src/routes/admin/*/+page.server.ts`            | `requireAdmin` + выборки + form actions.                                                                          |

## 3. API

### 3.1. Свои эндпоинты

| Метод/путь                      | Файл                              | Auth                      | Вход                                                                             | Выход/эффект                                                                                                                                |
| ------------------------------- | --------------------------------- | ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/books`                | `api/books/+server.ts`            | нет                       | —                                                                                | Все книги, `ORDER BY created_at DESC`; без кэша/пагинации                                                                                   |
| `GET /api/books/[bookId]`       | `api/books/[bookId]/+server.ts`   | нет                       | `If-None-Match` (опц.)                                                           | Книга + volumes + chapters + illustrations + `likesCount`; weak ETag SHA1; 304/200/404; `Cache-Control: public, max-age=0, must-revalidate` |
| `GET /api/media/[...key]`       | `api/media/[...key]/+server.ts`   | нет                       | Range (для аудио)                                                                | Потоковая отдача объекта из R2; `206` + `Content-Range`; локальный media-proxy                                                              |
| `GET /api/metrics`              | `api/metrics/+server.ts`          | admin / `METRICS_TOKEN`   | Bearer-токен (опц.)                                                              | Prometheus text: up, uptime, Node version, HTTP/sync/error counters; 403 без доступа                                                        |
| `POST /api/analytics/listen`    | `api/analytics/listen/+server.ts` | гость/пользователь        | `{chapterId,bookId?,volumeId?,listenedSeconds,startedAt}` или `{sessions:[...]}` | Валидация 1..300 сек; INSERT `listening_sessions`; UPSERT `daily_listening_stats`; 400 при любой невалидной сессии                          |
| `GET /api/user/sync`            | `api/user/sync/+server.ts`        | обязательна (гость → 401) | —                                                                                | `{userId,userName,isNewUser,chapterLikes,volumeLikes,listeningProgress,bookmarks}`; timestamps в ms                                         |
| `GET /health`                   | `health/+server.ts`               | нет                       | —                                                                                | `{status:'ok',database:'ok'}` или 503; используется Docker healthcheck                                                                      |
| `POST /api/user/progress/clear` | `user/progress/clear/+server.ts`  | обязательна               | —                                                                                | Удаляет `listening_progress` пользователя; 401 для гостя                                                                                    |
| `POST /api/user/sync`           | `api/user/sync/+server.ts`        | обязательна               | `progressUpdates`, `bookmarkUpdates`, `volumeLikeUpdates`, `chapterLikeUpdates`  | Последовательные upsert/delete; 401 без сессии; 500 при ошибке                                                                              |
| `POST /api/user/delete`         | `api/user/delete/+server.ts`      | обязательна               | —                                                                                | DELETE user (каскады); `{ok:true}`                                                                                                          |
| `GET /api/user/delete`          | `api/user/delete/+server.ts`      | нет                       | —                                                                                | 405                                                                                                                                         |

### 3.2. Better-auth

`/api/auth/*` не имеет файлов в `src/routes/api/auth`. `src/hooks.server.ts` вызывает
`svelteKitHandler({ event, resolve, auth, building })`, который обслуживает:
`sign-in/social`, `callback/[provider]`, `get-session`, `list-accounts`,
`link-social`, `unlink-account`, `sign-out` и остальные эндпоинты better-auth.

### 3.3. Контракт `POST /api/user/sync` (детально)

```jsonc
{
	"progressUpdates": [
		{ "chapterId": "overlord_v1_c1", "progressSeconds": 123, "isCompleted": false }
	],
	"bookmarkUpdates": [
		{
			"id": "uuid",
			"chapterId": "overlord_v1_c1",
			"timestampSeconds": 30,
			"note": "text",
			"action": "upsert"
		} // или { "id": "uuid", "action": "delete" }
	],
	"volumeLikeUpdates": [
		{ "id": "overlord_vol_1", "volumeId": "overlord_vol_1", "action": "like", "timestamp": 0 }
	],
	"chapterLikeUpdates": [
		{ "id": "overlord_v1_c1", "chapterId": "overlord_v1_c1", "action": "unlike" }
	]
}
```

- Прогресс: `GREATEST(old.progress_seconds, new)`; `isCompleted` становится true, но
  никогда не сбрасывается.
- Закладки: upsert по `id` (PK), без проверки владельца `chapterId`; delete — по
  `id AND userId`.
- Лайки: `ON CONFLICT DO NOTHING` для like; delete по `(userId, id)`.
- Нет транзакции на весь пакет; нет лимита на размер; нет валидации длины note/id.

## 4. Серверные модули

| Файл                               | Ответственность                                                                          | Нюансы                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/hooks.server.ts`              | getSession → `locals`; `svelteKitHandler`; seed при старте и на `/api/books*`            | seed fire-and-forget; нет обработки ошибок getSession                             |
| `src/lib/server/auth.ts`           | better-auth: Telegram OIDC, Discord, linking, session hook                               | Discord credentials из env (fallback — пустые строки); Telegram ID из `claims.id` |
| `src/lib/server/admin.ts`          | `requireAdmin(locals)` → 401/403                                                         | используется в admin actions, но не в `/admin` overview                           |
| `src/lib/server/db/index.ts`       | postgres-js + Drizzle; `DATABASE_URL` из dynamic private/process.env; fallback localhost | top-level await dynamic import                                                    |
| `src/lib/server/db/schema.ts`      | 10 доменных таблиц + relations                                                           | FK cascade; индексы только у analytics                                            |
| `src/lib/server/db/auth.schema.ts` | 4 таблицы better-auth + provider-поля + role                                             | «генерируется», но правится руками                                                |
| `src/lib/server/db/seed.ts`        | `DEFAULT_BOOKS` (2 книги/4 тома/10 глав/4 иллюстрации) + `ensureDefaultBooks`            | idempotent `onConflictDoNothing`; все главы на `/audio/sample.mp3`                |
| `src/lib/server/storage/r2.ts`     | S3 client, sharp→WebP, blurhash, themeColor, upload/delete, local fallback               | `deleteFromStorage` не вызывается из CRUD                                         |
| `src/lib/analytics/stats.ts`       | даты UTC, `buildDailyStatId`, валидация heartbeat, форматирование                        | id может >128; id-коллизии при underscores                                        |
| `src/lib/logger.ts`                | scoped logger (browser/server/SW)                                                        | уровни: dev debug, prod browser warn, server info                                 |

## 5. Клиентские модули

| Файл                                               | Ответственность                                                   | Связи/риски                                        |
| -------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| `client/db/index.ts`                               | Dexie `HedgehogDB` v3, 11 stores, `SyncItem.ownerUserId`          | одна БД на браузер; owner в `meta` + queue         |
| `client/db/hydrate.ts`                             | bulkPut + purge 'all' или по index; `allowEmptyPurge`             | пустой `'all'` по умолчанию no-op (P0-01)          |
| `client/db/useLiveQuery.svelte.ts`                 | `useDexie(querier,fallback,deps)`                                 | liveQuery + $effect; ошибки только лог             |
| `client/services/syncService.ts`                   | `syncBooks` (dead), `syncBookDetails`, owner-aware `syncUserData` | 401/offline → no writes; guest import with consent |
| `client/services/syncPolicy.ts`                    | чистая policy merge/replace/switch                                | покрыта unit-тестами                               |
| `client/db/syncState.ts`                           | `syncOwner` в Dexie meta, clear/count helpers                     | guest/switch/pending-логика                        |
| `client/services/mappers.ts`                       | server → Offline*                                                 | likesCount добавляется                             |
| `client/services/likeService.ts`                   | optimistic volume/chapter like; queue; sync; online listener      | flush только по событию/действию                   |
| `client/services/bookmarkService.ts`               | add/delete bookmark; online direct POST; queue on failure/offline | retry через bookmarkSync                           |
| `client/services/bookmarkSync.ts`                  | batch flush ADD/REMOVE_BOOKMARK; online/start/manual              | owner-filter; один in-flight; P0-03                |
| `client/services/guestAdoption.svelte.ts`          | explicit guest→account import decision store                      | new user auto, existing user prompt; P0-05         |
| `components/overlay/GuestDataAdoptionModal.svelte` | consent UI for guest data                                         | «Перенести» / «Не переносить»                      |
| `client/services/progressSync.svelte.ts`           | batch progress 30s; owner-aware offline queue                     | clear history не чистит очередь                    |
| `client/services/listeningTracker.svelte.ts`       | accumulates active playback; 30s heartbeat; offline batch         | batch poison pill; manual sync не вызывает         |
| `client/downloads/downloadManager.svelte.ts`       | sequential download queue, OPFS, storage estimate, progress       | partial file не удаляется; грузит все chapters     |
| `client/session.svelte.ts`                         | offline-resilient session wrapper; secure signOut                 | logout/expiry → clear local data; P0-05            |
| `client/accounts.svelte.ts`                        | list/link/unlink/delete accounts                                  | offline cache                                      |
| `client/auth-storage.ts`                           | localStorage cache session/accounts                               | token не кэшируется; P1-06                         |
| `client/authClient.ts`                             | better-auth client + telegram plugin                              | credentials include                                |
| `client/providers.ts`                              | Telegram/Discord UI metadata                                      | avatar/username helpers                            |
| `client/analytics.ts`                              | Umami trackEvent + sendListenHeartbeat                            | no-throw                                           |
| `audio-store.svelte.ts`                            | playback state/queue/controls/persistence                         | много dead API; localStorage write на timeupdate   |
| `html-audio.ts`                                    | `HtmlAudio` singleton, Track type, OPFS/legacy cache, retry/fade  | двойной retry с provider                           |
| `utils/mirror.ts`                                  | primary/RU CDN rewrite + fallback                                 | host matching по строке                            |
| `utils/color.ts`                                   | average color через canvas                                        | CORS → fallback                                    |
| `utils/telegram.ts`                                | `t.me/channel/123` → `channel/123`                                | regex                                              |
| `actions/inview.ts`                                | IntersectionObserver action                                       | callback только true                               |
| `constants/strings.ts`                             | русские строки                                                    | часть UI хардкодит текст                           |
| `types/showcase.ts`                                | тип витрины главной                                               | данные приходят из `+page.server.ts`               |

### 5.1. Dexie

```ts
DB: 'HedgehogDB';
// v1: контент/пользовательские данные/очередь
books: 'id';
volumes: 'id, bookId';
chapters: 'id, volumeId';
illustrations: 'id, volumeId';
progress: 'chapterId';
volumeLikes: 'volumeId';
chapterLikes: 'chapterId';
bookmarks: 'id, chapterId';
downloads: 'chapterId, status';
syncQueue: '++id, action, timestamp';
// v2 (additive): владелец локальных данных
meta: 'key'; // syncOwner: { userId, updatedAt }
```

Типы: `OfflineBook/Volume/Chapter/Illustration/Progress/VolumeLike/ChapterLike/Bookmark/Download`,
`SyncItem`, `OfflineMeta`. Ключи прогресса/лайков — ID сущности; владелец хранится
в `meta.syncOwner` (P0-01) и `syncQueue.ownerUserId` (P1-12/P0-05).

### 5.2. localStorage / CacheStorage / OPFS

| Ключ/хранилище                     | Кто пишет                       | Назначение                                                                         |
| ---------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| `audio:ui:store`                   | audioStore                      | currentTrack, queue, volume, rate, repeat, shuffle, currentTime, insertMode, index |
| `hedgehog:seek_step`               | audioStore/settings             | 5/10/15/30                                                                         |
| `hedgehog:auto_advance`            | audioStore/settings             | boolean                                                                            |
| `hedgehog:playback_rate`           | audioStore/settings             | 0.25..2                                                                            |
| `hedgehog:mirror_preference`       | mirror/settings                 | auto/primary/ru                                                                    |
| `hedgehog_auth_session`            | auth-storage                    | сессия+user (включая token)                                                        |
| `hedgehog_auth_accounts`           | auth-storage                    | linked accounts                                                                    |
| `videoBackgroundPlaying`           | root page                       | видеофон вкл/выкл                                                                  |
| `LOG_LEVEL`                        | logger override                 | debug/info/warn/error                                                              |
| `hedgehog-welcome-modal-dismissed` | только e2e                      | мёртвый ключ (модалки нет)                                                         |
| CacheStorage `pages-cache`         | SW + afterNavigate              | HTML страниц                                                                       |
| CacheStorage `audio-cache`         | SW CacheFirst + legacy download | аудио по URL                                                                       |
| Workbox precache                   | build                           | статические ассеты                                                                 |
| OPFS root                          | downloadManager                 | файлы с именем chapterId                                                           |

## 6. Компоненты

### 6.1. Каркас

| Компонент                           | Роль                                                                                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routes/+layout.svelte`             | `AudioProvider`, Tooltip.Provider, ModeWatcher, AppNavigation, AppBreadcrumbs, GlobalPlayer, ValueChangeOverlay, PWA register, Umami script, view transitions + page caching |
| `header/AppNavigation.svelte`       | desktop sidebar + mobile sheet; группы «Библиотека»/«Информация»; профиль/тема                                                                                               |
| `header/ProfileDropdown.svelte`     | профиль/настройки/выход или вход                                                                                                                                             |
| `header/ThemeSwitchButton.svelte`   | mode-watcher toggle                                                                                                                                                          |
| `layout/AppBreadcrumbs.svelte`      | крошки из pathname + Dexie названий; ellipsis                                                                                                                                |
| `overlay/ValueChangeOverlay.svelte` | всплывающий % громкости/скорости                                                                                                                                             |

### 6.2. Плеер

| Компонент                                 | Роль                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio/GlobalPlayer.svelte`               | sticky-плеер; desktop controls + mobile drawer; закладка; undo seek; ссылка на том                                                                |
| `ui/audio/provider/audio-provider.svelte` | мост store ↔ HTMLAudioElement: события, load/play, progress save 5s, completed, sleep timer, persist                                              |
| `ui/audio/player/*`                       | Root, ControlBar, ControlGroup, Play, SeekBar, SeekSlider, Volume, Speed, SleepTimer, Download, SkipBack/Forward, Rewind/FastForward, TimeDisplay |
| `audio/Download.svelte`                   | кнопка скачивания/удаления/прогресса для главы                                                                                                    |
| `volume/VolumeCompletionModal.svelte`     | модалка завершения тома + джингл + support                                                                                                        |

### 6.3. Контент

| Компонент                                              | Роль                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `volume/VolumeHeader.svelte`                           | обложка, статус, like, share, download all, accent color, playing effects |
| `volume/VolumeChaptersTab.svelte`                      | главы: play/pause, progress, like, comments, download                     |
| `volume/VolumeIllustrationsTab.svelte`                 | сетка иллюстраций + lightbox                                              |
| `comments/TelegramComments.svelte`                     | Telegram discussion widget / offline/empty states                         |
| `comments/ChapterCommentsDrawer.svelte`                | drawer с комментариями главы                                              |
| `share/ShareModal.svelte` + `share.ts`                 | ссылка на том/главу/таймкод; native share; текст для мессенджеров         |
| `seo/OpenGraphMeta.svelte` + `og.ts`                   | OG/Twitter meta; fallback при отсутствии данных                           |
| `showcase/*`                                           | витрина: фон-видео, секции, навигация                                     |
| `support/SupportBlock.svelte`                          | Boosty, карта, TON, QR                                                    |
| `auth/GuestAuthModal.svelte`                           | модалка входа при лайке                                                   |
| `ui/lightbox/ImageLightbox.svelte`                     | zoom/pan/pinch                                                            |
| `ui/pagination/PaginationBar.svelte` + `pagination.ts` | пагинация                                                                 |
| `overlay/BaseModal.svelte`, `ConfirmModal.svelte`      | обёртки dialog                                                            |

### 6.4. UI-библиотека

159 shadcn-svelte/bits-ui компонентов в `src/lib/components/ui/`:
`accordion, avatar, badge, breadcrumb, button, card, dialog, drawer, dropdown-menu, empty,
input, item, kbd, label, lightbox, pagination, popover, progress, select, separator, sheet,
skeleton, slider, switch, table, tabs, textarea, tooltip, audio/player, audio/provider,
brand-icons (Telegram/Discord/Boosty/Ton)`.
Импорт — из barrel `index.ts`. Часть (`kbd`, `popover`) в приложении не используется.

## 7. База данных

### 7.1. Доменные таблицы (`src/lib/server/db/schema.ts`)

| Таблица                  | Колонки (ключевые)                                                                                                                                                                                         | Ключи/индексы                                             | Связи                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------- |
| `books`                  | `id` varchar128 PK, `title` 255 NN, `description` text, `cover_url` 1024, `blurhash` 100, `theme_color` 6, `video_url` 2048, `sort_order` int NN def 0, `status` 50 def 'ongoing', `created_at/updated_at` | PK id                                                     | 1→N volumes                         |
| `volumes`                | `id` PK, `book_id` NN FK, `volume_number` int NN, `title` 255 NN, `description`, `cover_url` 1024, `blurhash` 100, `status` 50 def 'ongoing', timestamps                                                   | PK; FK cascade                                            | →book, 1→N chapters/illustrations   |
| `chapters`               | `id` PK, `volume_id` NN FK, `chapter_number` int NN, `title` 255 NN, `audio_url` 2048 NN, `duration_seconds` double precision NN, `telegram_post_url` 1024, timestamps                                     | PK; FK cascade                                            | →volume; 1→N chapter_audio_versions |
| `audio_versions`         | `id` 64 PK, `label` 120 NN, `description` text, `sort_order` int NN def 0, `created_at`                                                                                                                    | PK                                                        | 1→N chapter_audio_versions          |
| `chapter_audio_versions` | `id` 200 PK, `chapter_id` 128 NN FK, `version_id` 64 NN FK, `title` 255 NN, `audio_url` 2048 NN, `duration_seconds` double precision NN, `chapter_start/end` int NN, timestamps                            | PK; unique(chapter,version); indexes                      | →chapter, →audio_version            |
| `illustrations`          | `id` PK, `volume_id` NN FK, `image_url` 1024 NN, `blurhash` 100, `caption` 255, `sort_order` int NN def 0, timestamps                                                                                      | PK; FK cascade                                            | →volume                             |
| `listening_progress`     | `user_id` text NN FK, `chapter_id` varchar128 NN FK, `progress_seconds` int NN def 0, `is_completed` bool def false, `updated_at`                                                                          | PK(user,chapter); FK cascade                              | user/chapter                        |
| `volume_likes`           | `user_id` NN FK, `volume_id` NN FK, `created_at`                                                                                                                                                           | PK(user,volume); FK cascade                               | user/volume                         |
| `chapter_likes`          | `user_id` NN FK, `chapter_id` NN FK, `created_at`                                                                                                                                                          | PK(user,chapter); FK cascade                              | user/chapter                        |
| `bookmarks`              | `id` varchar36 PK, `user_id` NN FK, `chapter_id` NN FK, `timestamp_seconds` int NN, `end_timestamp_seconds` int, `note` 500, `created_at`                                                                  | PK; FK cascade                                            | user/chapter                        |
| `listening_sessions`     | `id` varchar36 PK (UUID default), `user_id` FK nullable, `book_id` FK nullable, `volume_id` FK nullable, `chapter_id` NN FK, `listened_seconds` int NN, `started_at` NN def now, `created_at` NN def now   | indexes: user, chapter, started_at; FK cascade            | user/book/volume/chapter            |
| `daily_listening_stats`  | `id` varchar128 PK, `date` varchar10 NN, `user_id` FK nullable, `book_id` FK nullable, `chapter_id` FK nullable, `total_seconds` int NN def 0, `sessions_count` int NN def 1, `updated_at` NN              | indexes: date, book, user; unique(date,book,chapter,user) | user/book/chapter                   |

**Отсутствуют индексы на** `volumes.book_id`, `chapters.volume_id`,
`illustrations.volume_id`, `bookmarks.user_id`, likes/progress — кроме тех, что
создают миграции для auth. Нет unique на `(book_id, volume_number)` и
`(volume_id, chapter_number)`.

### 7.2. Auth-таблицы (`src/lib/server/db/auth.schema.ts`)

| Таблица        | Колонки                                                                                                                                                                                                         | Индексы                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `user`         | `id` text PK, `name` NN, `email` NN unique, `email_verified` NN def false, `image`, timestamps NN, `telegram_avatar`, `telegram_oidc_username`, `discord_avatar`, `discord_username`, `role` text NN def 'user' | PK, unique email            |
| `session`      | `id` PK, `expires_at` NN, `token` NN unique, timestamps NN, `ip_address`, `user_agent`, `user_id` NN FK cascade                                                                                                 | unique token, index user_id |
| `account`      | `id` PK, `account_id` NN, `provider_id` NN, `user_id` NN FK cascade, tokens/expiry/scope/password, timestamps NN                                                                                                | index user_id               |
| `verification` | `id` PK, `identifier` NN, `value` NN, `expires_at` NN, timestamps NN                                                                                                                                            | index identifier            |

### 7.3. Состояние миграций и реальной БД

- `drizzle/`: `0000`…`0006` + snapshots/journal.
  - `0000`–`0004` — исходная схема и провайдерские поля;
  - `0005` — **намеренный no-op** (legacy-колонки уже удалены в `0004`);
  - `0006` — catch-up: `user.role`, `volumes.status`, `listening_sessions`,
    `daily_listening_stats`, длины varchar 1024.
- Текущая dev-БД **пересобрана через `db:migrate`**: `drizzle.__drizzle_migrations`
  содержит 7 записей; затем выполнен `db:seed`; пользовательские данные
  восстановлены из бэкапа.
- Схема БД и `schema.ts` совпадают (diff пуст); `drizzle-kit generate` отвечает
  `No schema changes, nothing to migrate`.
- Лишняя `bookmarks.end_timestamp_seconds` (из незамёрженной ветки
  `agent/bookmark-end-time`) удалена при пересборке; в `schema.ts` её нет.
- `seed.ts` на чистой миграционной БД проходит: 2 книги / 4 тома / 10 глав / 4 иллюстрации.

## 8. Конфигурация и окружение

### 8.1. Переменные окружения

| Переменная                                                             | Обязательна                   | Где используется                         | Комментарий                                                      |
| ---------------------------------------------------------------------- | ----------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`                                                         | да (иначе fallback localhost) | `db/index.ts`, `drizzle.config.ts`, seed | fallback `postgres://root:mysecretpassword@localhost:5432/local` |
| `BETTER_AUTH_SECRET`                                                   | **да**                        | `auth.ts`                                | без него better-auth падает на старте                            |
| `BETTER_AUTH_ALLOWED_HOSTS`                                            | рекомендуется                 | `auth.ts`                                | список через запятую → `baseURL.allowedHosts`                    |
| `BETTER_AUTH_FALLBACK_URL`                                             | опц.                          | `auth.ts`                                | fallback origin                                                  |
| `BETTER_AUTH_URL`                                                      | опц.                          | better-auth (env)                        | в compose.test задаётся; в коде не читается                      |
| `TELEGRAM_BOT_TOKEN`                                                   | для TG                        | `auth.ts`                                | warning при пустом                                               |
| `TELEGRAM_OIDC_CLIENT_ID/SECRET`                                       | для TG                        | `auth.ts`                                | warning при пустых                                               |
| `DISCORD_CLIENT_ID/SECRET`                                             | для Discord                   | `auth.ts`                                | warning, если не заданы                                          |
| `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME/PUBLIC_URL` | для R2                        | `storage/r2.ts`                          | без них local fallback                                           |
| `PUBLIC_UMAMI_WEBSITE_ID`                                              | нет                           | layout, admin analytics                  | включает Umami                                                   |
| `PUBLIC_UMAMI_HOST`                                                    | нет                           | layout                                   | default `https://cloud.umami.is`                                 |
| `UMAMI_HOST`, `UMAMI_APP_SECRET`                                       | compose                       | compose                                  | Umami-контейнер                                                  |
| `POSTGRES_USER/PASSWORD/DB`                                            | compose                       | compose                                  | БД                                                               |
| `ACME_EMAIL`                                                           | prod                          | compose.prod                             | Let's Encrypt                                                    |
| `ORIGIN`                                                               | prod/CSRF                     | SvelteKit adapter                        | не задавать при multi-domain; origin из forwarded headers        |
| `APP_HOST` / `APP_HOST_RU`                                             | production                    | compose.prod                             | оба публичных домена                                             |
| `BETTER_AUTH_COOKIE_DOMAIN`                                            | production                    | auth/compose.prod                        | `.hedgehog-inc.one`, общая сессия                                |
| `PROTOCOL_HEADER` / `HOST_HEADER`                                      | production                    | adapter-node                             | `x-forwarded-proto` / `x-forwarded-host`                         |
| `COMPOSE_FILE`                                                         | dev                           | Docker                                   | `compose.yaml:compose.dev.yml`                                   |
| `PORT`, `HOST`, `NODE_ENV`                                             | runtime                       | adapter/playwright                       | 4192 в тестах                                                    |
| `LOG_LEVEL`                                                            | нет                           | logger (localStorage)                    | не env, но уровень                                               |

`.env.example` содержит все ключи; локальный `.env` (в main checkout) содержит
перечисленные ключи, значения не коммитятся. `.env` в `.gitignore`.

### 8.2. Скрипты `package.json`

| Скрипт                            | Команда                                       | Статус/нюанс                        |
| --------------------------------- | --------------------------------------------- | ----------------------------------- |
| `dev`                             | `vite dev`                                    | нужен .env/секрет                   |
| `build`                           | `vite build`                                  | проходит                            |
| `preview`                         | `vite preview`                                | используется e2e                    |
| `prepare`                         | `svelte-kit sync`                             | —                                   |
| `check`                           | sync + svelte-check                           | проходит                            |
| `lint`                            | prettier check + eslint                       | проходит                            |
| `format`                          | prettier write                                | —                                   |
| `test:e2e`                        | `playwright install && playwright test`       | сеть; env обязателен                |
| `test:docker`                     | compose test up/down                          | db:migrate+seed+build+e2e           |
| `test`                            | `npm run test:e2e`                            | npm внутри pnpm-проекта             |
| `test:unit`                       | `node --import tsx --test "src/**/*.test.ts"` | 197 pass                            |
| `dev:all`                         | compose up -d + pnpm dev                      | —                                   |
| `docker:up/down/logs`             | compose                                       | —                                   |
| `db:push`                         | drizzle-kit push                              | dev-shortcut, может удалять колонки |
| `db:generate/migrate/seed/studio` | drizzle/seed                                  | рабочий путь (0000–0013)            |
| `auth:schema`                     | better-auth generate                          | может перезаписать ручные поля      |

### 8.3. Конфиги

| Файл                              | Роль                                                                                                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`                  | Tailwind, SvelteKit (adapter-node, runes, serviceWorker register false, paths relative false, TS config include drizzle), PWA injectManifest + manifest, allowedHosts, ssr.noExternal bits-ui, define NODE_ENV |
| `tsconfig.json`                   | extends `.svelte-kit/tsconfig.json`; strict; moduleResolution bundler                                                                                                                                          |
| `drizzle.config.ts`               | postgresql, strict, schema                                                                                                                                                                                     |
| `eslint.config.js`                | js+ts+svelte+prettier; ignores .gitignore                                                                                                                                                                      |
| `prettier.config.js`              | tabs, single quotes, no trailing comma, width 100, svelte+tailwind plugins                                                                                                                                     |
| `playwright.config.ts`            | webServer preview :4192; testMatch `**/*.e2e.{ts,js}`; chromium                                                                                                                                                |
| `components.json`                 | shadcn style vega, aliases                                                                                                                                                                                     |
| `pnpm-workspace.yaml`             | allowBuilds: prisma, oxide, better-sqlite3, esbuild, sharp                                                                                                                                                     |
| `.npmrc`                          | engine-strict=true (но `engines` нет)                                                                                                                                                                          |
| `compose*.yml`, `Dockerfile.test` | инфраструктура (см. OPERATIONS)                                                                                                                                                                                |
| `dynamic/dev.yaml`                | Traefik routers `hedgehog-inc.localhost` → :5192, preview → :5174                                                                                                                                              |

## 9. Статика

| Путь                                              | Что                                         |
| ------------------------------------------------- | ------------------------------------------- |
| `static/audio/sample.mp3`                         | единственный аудиофайл для всех 10 сид-глав |
| `static/audio/volume-complete.mp3`                | джингл завершения тома                      |
| `static/img/mushoku_tensei.webp`, `overlord.webp` | обложки/иллюстрации сида                    |
| `static/logo.webp`, `logo-full.webp`              | логотипы                                    |
| `static/video/*.webm`                             | legacy-файлы; рабочие видеофонды — в R2/БД  |
| `static/qr/bank-qr.svg`, `ton-qr.svg`             | QR для поддержки                            |
| `static/pwa-*.png`, `maskable-icon-512x512.png`   | PWA-иконки                                  |
| `static/screenshot-*.webp`                        | PWA screenshots                             |
| `static/favicon.ico`                              | favicon (но layout подставляет Svelte SVG)  |
| `src/lib/assets/favicon.svg`                      | дефолтный Svelte-логотип (!)                |
| `static/robots.txt`                               | allow all                                   |

## 10. Тесты

### 10.1. Unit (`node:test` + tsx)

`src/lib/logger.test.ts`, `delete-confirm.test.ts`, `volume-audio.test.ts`,
`constants/strings.test.ts`, `client/auth-storage.test.ts`, `client/services/likeService.test.ts`,
`client/services/listeningTracker.test.ts`, `components/seo/og.test.ts`,
`components/share/share.test.ts`, `components/ui/pagination/pagination.test.ts`,
`server/db/seed.test.ts`, `server/storage/r2.test.ts`, `utils/mirror.test.ts`,
`routes/settings/settings.test.ts`, `routes/api/books/books.test.ts`,
`routes/api/analytics/analytics.test.ts`, `client/services/syncPolicy.test.ts`.

Особенности:

- `r2.test.ts` **пишет файлы** в `static/uploads/test*` (или в R2 при наличии env) и удаляет их.
- `books.test.ts` тестирует **копию** ETag-логики, а не эндпоинт.
- `listeningTracker.test.ts` импортирует Dexie напрямую и глотает ошибки отсутствия IndexedDB.
- P0-01/P0-05 покрыты `syncPolicy.test.ts`, `e2e/sync-data-safety.e2e.ts` (9) и
  `e2e/session-isolation.e2e.ts` (5).
- P0-03 покрыт `e2e/bookmark-sync.e2e.ts` (offline → online flush) и проверен реальной БД.
- Нет тестов на `downloadManager`, `audioStore`, `audio-provider`, admin actions,
  `/api/user/delete` (кроме интеграционного e2e).

### 10.2. E2E

| Файл                                    | Что проверяет                                      | Моки                                                                                |
| --------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `e2e/auth.e2e.ts`                       | кнопки провайдеров, редиректы, ошибки              | `/api/auth/sign-in/social`, `get-session`; внешние URL реальные                     |
| `e2e/profile.e2e.ts`                    | профиль, accounts, unlink, delete 4 шага           | `get-session`, `list-accounts`, `link-social`, `unlink-account`, `/api/user/delete` |
| `e2e/navigation-and-content.e2e.ts`     | community/support/admin redirect                   | без моков (community/support статические)                                           |
| `e2e/delete-account.integration.e2e.ts` | реальный `POST /api/user/delete` + каскады         | реальная Postgres; `test.skip` без `BETTER_AUTH_SECRET`                             |
| `e2e/sync-data-safety.e2e.ts`           | P0-01: 401, guest/offline, owner, switch, adoption | mock `/api/user/sync`; IndexedDB-ассерты                                            |
| `e2e/bookmark-sync.e2e.ts`              | P0-03: offline bookmark → online POST              | mock `/api/user/sync`; проверка очереди                                             |
| `e2e/session-isolation.e2e.ts`          | P0-05: logout/expiry, owner очереди                | mock auth/session; IndexedDB-ассерты                                                |

Старые тесты выставляют мёртвый ключ `hedgehog-welcome-modal-dismissed` (модалки нет).
Нет тестов каталога/плеера/закладок/истории/загрузок/настроек/админки (в истории они были).

## 11. Артефакты сборки

- `.svelte-kit/` — generated types/manifest (не коммитится).
- `build/` — adapter-node output: `build/index.js`, `build/client`, `build/server`.
- `build/client/service-worker.js` — собранный SW.
- Preview/run: `node server.js` (compression + cache headers) с `PORT`, `ORIGIN`, env.
- PWA manifest генерируется vite-plugin-pwa.

## 12. Внешние сервисы

| Сервис          | Использование            | Конфиг                                |
| --------------- | ------------------------ | ------------------------------------- |
| Telegram OIDC   | вход                     | `TELEGRAM_OIDC_*`, BotFather redirect |
| Discord OAuth2  | вход                     | `DISCORD_*`                           |
| Telegram widget | комментарии на страницах | `telegramPostUrl`                     |
| Cloudflare R2   | хранение медиа           | `R2_*`                                |
| Umami           | внешняя аналитика        | `PUBLIC_UMAMI_*`                      |
| Postgres        | БД                       | `DATABASE_URL`                        |
| Traefik         | HTTPS/reverse proxy      | compose/dynamic                       |
| mkcert          | локальные сертификаты    | `certs/` (gitignored)                 |

## 13. «Где что менять» — быстрый указатель

| Хочу                   | Иди в                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Поправить текст UI     | `constants/strings.ts` + конкретная страница                                             |
| Добавить поле книги    | `db/schema.ts` + миграция + admin/content + mappers/OfflineBook + API                    |
| Добавить эндпоинт      | `src/routes/api/.../+server.ts` + типы + тест                                            |
| Изменить синхронизацию | `syncService.ts`, `hydrate.ts`, `+layout.ts`, `/api/user/sync`                           |
| Изменить плеер         | `audio-store.svelte.ts`, `html-audio.ts`, `audio-provider.svelte`, `GlobalPlayer.svelte` |
| Изменить офлайн-аудио  | `downloadManager.svelte.ts`, `html-audio.ts`, `service-worker.ts`                        |
| Добавить страницу      | `src/routes/<path>/+page.svelte` (+ `.ts` load при необходимости)                        |
| Добавить админ-CRUD    | `src/routes/admin/<entity>/+page.server.ts` + `+page.svelte`                             |
| Изменить auth          | `src/lib/server/auth.ts`, `src/lib/client/*`, `/auth`, `/profile`                        |
| Изменить деплой        | `compose*.yml`, `dynamic/`, `Dockerfile*`, `docs/OPERATIONS.md`                          |
| Добавить миграцию      | изменить `schema.ts` → `pnpm db:generate` → проверить SQL/snapshot → `pnpm db:migrate`   |

## 14. Известные «неочевидные» связи

- `books/[bookId]/+layout.ts` выполняется **и на сервере, и на клиенте**; sync только
  под `if (browser)`.
- `hooks.server.ts` дергает `ensureDefaultBooks` на импорте (fire-and-forget) и на
  любом `/api/books*`; `ensureDefaultBooks` мемоизирует промис.
- `syncBookDetails` полагается на HTTP-кэш браузера для `304`; явный `If-None-Match`
  не отправляет.
- `AudioProvider` — единственное место, где `<audio>`-события превращаются в состояние
  store; `htmlAudio` сам событий UI не эмитит (кроме bufferUpdate).
- `GlobalPlayer` рендерится только при `queue.length > 0`; очередь создаётся при
  нажатии play на главе.
- `audioStore` сохраняет в localStorage **весь queue** (может быть большим).
- `/history` и `/bookmarks` проигрывают через `setQueueAndPlay` + `seek` с таймером.
- Админские страницы используют SSR-данные напрямую, не Dexie; поэтому их контент
  доступен без JS (но требует admin-сессии).
- `/api/books/[bookId]` включает все главы и иллюстрации; клиент мапит и гидрирует
  все таблицы.
