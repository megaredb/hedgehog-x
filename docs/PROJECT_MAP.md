# PROJECT_MAP.md — карта репозитория

Документ перечисляет **фактические** файлы, маршруты, контракты, таблицы и модули.
Составлен по коду; числа сняты командами на HEAD `ff3f769`.

## 1. Масштаб

| Метрика                      |                       Значение | Проверка                                                         |
| ---------------------------- | -----------------------------: | ---------------------------------------------------------------- |
| Файлов в `src/`              |                            433 | `find src -type f`                                               |
| `.svelte`                    |                            234 | `find src -name '*.svelte'`                                      |
| `.ts`                        |                            196 | `find src -name '*.ts'`                                          |
| Строк `src/**/*.{ts,svelte}` |                         50 685 | `wc -l` по файлам                                                |
| Страниц (`+page.svelte`)     |                             24 | `find src/routes -name '+page.svelte'`                           |
| Файлов `+server.ts`          |                             25 | `find src/routes -name '+server.ts'`                             |
| HTTP-обработчиков            |                             29 | GET/POST в нескольких файлах                                     |
| Load-модулей                 |                             23 | `+page.server.ts`, `+layout.server.ts`, `+page.ts`, `+layout.ts` |
| Таблиц БД                    |      34 (30 доменных + 4 auth) | `grep -c 'pgTable('`                                             |
| Миграций                     |               36 (`0000–0035`) | `ls drizzle/*.sql`                                               |
| Dexie stores                 |                        13 (v6) | `src/lib/client/db/index.ts`                                     |
| Действий очереди             |                              8 | `SyncItem.action`                                                |
| Unit-файлов                  |                             38 | `find src -name '*.test.ts'`                                     |
| Unit-тестов                  |                            275 | `grep -rhoE '\b(test\|it)\(' src --include='*.test.ts'`          |
| E2E-файлов                   |                              9 | `ls e2e/*.e2e.ts`                                                |
| E2E-тестов                   |   45 (+1 условный `test.skip`) | `grep -rhoE '\btest\(' e2e/*.e2e.ts`                             |
| UI-каталогов                 |                             28 | `find src/lib/components/ui -maxdepth 1 -type d`                 |
| UI-`.svelte`                 | 157 (186 файлов, 27 barrel'ов) | `find src/lib/components/ui -name '*.svelte'`                    |
| Скриптов `package.json`      |                             25 | `Object.keys(scripts).length`                                    |
| Переменных в `.env.example`  |                             37 | `grep -cE '^[A-Z][A-Z0-9_]+=' .env.example`                      |
| Файлов в `static/`           |                             19 | `find static -type f`                                            |

## 2. Верхний уровень

| Путь                                                                         | Назначение                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`                                                                       | SvelteKit-приложение                                                                                                                                       |
| `drizzle/`                                                                   | 36 миграций `0000–0035` + `meta/` (36 snapshot'ов, `_journal.json`)                                                                                        |
| `e2e/`                                                                       | Playwright: 9 файлов                                                                                                                                       |
| `scripts/`                                                                   | 9 файлов: migrate, entrypoint, grant-admin, auth-schema, normalize-storage, setup-local-tls, backfill-donation-ledger, load-test-broadcast, serveo-webhook |
| `dynamic/`                                                                   | Traefik file-provider dev                                                                                                                                  |
| `docker/`                                                                    | `init-umami-db.sh`                                                                                                                                         |
| `static/`                                                                    | Аудио, изображения, видео, QR, PWA-иконки, `robots.txt`                                                                                                    |
| `server.js`                                                                  | Production HTTP: gzip, cache-заголовки, graceful shutdown                                                                                                  |
| `Dockerfile` / `Dockerfile.test`                                             | Production / Playwright-образ                                                                                                                              |
| `compose.yaml`, `compose.dev.yml`, `compose.prod.yml`, `compose.test.yml`    | Инфраструктура                                                                                                                                             |
| `vite.config.ts`                                                             | Единственный конфиг SvelteKit, Tailwind, PWA (отдельного `svelte.config.js` нет)                                                                           |
| `drizzle.config.ts`                                                          | Drizzle Kit (требует `DATABASE_URL`)                                                                                                                       |
| `playwright.config.ts`                                                       | Preview `4173`, chromium                                                                                                                                   |
| `eslint.config.js`, `prettier.config.js`, `tsconfig.json`, `components.json` | Качество кода и shadcn-алиасы                                                                                                                              |
| `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc`                                    | Node 26, pnpm 11.7.0                                                                                                                                       |

## 3. Страницы (24)

| URL                          | Файлы                                                                    | SSR             | Данные                                                                                                | Возможности                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------ | --------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/`                          | `+page.svelte`, `+page.server.ts`                                        | да, БД          | `books`                                                                                               | Витрина, `?book=`, видео-фон opt-in                                                                    |
| `/books`                     | `+page.svelte`, `+page.server.ts`                                        | да, БД          | книги + counts                                                                                        | Каталог, клиентский фильтр; считаются только опубликованные главы                                      |
| `/books/[bookId]`            | `+page.svelte`, `+page.server.ts`, `+layout.ts`                          | да, БД + Dexie  | книга/тома                                                                                            | Сетка/список, 12 томов, OG, фоновый sync; 404                                                          |
| `/books/[bookId]/[volumeId]` | `+page.svelte`, `+page.server.ts`, `+page.ts`                            | да, БД + Dexie  | книга, тома, опубликованные главы, иллюстрации и тайминги, версии, лайки, серверный прогресс, support | Табы главы/закладки/иллюстрации/обсуждение, версия, `?chapter=&version=&tab=`, плеер, completion modal |
| `/bookmarks`                 | `+page.svelte`                                                           | каркас          | Dexie + broadcast-метаданные                                                                          | Пагинация, play, edit, delete                                                                          |
| `/history`                   | `+page.svelte`                                                           | каркас          | Dexie `progress` (главы и broadcast replay)                                                           | Пагинация, play, очистка                                                                               |
| `/downloads`                 | `+page.svelte`                                                           | каркас          | Dexie `downloads`, `chapters`, `volumes`, `broadcastChats`                                            | Очередь, сохранённые тома, удаление с предупреждением о чатах                                          |
| `/settings`                  | `+page.svelte`, `settings-helpers.ts`                                    | каркас          | localStorage, Dexie, manager                                                                          | Seek step, rate, auto-advance, wake lock, зеркала из БД, кэш/OPFS, sync                                |
| `/profile`                   | `+page.svelte`, `+page.server.ts`                                        | да, БД + каркас | subscription, session, accounts                                                                       | Карточка подписки, link/unlink, удаление                                                               |
| `/subscription`              | `+page.svelte`, `+page.server.ts`                                        | да, БД          | subscriptions, sources, events, price notices/settings, donations                                     | Статус, Boosty, донаты, история, цена, уведомления, `?/check`, `?/dismissNotice`; гость видит CTA      |
| `/auth`                      | `+page.svelte`                                                           | каркас          | better-auth                                                                                           | Telegram/Discord, ошибки, safe `from`                                                                  |
| `/community`                 | `+page.svelte`, `+page.server.ts`                                        | да, БД          | `site_pages.data`                                                                                     | Соцсети и преимущества из админки                                                                      |
| `/support`                   | `+page.svelte`, `+page.server.ts`                                        | да, БД          | `site_pages.data`                                                                                     | Boosty, карты, крипто-кошельки (GRAM/XAUT и др.), Telegram Wallet, QR                                  |
| `/about`                     | `+page.svelte`, `+page.server.ts`                                        | да, БД          | `site_pages.data`, `translators`                                                                      | Автор, разработчики, переводчики, аватары                                                              |
| `/broadcasts`                | `+page.svelte`, `+page.server.ts`                                        | да, БД          | live/published broadcasts                                                                             | Список эфиров и записей                                                                                |
| `/broadcasts/[id]`           | `+page.svelte`, `+page.server.ts`                                        | да, БД + client | broadcast, messages, images, listeners, progress                                                      | Live/scheduled countdown/replay, чат, реакции, иллюстрации, донат, OG                                  |
| `/admin`                     | `+layout.server.ts`, `+layout.svelte`, `+page.server.ts`, `+page.svelte` | да, БД          | counts, recent, active subscribers                                                                    | Dev self-promote                                                                                       |
| `/admin/analytics`           | `+page.server.ts`, `+page.svelte`                                        | да, БД          | listening + revenue                                                                                   | 30 дней, top-5, сессии, донаты, Umami                                                                  |
| `/admin/content`             | `+page.server.ts`, `+page.svelte`                                        | да, БД          | книги, тома, главы, версии, иллюстрации, тайминги                                                     | 13 actions, published, R2 picker, media lightbox                                                       |
| `/admin/broadcasts`          | `+page.server.ts`, `+page.svelte`                                        | да, БД          | broadcasts, chapters, viewers                                                                         | Создание, старт/конец/публикация, удаление, статистика                                                 |
| `/admin/site`                | `+page.server.ts`, `+page.svelte`                                        | да, БД          | site_pages, translators, site_settings, user                                                          | Тексты страниц, поддержка, соцсети, переводчики, медиа-прокси, зеркала, feedback URL                   |
| `/admin/users`               | `+page.server.ts`, `+page.svelte`                                        | да, БД          | user, account, subscriptions, events, donations, price                                                | Роли, подписки, цена дня, донаты, аудит                                                                |
| `/admin/users/integrations`  | `+page.server.ts`, `+page.svelte`                                        | да, БД          | Telegram/Discord API                                                                                  | Статус, webhook, роли                                                                                  |
| `/admin/[legacy]`            | `+page.server.ts`, `+page.svelte`                                        | 303             | —                                                                                                     | Редирект на `/admin/content`                                                                           |

Особые маршруты:

- `/feedback` — `+server.ts`, 302 на `safeFeedbackTarget(about.data.feedbackUrl)` (http/https/tg).
- `/health` — `select 1`.
- `/sitemap.xml` — книги/тома.
- `/api/auth/*` — без файлов, через `svelteKitHandler`.

### 3.1. Load-модули (23)

`+layout.server.ts`, `+page.server.ts`; `about`, `books`, `books/[bookId]`,
`books/[bookId]/[volumeId]`, `community`, `profile`, `subscription`, `support`,
`broadcasts`, `broadcasts/[id]`; `admin` layout/page, `admin/analytics`,
`admin/broadcasts`, `admin/content`, `admin/site`, `admin/users`,
`admin/users/integrations`, `admin/[legacy]`; `books/[bookId]/+layout.ts`,
`books/[bookId]/[volumeId]/+page.ts`.

## 4. API (25 файлов, 29 обработчиков)

### 4.1. Контент, пользователь, служебное

| Метод и путь                    | Auth             | Ограничения                                                             | Ответ                                                                                                    |
| ------------------------------- | ---------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /api/books`                | нет              | —                                                                       | Все книги, `created_at DESC`, без кэша                                                                   |
| `GET /api/books/[bookId]`       | нет              | —                                                                       | Дерево книги; только `chapters.published=true`; ETag SHA1; 304/404; `public, max-age=0, must-revalidate` |
| `GET /api/user/sync`            | обязательна      | —                                                                       | Личные лайки/прогресс/закладки; `isNewUser`; `private, no-store`                                         |
| `POST /api/user/sync`           | обязательна      | body ≤1 МиБ; 4 массива ≤100; 120/мин; транзакция                        | counts, `skipped/rejected/errors`; 400/413/429/500                                                       |
| `POST /api/user/delete`         | обязательна      | `Origin`/`Sec-Fetch-Site`                                               | Удаляет user, сессии, обнуляет ссылки админа; аналитика и донаты обезличиваются; cookie чистятся         |
| `GET /api/user/delete`          | —                | —                                                                       | 405                                                                                                      |
| `POST /api/user/progress/clear` | обязательна      | —                                                                       | Удаляет `listening_progress`; `private, no-store`                                                        |
| `POST /api/analytics/listen`    | гость допустим   | batch ≤100; 60/мин; 1..300 с; окно `startedAt`                          | Частичный приём, `accepted/rejected`                                                                     |
| `GET /api/media/[...key]`       | нет              | safe-key (без traversal/control), MIME; Range; 10 МиБ/файл, 100 МиБ кэш | 200/206/302/416; direct/signed R2 fallback                                                               |
| `GET /api/metrics`              | admin или Bearer | `timingSafeEqual`                                                       | Prometheus                                                                                               |
| `GET /health`                   | нет              | `select 1`                                                              | 200/503                                                                                                  |
| `GET /sitemap.xml`              | нет              | —                                                                       | XML, 1 час                                                                                               |
| `GET /feedback`                 | нет              | —                                                                       | 302                                                                                                      |

### 4.2. Трансляции

| Метод и путь                             | Auth          | Ограничения                                    | Ответ                                                      |
| ---------------------------------------- | ------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| `GET /api/broadcasts/active`             | нет           | —                                              | Текущая/ближайшая трансляция, listeners, serverNow         |
| `GET /api/broadcasts/[id]/state`         | user + доступ | —                                              | Состояние, сообщения, изображения, listeners, participants |
| `GET /api/broadcasts/[id]/status`        | нет           | —                                              | `{exists:true}`/404; для очистки плеера                    |
| `GET/POST /api/broadcasts/[id]/progress` | user + доступ | позиция clamp                                  | Replay/live прогресс                                       |
| `POST /api/broadcasts/[id]/heartbeat`    | user + доступ | только live                                    | Presence, listeners                                        |
| `POST /api/broadcasts/[id]/leave`        | user          | —                                              | Отметка выхода                                             |
| `POST /api/broadcasts/[id]/view`         | user + доступ | live/replay                                    | Просмотр                                                   |
| `POST /api/broadcasts/[id]/messages`     | user + доступ | 500 симв.; 5/10 с; allowlist ссылок; reply/tag | Сообщение                                                  |
| `GET /api/broadcasts/[id]/messages`      | user + доступ | page 30, `before`                              | История                                                    |
| `POST /api/broadcasts/[id]/reactions`    | user + доступ | 👍/❤️/🔥/😂; только live; не своё              | Toggle + counts                                            |

Доступ: `isAdminRole(role)` (admin/author) или активная подписка. Чат —
live/replay с `chatEnabled`, а для scheduled открывается за 1 час до старта.

### 4.3. Админ/интеграции

| Метод и путь                           | Auth                                 | Назначение                                                                  |
| -------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| `GET /api/admin/integrations`          | `requireFullAdmin`                   | Статус Telegram/Discord, кэш 10 с                                           |
| `GET /api/admin/r2/files`              | `requireAdmin`                       | Библиотека R2: type=image/audio/video, cursor                               |
| `POST /api/admin/r2/files`             | `requireAdmin`                       | Загрузка в R2 с лимитами 15/500/100 МиБ                                     |
| `POST /api/telegram/webhook`           | secret header                        | chat_member; 64 КиБ; дедуп 24 ч                                             |
| `POST /api/link-preview`               | user + admin/подписка                | OG-превью; 20/мин; allowlist хостов, проверка DNS/IP, ≤3 редиректа, 512 КиБ |
| `GET /api/chapters/[id]/illustrations` | нет (admin видит и неопубликованные) | Тайминги иллюстраций главы                                                  |

## 5. Серверные модули

| Файл                                | Ответственность                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `src/hooks.server.ts`               | seed; auth → locals; блокировка аккаунта; rate limit admin/API; CSP/security; метрики |
| `src/lib/server/auth.ts`            | better-auth: Telegram OIDC + Discord, linking, subscription hooks, IPv4/retry, secret |
| `src/lib/server/admin.ts`           | `isAdminRole` (admin/author), `requireAdmin`, `requireFullAdmin`                      |
| `db/index.ts`                       | postgres-js + Drizzle, shutdown                                                       |
| `db/schema.ts`                      | 30 доменных таблиц + relations                                                        |
| `db/auth.schema.ts`                 | 4 auth-таблицы; роль, `includeInStats`                                                |
| `db/seed.ts`                        | 2 книги/4 тома/10 глав/4 иллюстрации; `published:true`                                |
| `db/errors.ts`                      | `isUniqueViolation` (23505)                                                           |
| `broadcasts.ts`                     | Состояние live/replay, доступ, слушатели, чат, реакции, иллюстрации, прогресс, кэши   |
| `subscriptions/config.ts`           | Цена, Telegram/Discord/Boosty-конфиг                                                  |
| `subscriptions/domain` (client lib) | Дни/цена, стекинг, lifetime, block/revoke, summary                                    |
| `subscriptions/entitlement.ts`      | Grant/revoke/restore/block, source state, события, summary                            |
| `subscriptions/pricing.ts`          | Цена, пересчёт остатка, уведомления                                                   |
| `subscriptions/reports.ts`          | Донаты, доход, активные подписчики                                                    |
| `subscriptions/sources.ts`          | Проверка Telegram-группы/Discord-роли, webhook                                        |
| `subscriptions/ledger.ts`           | `donorKey`, idempotency                                                               |
| `site-content.ts`                   | Страницы about/support/community, переводчики, sanitize, defaults                     |
| `site-settings.ts`                  | `site_settings` media/mirrors, direct URL                                             |
| `integrations/status.ts`            | Статус Telegram/Discord                                                               |
| `telegram/api.ts`, `discord/api.ts` | Bot API клиенты                                                                       |
| `og-preview.ts`                     | SSRF-safe OG-парсер                                                                   |
| `feedback.ts`                       | safe redirect                                                                         |
| `storage/r2.ts`                     | R2, sharp/WebP/blurhash, media library, delete                                        |
| `metrics.ts`                        | Prometheus-счётчики                                                                   |
| `analytics/stats.ts`                | Даты, ID, валидация                                                                   |
| `logger.ts`                         | `createLogger`                                                                        |

## 6. Клиентские модули

### 6.1. Данные/синхронизация

`client/db/index.ts` (Dexie v6, 13 stores), `hydrate.ts`, `syncState.ts`,
`useLiveQuery.svelte.ts`; `services/{syncService,syncPolicy,mappers,likeService,
bookmarkService,bookmarkSync,progressSync,listeningTracker,broadcastProgressSync,
guestAdoption}`.

### 6.2. Трансляции

- `client/broadcast-player.ts` — проверка удаления, resume replay.
- `client/broadcast-chat.ts` — сохранение/чтение чата в Dexie.
- `client/services/broadcastProgressSync.ts` — батч 15 с, owner-aware, `pagehide` beacon.
- `client/page-cache.ts` — единый denylist для SW и `afterNavigate`.
- `lib/broadcasts/domain.ts` — kind, canReplay/canJoinLive, chat validation, константы.

### 6.3. Auth/аккаунты/загрузки

`session.svelte.ts`, `auth-storage.ts` (без токена), `accounts.svelte.ts`,
`authClient.ts`, `providers.ts`, `downloads/downloadManager.svelte.ts`,
`downloads/downloadUtils.ts`.

### 6.4. Плеер/медиа/утилиты

`audio-store.svelte.ts`, `html-audio.ts`, `audio-queue.ts`,
`audio-version.ts` (`opfsAudioFileName`, `broadcastProgressKey`),
`utils/mirror.ts` (конфигурируемые зеркала), `color.ts`, `telegram.ts`,
`safeRedirect.ts`, `time.ts`, `format.ts`, `pagination.ts`, `validation.ts`,
`slugify.ts`, `volume/illustration-lock.ts`, `delete-confirm.ts`,
`constants/strings.ts`, `settings/values.ts`, `actions/inview.ts`,
`client/analytics.ts`, `types/site.ts`, `types/showcase.ts`.

### 6.5. Браузерные хранилища

| Хранилище    | Содержимое                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| localStorage | auth session/accounts, `audio:ui:store`, seek/rate/auto/wake, mirror, videoBackgroundPlaying, `book-etag:*`, `LOG_LEVEL` |
| Dexie        | 13 stores (§9)                                                                                                           |
| OPFS         | аудио; безопасные имена `opfsAudioFileName`                                                                              |
| CacheStorage | pages-cache, audio-cache, precache                                                                                       |

## 7. Компоненты

- Каркас: `header/AppNavigation`, `BroadcastRail`, `ThemeSwitchButton`; `layout/AppBreadcrumbs`.
- Плеер: `audio/GlobalPlayer`, `Download`, `TimecodeInput`; `ui/audio/provider`; `ui/audio/player/*`.
- Контент: `volume/Volume*`, `comments/*`, `share/*`, `seo/*`, `showcase/*`.
- Трансляции/сайт: `broadcasts` внутри страницы; `header/BroadcastRail`.
- Общие: `common/BlurhashImage`, `ListFilterBar`, `CryptoIcon`, `SocialIcon`;
  `icons/TelegramIcon`, `DiscordIcon`.
- Поддержка: `support/{SupportBlock,CryptoWalletCard,SupportCardModal,TelegramWalletCard,TelegramWalletModal}`.
- Админка: `admin/ConfirmDeleteForm`, `admin/content/{BookDialog,ChapterDialog,
IllustrationDialog,ImageField,VideoField,VolumeCreateDialog,VolumeForm,
MediaLightbox,R2FilePicker}`, `admin/site/{BenefitIconSelect,CryptoCoinSelect,
CryptoNetworkSelect,SocialIconSelect,SocialLinksEditor}`.
- UI: 28 каталогов, 157 `.svelte`, 27 barrel'ов; новые brand-icons (Bitcoin,
  Ethereum, Github, Gram, Tether, Tron, Vk, Xaut); корневого `ui/index.ts` нет.

## 8. База данных (34 таблицы)

### 8.1. Контент и активность (13)

`books`, `volumes`, `chapters` (+ `published`), `audio_versions`,
`chapter_audio_versions`, `illustrations`, `chapter_illustrations`,
`listening_progress`, `volume_likes`, `chapter_likes`, `bookmarks`,
`listening_sessions`, `daily_listening_stats`.

Ключевые изменения:

- `chapters.published` boolean NOT NULL default false; миграция 0027 выставила true
  существующим; API/SSR отдают только опубликованные.
- `chapter_illustrations`: `id`, `chapter_id`, `illustration_id`,
  `show_at_seconds double`, `sort_order`; unique(chapter, illustration).
- `listening_sessions.user_id` и `daily_listening_stats.user_id` — FK
  `ON DELETE SET NULL` (статистика сохраняется после удаления пользователя).

### 8.2. Сайт (3)

- `site_pages`: key PK (`about/support/community`, CHECK), title, intro, content,
  data jsonb, updated_at.
- `site_settings`: key PK (`media`, `mirrors`), value jsonb, updated_at.
- `translators`: id, name, role, description, url, links jsonb, user_id FK SET NULL,
  enabled, sort_order, timestamps.

### 8.3. Трансляции (7)

| Таблица                   | Колонки                                                                                                                                                                                              | Ключи                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `broadcasts`              | id 36, chapter_id FK, title, description, cover_url, cover_blurhash, scheduled_start_at, started_at, ended_at, save_recording, publish_after_end, chat_enabled, published_at, created_by, timestamps | PK; idx chapter/start/published      |
| `broadcast_messages`      | id 36, broadcast_id FK, user_id FK SET NULL, body, reply_to_id/name/body, link_url/title/description/image, tagged_illustration_ids jsonb, created_at                                                | idx(broadcast, created_at)           |
| `broadcast_listeners`     | broadcast_id, user_id, joined_at, last_seen_at, left_at                                                                                                                                              | PK(broadcast,user); idx last_seen    |
| `broadcast_illustrations` | id, broadcast_id, illustration_id, show_at_seconds int, sort_order                                                                                                                                   | unique; **legacy/unused** после 0033 |
| `broadcast_reactions`     | message_id, user_id, emoji, created_at                                                                                                                                                               | PK(message,user,emoji)               |
| `broadcast_views`         | id, broadcast_id, user_id SET NULL, kind, started_at, last_seen_at                                                                                                                                   | idx broadcast/start, user/kind       |
| `broadcast_progress`      | user_id, broadcast_id, kind live/replay, position_seconds, is_completed, updated_at                                                                                                                  | PK(user,broadcast); idx              |

### 8.4. Подписки (7)

| Таблица                      | Назначение                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `subscriptions`              | PK user_id; manual_expires_at, is_lifetime, revoked_at/remaining, blocked_at/reason/remaining, updated_by          |
| `subscription_sources`       | PK(user,provider); provider telegram/discord, external_id, active, checked_at, last_error, metadata                |
| `subscription_events`        | Аудит: type, source, days, amount_rub, price_per_day, before/after expiry/lifetime, provider/external, admin, note |
| `donation_ledger`            | id uuid PK, donor_key, user_id SET NULL, amount_rub >0, price_per_day, source, idempotency_key UNIQUE              |
| `subscription_settings`      | id PK (singleton), price_per_day def 7, updated_by                                                                 |
| `subscription_price_changes` | old/new price, scope all/new, admin, created_at                                                                    |
| `subscription_price_notices` | user+change unique; old/new, scope, dismissed_at/reason                                                            |

### 8.5. Auth (4)

`user` (role `user|admin|author`, `include_in_stats`), `session`, `account`
(индекс provider+account), `verification`.

### 8.6. Миграции (36)

`0000–0014` — базовая часть (15 миграций): схема, провайдеры, listening/
analytics, версии озвучки, видео/порядок/главная; `0005` — no-op.

| Миграция | Содержимое                                                                                 |
| -------- | ------------------------------------------------------------------------------------------ |
| `0015`   | subscriptions, subscription_sources, subscription_events, индекс account(provider,account) |
| `0016`   | price settings/changes/notices, `subscription_events.price_per_day`                        |
| `0017`   | revoked/blocked поля                                                                       |
| `0018`   | donation_ledger                                                                            |
| `0019`   | user.include_in_stats                                                                      |
| `0020`   | analytics user_id → ON DELETE SET NULL                                                     |
| `0021`   | site_pages, translators                                                                    |
| `0022`   | site_pages.data                                                                            |
| `0023`   | translators.links                                                                          |
| `0024`   | translators.enabled                                                                        |
| `0025`   | translators.user_id                                                                        |
| `0026`   | site_settings                                                                              |
| `0027`   | chapters.published (backfill true), broadcasts/messages/listeners/illustrations/views      |
| `0028`   | broadcast_reactions                                                                        |
| `0029`   | broadcasts.cover_blurhash                                                                  |
| `0030`   | OG-превью в сообщениях                                                                     |
| `0031`   | reply_to_*                                                                                 |
| `0032`   | tagged_illustration_ids                                                                    |
| `0033`   | chapter_illustrations + backfill из broadcast_illustrations                                |
| `0034`   | broadcast_progress                                                                         |
| `0035`   | индексы listeners/views/broadcasts/chapter_illustrations                                   |

### 8.7. Seed

2 книги (`mushoku_tensei`, `overlord`), 4 тома, 10 глав (`published:true`),
4 иллюстрации; все главы — `/audio/sample.mp3`, 1123 с. Идемпотентно,
`onConflictDoNothing`; вызывается при старте и на `/api/books*`.

## 9. Dexie (13 stores, v6)

| Store                                                         | PK              | Индексы                                          |
| ------------------------------------------------------------- | --------------- | ------------------------------------------------ |
| books, volumes, chapters, chapterAudioVersions, illustrations | id              | см. код                                          |
| progress                                                      | chapterId       | broadcast progress key `broadcast-progress:<id>` |
| volumeLikes, chapterLikes, bookmarks, meta                    | соответствующие | —                                                |
| downloads                                                     | chapterId       | status                                           |
| broadcastChats                                                | broadcastId     | chapterId, savedAt (v5)                          |
| syncQueue                                                     | ++id            | action, timestamp, ownerUserId (v3)              |

Версии: v1 база; v2 meta; v3 owner; v4 версии озвучки; v5 broadcastChats;
v6 перенос broadcast progress на отдельный ключ. `SyncItem.action` — 8 действий.

## 10. Конфигурация

`vite.config.ts` (Tailwind v4, adapter-node, runes, PWA injectManifest,
register:false, allowedHosts, `ssr.noExternal:['bits-ui']`), `playwright.config.ts`
(4173), `drizzle.config.ts`, `tsconfig.json`, `eslint.config.js`,
`prettier.config.js`, `components.json`, `pnpm-workspace.yaml`, `.npmrc`
(`engine-strict`), `.nvmrc` (26), `server.js`, `dynamic/dev.yaml` (5173/5174).

## 11. Окружение

### 11.1. Читается кодом

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_ALLOWED_HOSTS`,
`BETTER_AUTH_FALLBACK_URL`, `BETTER_AUTH_COOKIE_DOMAIN`, `BETTER_AUTH_URL`
(fallback в link-preview), `DISCORD_CLIENT_ID/SECRET`, `DISCORD_BOT_TOKEN`,
`DISCORD_GUILD_ID`, `DISCORD_SUBSCRIBER_ROLE_IDS`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_OIDC_CLIENT_ID/SECRET`, `TELEGRAM_SUBSCRIPTION_CHAT_ID`,
`TELEGRAM_WEBHOOK_SECRET`, `SUBSCRIPTION_PRICE_PER_DAY_RUB`,
`R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME/PUBLIC_URL`,
`LOCAL_UPLOAD_DIR`, `NODE_ENV`, `LOG_FORMAT`, `METRICS_TOKEN`,
`MEDIA_CACHE_DIR`, `MEDIA_CACHE_MAX_BYTES`, `PORT`, `HOST`,
`SHUTDOWN_TIMEOUT`, `PUBLIC_SITE_URL`, `PUBLIC_UMAMI_HOST/WEBSITE_ID`,
`UMAMI_HOST`, `UMAMI_WEBSITE_ID`, `MIGRATIONS_FOLDER`, `SKIP_MIGRATIONS`,
`ALLOW_AUTH_SCHEMA_OVERWRITE`, `SOURCE_R2_BUCKET`, `CI`,
`TELEGRAM_API_BASE_URL`, `DISCORD_API_BASE_URL`, `WEBHOOK_LOCAL_PORT`.

### 11.2. Только compose/фреймворк

`APP_HOST`, `APP_HOST_RU`, `ORIGIN`, `BODY_SIZE_LIMIT`, `PROTOCOL_HEADER`,
`HOST_HEADER`, `ADDRESS_HEADER`, `XFF_DEPTH`, `COMPOSE_FILE`, `POSTGRES_*`,
`UMAMI_APP_SECRET`, `ACME_EMAIL`.

`.env.example` — 37 имён; `PUBLIC_SITE_URL`, `MEDIA_CACHE_MAX_BYTES`,
`UMAMI_WEBSITE_ID` читаются, но в примере отсутствуют.

## 12. Скрипты (25)

`dev`, `build`, `preview`, `prepare`, `check`, `check:watch`, `lint`,
`format`, `test:e2e`, `test:docker`, `test:docker:down`, `test`, `dev:all`,
`docker:up`, `docker:down`, `docker:logs`, `db:push`, `db:seed`,
`db:generate`, `db:migrate`, `db:studio`, `auth:schema`, `test:unit`,
`test:coverage`, `admin:grant`.

## 13. Статика

`static/`: `audio/sample.mp3`, `audio/volume-complete.mp3`, `img/*.webp`,
`video/*.webm`, `qr/*.svg`, PWA-иконки/screenshots, `favicon.ico`,
`robots.txt`. `static/uploads/` — gitignored dev-fallback. Всего 19 файлов.

## 14. Внешние сервисы

| Сервис                 | Использование                                                   |
| ---------------------- | --------------------------------------------------------------- |
| Telegram OIDC          | Вход                                                            |
| Telegram Bot API       | Подписка: getChatMember, webhook, setWebhook                    |
| Discord OAuth2/Bot API | Вход и проверка роли подписчика                                 |
| Boosty                 | Внешняя подписка; приложение не хранит токены и не вызывает API |
| Cloudflare R2          | Медиа и библиотека файлов                                       |
| Umami                  | Опциональная аналитика                                          |
| PostgreSQL 18          | БД                                                              |
| Traefik                | HTTPS/reverse proxy                                             |
| mkcert/openssl         | Локальные сертификаты                                           |

## 15. Тесты и CI

- Unit: 38 файлов, 275 тестов; см. TESTING.
- E2E: 9 файлов, 45 тестов (+1 условный skip интеграционного); preview 4173.
- CI: Postgres 18, Node 26, pnpm 11.7.0; `lint`, `check`, `test:unit`,
  `db:migrate`, `db:generate`, drift-check, `seed`, `build`, Playwright
  `--workers=1`.

## 16. Где что менять

| Задача         | Файлы                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| Текст UI       | `constants/strings.ts` + страница                                                   |
| Поле контента  | `schema.ts` → миграция → admin/content → mappers/Offline* → api/books               |
| Новый API      | `src/routes/api/.../+server.ts` + тест                                              |
| Новая страница | `+page.svelte` (+ `+page.server.ts`)                                                |
| Синхронизация  | `SyncItem.action` → сервис → flush → `/api/user/sync`                               |
| Трансляции     | `server/broadcasts.ts`, `lib/broadcasts/domain.ts`, broadcast API, admin/broadcasts |
| Подписки       | `server/subscriptions/*`, `/subscription`, admin/users                              |
| Сайт           | `server/site-content.ts`, `site-settings.ts`, admin/site                            |
| Плеер          | `audio-store`, `html-audio`, provider, GlobalPlayer                                 |
| Офлайн-аудио   | downloadManager, html-audio, service-worker                                         |
| PWA            | vite.config.ts, service-worker.ts, +layout.svelte                                   |
| Auth           | server/auth.ts, client/*, routes/auth, profile                                      |
| Админка        | routes/admin/**, components/admin/**, r2.ts                                         |
| Деплой         | Dockerfile*, compose*.yml, dynamic/, scripts/                                       |

## 17. Особенности реализации

1. Rate limit'ы in-memory: sync 120/мин, analytics 60/мин, admin/API admin 30/мин,
   чат 5/10 с, link-preview 20/мин, проверка подписки — cooldown 20 с.
2. `broadcasts` kind вычисляется лениво; live = `startedAt + duration`; replay
   только при `saveRecording && publishedAt`.
3. `broadcast_illustrations` — legacy-таблица; после 0033 код читает
   `chapter_illustrations`.
4. `buildDailyStatId` — 42 символа.
5. `syncBookDetails` гидрирует 5 таблиц через `Promise.all` — не атомарно.
6. `admin/content` и `admin/users` без пагинации; поиск limit 20/30.
7. `chapters.published` default false; seed и старт эфира публикуют главу.
8. `page-cache` denylist общий для SW и `afterNavigate`: personal/subscription/
   broadcasts/api не кэшируются.
9. `opfsAudioFileName` кодирует версии; старые имена сохраняются для default.
10. CSP с `'unsafe-inline'`; HSTS/nonce нет; CSRF-токенов нет (у delete —
    Origin/Sec-Fetch-Site).
11. R2-удаление — только в admin/content и admin/broadcasts.
12. `role=author` — доступ к контенту/админке, но не к управлению ролями/автором;
    его статистика исключается из админ-аналитики.
13. `/api/user/delete` обезличивает аналитику/донаты, удаляя сессии и ссылки
    администратора.
14. Блокировка подписки удаляет сессии и редиректит на `/auth?blocked=1`.
15. Новые загрузки хранятся как `/api/media/...`; при выключенном проксировании
    `/api/media` отдаёт 302 на direct URL, при включённом — стримит.
