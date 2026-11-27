# ARCHITECTURE.md — как устроен Hedgehog X

Документ объясняет **поведение системы** и границы слоёв. Перечень файлов и
контрактов — в [PROJECT_MAP.md](PROJECT_MAP.md); термины — в [DOMAIN.md](DOMAIN.md).

## 0. Резюме

Hedgehog X — SvelteKit-приложение (adapter-node) для аудиокниг, трансляций и
закрытого сообщества. PostgreSQL — источник истины; браузер держит контент и
личные данные в Dexie, аудио — в OPFS/CacheStorage. Главная, каталог, книга, том,
публичные страницы сайта, подписка, трансляции и админка рендерятся на сервере;
история/закладки/загрузки/настройки — клиентские. Плеер — глобальный runes-store
плюс singleton `HTMLAudioElement`; он же играет live/replay трансляции. Личные
мутации идут в `syncQueue` с владельцем; прогресс трансляций — отдельным
owner-aware сервисом. PWA кэширует страницы (с denylist) и аудио. Вход —
better-auth (Telegram OIDC, Discord), роли — `user|admin|author`, подписка —
ручная/Boosty через Telegram/Discord. Медиа — Cloudflare R2 с опциональным
media-proxy.

## 1. Топология

```text
┌──────────────────────────── Браузер (PWA) ────────────────────────────┐
│ Svelte 5 UI (SSR shell + hydration)                                   │
│   │ useDexie/liveQuery      │ audioStore        │ useSession()         │
│   ▼                         ▼                   ▼                     │
│ Dexie HedgehogDB       HTMLAudioElement     better-auth client        │
│ 13 stores              (URL/OPFS/blob:)     cookie + localStorage     │
│   │                         ▲                                        │
│   │ syncService (fetch)     │ downloadManager → OPFS                 │
│   │ broadcastProgressSync   │                                        │
│   ▼                         │                                        │
│ Service Worker: precache, pages-cache (denylist), audio-cache         │
└───────────────┬───────────────────────────────────────────────────────┘
                │ HTTPS: SSR HTML, /api/*
┌───────────────▼──────────────── Node (adapter-node) ──────────────────┐
│ hooks: seed, auth → locals, blocked accounts, rate limit, CSP, metrics│
│ /api/books, /api/user/sync, /api/analytics/listen, /api/user/delete    │
│ /api/broadcasts/**, /api/media, /api/metrics, /api/admin/**, /health   │
│ /api/telegram/webhook, /api/link-preview, /api/chapters/[id]/...       │
│ /api/auth/* (svelteKitHandler), /admin/** form actions                 │
│                         │ Drizzle / postgres-js                        │
└─────────────────────────┼──────────────────────────────────────────────┘
                          ▼
                PostgreSQL 18 (34 таблицы)
                          ▲
     Cloudflare R2 (медиа) │ Umami │ Telegram Bot API │ Discord API
```

- Один Node-процесс; отдельного API-сервера нет.
- PostgreSQL — единственное серверное хранилище; R2 — только медиа.
- Telegram Bot API и Discord API проверяют подписку; Boosty напрямую не
  вызывается (только внешняя оплата и последствия в группе/роли).

## 2. Жизненный цикл запроса

1. **Сервер.** `hooks.server.ts`:
   - при старте (не при сборке) запускает `ensureDefaultBooks()`;
   - на `/api/books*` дополнительно ждёт seed;
   - для `POST /admin*` и `POST /api/admin*` проверяет `Content-Length`
     (≤520 МиБ) и rate limit 30/мин на IP;
   - `auth.api.getSession` кладёт `session/user` в `locals`;
   - если у пользователя `subscriptions.blocked_at`, удаляет его сессии и
     возвращает 403 для `/api/*` или 303 `/auth?blocked=1` для страниц;
   - `svelteKitHandler` обслуживает `/api/auth/*`;
   - после ответа добавляет security-заголовки и метрики.
2. **SSR.** Страницы с `+page.server.ts` читают Drizzle: главная, каталог,
   книга, том, about/community/support, профиль, подписка, трансляции,
   админка. Для книги/тома клиент дополняет Dexie, но SSR-данные приоритетны.
3. **Гидратация.** Dexie/liveQuery; `/books/[bookId]/+layout.ts` фоново
   вызывает `syncBookDetails`/`syncUserData`; root layout подписывается на
   сессию, синкает при входе и `online`, применяет зеркала из `site_settings`.
4. **Навигация.** View Transitions; `afterNavigate` кэширует HTML только если
   путь не в `PAGE_CACHE_DENYLIST` (`/admin`, `/auth`, `/bookmarks`,
   `/history`, `/profile`, `/settings`, `/subscription`, `/broadcasts`,
   `/feedback`, `/api`).
5. **PWA.** SW регистрируется вручную; страницы — NetworkFirst с тем же
   denylist, аудио — CacheFirst.

Следствие offline-first: `/bookmarks`, `/history`, `/downloads`, `/settings`,
`/auth` не отдают контент в HTML. Остальные страницы имеют SSR, включая
публичный сайт и трансляции.

## 3. Слои и границы

```text
routes/                 страницы, API, form actions
lib/components/         UI: каркас, плеер, контент, админка, site, 28 каталогов ui/
lib/client/             Dexie, sync, broadcast player/chat, сессия, загрузки
lib/broadcasts/         чистые правила эфира (kind, chat validation)
lib/subscriptions/      чистые правила подписки (дни, цена, summary)
lib/server/             auth, db, broadcasts, subscriptions, site, storage, metrics
lib/*.svelte.ts, *.ts   плеер, логгер, утилиты
```

- `.svelte.ts` — только клиент/компоненты; не импортировать в server/SW.
- `lib/server/**` — не импортировать в клиент; типы схемы в клиенте — только
  через `typeof import(...)`.
- `lib/utils/**`, `lib/broadcasts/domain.ts`, `lib/subscriptions/domain.ts`,
  `constants/strings.ts`, `analytics/stats.ts` — SSR/SW-safe.
- UI-примитивы — `$lib/components/ui/<name>`; корневого barrel нет.
- Tailwind-токены — основной способ стилизации; hex — брендовые иконки/поддержка.

## 4. Данные и контракты

### 4.1. Схема

- Контент: `books → volumes → chapters/illustrations`, версии
  `audio_versions → chapter_audio_versions`, тайминги `chapter_illustrations`.
- Активность: `listening_progress`, `volume_likes`, `chapter_likes`,
  `bookmarks`; ключи включают `version_id`.
- Аналитика: `listening_sessions`, `daily_listening_stats`.
- Сайт: `site_pages`, `site_settings`, `translators`.
- Трансляции: `broadcasts`, `broadcast_messages`, `broadcast_listeners`,
  `broadcast_illustrations` (legacy), `broadcast_reactions`,
  `broadcast_views`, `broadcast_progress`.
- Подписки: `subscriptions`, `subscription_sources`, `subscription_events`,
  `donation_ledger`, `subscription_settings`, `subscription_price_changes`,
  `subscription_price_notices`.
- Auth: `user/session/account/verification`; роли `user|admin|author`.
- `chapters.published` — публичная видимость; по умолчанию false, seed и старт
  эфира выставляют true. API/SSR отдают только опубликованные.
- ID — строки; закладки/сессии/трансляции — UUID. Полная схема — PROJECT_MAP §8.

### 4.2. API-стиль

- Плоские `+server.ts`, OpenAPI нет; ручная валидация.
- Ошибки — `json({error}, {status})`; 401/403/404/409/413/416/429.
- Auth — `locals.user`; гостю user/sync 401; broadcast media/chat — подписка.
- Кэш: book ETag, media 302/immutable/кэш, sitemap 1 час, health/user sync/
  broadcast progress — `no-store`.
- CSRF-токенов нет; у delete — Origin/Sec-Fetch-Site, у остальных — cookie.
- Rate limit — in-memory Map на процесс (см. §16).

### 4.3. ETag и 304

`syncBookDetails` хранит ETag в `book-etag:<id>` и шлёт `If-None-Match`.
Сервер считает weak SHA1 от JSON и отвечает 304; клиент тогда не трогает Dexie.
`Cache-Control: public, max-age=0, must-revalidate`.

## 5. Offline-first

### 5.1. Контент

`GET /api/books/[id]` → `syncBookDetails` → `hydrate` 5 таблиц:
book, volumes (по bookId), chapters/chapterAudioVersions/illustrations (по
volumeId) с удалением осиротевших. 304 — выход; ошибка — оставить кэш.
`hydrate('all')` с пустым входом без `allowEmptyPurge` — no-op.

### 5.2. Пользовательские данные

`syncUserData` сериализован; 401 → `clearSessionLocalState`, если был owner;
сеть/5xx → кэш остаётся; нет `userId` → не гидрирует. Политика:

- нет serverUserId — skip;
- другой owner — switch (clear data+queue, затем replace);
- same owner + pending — merge;
- same owner без pending — replace;
- guest + local — merge + consent (auto для `isNewUser`).

Logout/expiry/смена пользователя очищают личные данные, очередь и `syncOwner`;
signOut сначала флашит очереди (online). `blocked` аккаунт теряет сессии на
сервере.

### 5.3. Очередь

8 actions: progress/likes/bookmarks/listen; FLUSH-точки — online, visibility,
30 с progress, 10 с listen, старт, manual sync, signOut. Owner фильтруется;
401/429/5xx сохраняются, прочие 4xx для progress/bookmarks дропаются.
Прогресс трансляций в `syncQueue` не входит: `broadcastProgressSync` шлёт
`/api/broadcasts/[id]/progress` батчем 15 с + `pagehide` beacon.

### 5.4. Аудио

Одна загрузка одновременно; `fetch(url?_cors=1)`, fallback-зеркало, резерв
50 МБ, `content-length`, поток в OPFS, `removeEntry` при ошибке, статусы
queued/downloading/downloaded/error. Имена — `opfsAudioFileName`: default
`chapterId` (обратная совместимость), версии — percent-encoded `~`.
`html-audio` ищет OPFS → legacy audio-cache → URL.

### 5.5. Service worker и page cache

- precache `__WB_MANIFEST`;
- NavigationRoute NetworkFirst 3 с, 200, denylist из `PAGE_CACHE_DENYLIST`;
  fallback: точный кэш → `/` → offline HTML;
- audio CacheFirst, RangeRequests, 40 записей/30 дней;
- install `skipWaiting`, activate `clients.claim`;
- `afterNavigate` использует тот же denylist, поэтому personal/subscription/
  broadcasts/api не попадают в pages-cache.

### 5.6. Auth cache

`hedgehog_auth_session` хранит user + `{id,userId,expiresAt}`; token не
пишется и вырезается при чтении. 401/403 → очистка; сеть → кэш; `expiresAt`
проверяется по часам. Аккаунты — отдельный кэш.

## 6. Плеер

Три слоя: `audioStore` (состояние), `htmlAudio` (DOM/OPFS/cache/URL),
`AudioProvider` (мост событий, прогресс, sleep, mediaSession, wake lock,
broadcast heartbeat/progress).

- Очередь из глав тома; `startTime` из прогресса.
- Space — один обработчик; retry — provider (1/2/4 с, до 3); persist — по
  изменениям и 5 с; sleep проверяется до repeat; undo seek 6 с.
- Broadcast track: `broadcastId/broadcastLive`; live стартует с текущего края,
  replay — с серверного прогресса; позиция сохраняется в
  `broadcast-progress:<id>` (Dexie) и `broadcast_progress` (сервер).
- Root layout: heartbeat каждые 10 с, пока live играет; проверка удаления
  `GET /status` каждые 5 с, 404 → остановить и очистить.
- UI repeat/shuffle/queue и мобильной громкости нет; `mediaSession.setPositionState` нет.

## 7. Авторизация, роли, подписки

### 7.1. better-auth

- drizzleAdapter; email/password off; additionalFields: telegram/discord
  avatar/username, role (input:false), includeInStats.
- Discord: scope `identify email guilds.members.read`, mapProfileToUser,
  overrideUserInfoOnSignIn.
- Linking: enabled, allowUnlinkingAll false, allowDifferentEmails true,
  trusted providers, updateUserInfoOnLink.
- Session create: before — отказ, если `blockedAt`; after — avatar hook и
  отложенная (750 мс) проверка источников подписки.
- Telegram: OIDC, `claims.id` проверяется на null/NaN; IPv4-first и retry
  сетевых ошибок к telegram.org.
- Secret ≥32; cookie cross-subdomain по env.

### 7.2. Вход

`/auth` → `signIn.social` → provider → `/api/auth/callback/{provider}` →
user/account/session → cookie → `locals` → `useSession` cache. `from`
проходит `safeInternalPath`; ошибки — модалка; после удаления — signOut → `/`.

### 7.3. Роли

- `user` — обычный.
- `admin` — полный доступ, включая роли/автора/цену.
- `author` — доступ к контенту/аналитике/сайту/подпискам через
  `isAdminRole`/`requireAdmin`, но не к `setRole`/`setAuthor`;
  `includeInStats=false`, его статистика исключается из админ-аналитики.
- `/admin` layout: нет user → 303 `/auth?from=/admin`; не admin/author → 403
  (кроме dev `/admin` для self-promote).
- `requireAdmin` — admin/author; `requireFullAdmin` — только admin.

### 7.4. Аккаунты

`useAccounts` list/link/unlink/delete; offline-кэш; запрет отвязки последнего.
Удаление аккаунта: транзакция удаляет сессии/user, обнуляет `admin_user_id`/
`updated_by`, обезличивает аналитику и донаты, чистит cookie.

### 7.5. Подписки

**Модель.** Одна `subscriptions` на user: `manual_expires_at`, `is_lifetime`,
`revoked_*`, `blocked_*`. `active = !blocked && !revoked && (lifetime ||
manual_expires_at > now || telegram.active || discord.active)`.

- **Boosty-источники:** Telegram-группа (`getChatMember`, webhook
  `chat_member`) и Discord-роль (`DISCORD_GUILD_ID`,
  `DISCORD_SUBSCRIBER_ROLE_IDS`; бот или OAuth `guilds.members.read`).
  Ошибка проверки сохраняет прежний active и `last_error`.
- **Ручная выдача:** 7 ₽ = 1 день по умолчанию; сумма → floor(amount/price);
  продление от `max(now, expiry)`; максимум 36 500 дней/1 000 000 ₽; каждое
  изменение — `subscription_events`.
- **Revoke/restore:** остаток замораживается, restore возвращает.
- **Block:** замораживает остаток, удаляет сессии; login отклоняется.
- **Цена:** `subscription_settings.price_per_day` (после первого изменения;
  до него — env/default 7). Смена `new/all`: для all остаток пересчитывается
  `remainingMs * old / new`, lifetime не меняется; создаются notices.
- **Донаты:** `donation_ledger` — неизменяемый, `idempotency_key UNIQUE`,
  `user_id` SET NULL, `donor_key` остаётся. Revenue — только ручные донаты.
- **Проверки:** после логина (session.create.after), вручную на
  `/subscription` (cooldown 20 с), в админке.
- **Доступ:** подписка не блокирует книги; она нужна для трансляций/чата и
  закрытого сообщества. Admin/author имеют доступ всегда.

## 8. Аналитика

- `listeningTracker`: активное время, heartbeat 30 с (≤300 с), flush на
  pause/скрытие/выгрузку; offline → `LISTEN_SESSION`; батч.
- `POST /api/analytics/listen`: частичный приём, 60/мин, batch ≤100,
  окно startedAt, insert session + upsert daily stats; без транзакции.
- `buildDailyStatId` — 42 символа.
- Админ-аналитика: прослушивания, 30 дней, top-5, 10 сессий, unique listeners
  (исключая авторов с `includeInStats=false`) + revenue/donations из
  `donation_ledger` (всего/30 дней/донатеры/последние).
- Umami опционален.

## 9. Админка

- `/admin` — counts + активные подписчики + recent books.
- `/admin/content` — 13 actions: книги/тома/главы (published)/версии/
  иллюстрации и тайминги; R2-пикер, media lightbox, поиск, без пагинации.
- `/admin/broadcasts` — создание эфира на главе, расписание (datetime-local
  вводится и показывается в Europe/Moscow, в БД хранится UTC), флаги
  `saveRecording/publishAfterEnd/chatEnabled`, старт (публикует главу),
  конец (автопубликация), publish, delete, статистика.
- `/admin/users` — роли, автор, includeInStats, подписка (grant/revoke/
  restore/block/check), цена дня, донаты, developer/translator.
- `/admin/users/integrations` — статус Telegram/Discord, webhook.
- `/admin/site` — about/support/community, переводчики, соцсети, поддержка,
  feedback URL, media/mirrors.
- R2 pipeline: лимиты 15/500/100 МиБ, magic bytes, WebP/blurhash/theme,
  prod fail-fast, delete из content/broadcasts, library list/upload.
- Ограничения: нет пагинации content/users; файл буферизуется в память;
  нет транскодинга.

## 10. Трансляции

- `broadcastKind`: scheduled (нет startedAt), live (startedAt + duration),
  ended (endedAt без publish), published (endedAt + publishedAt).
- `startBroadcast` ставит startedAt и `chapters.published=true`;
  `endBroadcast` ставит endedAt и (если saveRecording+publishAfterEnd)
  publishedAt; иначе запись недоступна; delete удаляет.
- Список `/broadcasts` — публичные live/published. Деталь доступна, но
  media/чат требуют входа и активной подписки (или admin/author); гость
  видит CTA.
- Scheduled-деталь рендерит тот же layout, что live: обложка/иллюстрации,
  чат и плеер; вместо кнопки Play — countdown. В момент старта клиент
  синхронизирует state и пытается включить аудио автоматически (если браузер
  блокирует autoplay — остаётся Play).
- Аудио — та же глава; live синхронизируется по `startedAt/serverNow`
  (коррекция при дрейфе), replay — по серверному прогрессу; live всегда с края.
- Чат: live/replay с chatEnabled; для scheduled открывается за 1 час до старта;
  500 символов, 5/10 с, allowlist
  Telegram/Boosty/Discord/сайта; reply, tagged illustrations, 4 реакции,
  нельзя реагировать на своё; page 30.
- Иллюстрации: `chapter_illustrations` по `showAtSeconds`; legacy
  `broadcast_illustrations` не читается (0033 скопировала данные).
- Presence: heartbeat 10 с, активное окно 30 с; views уникальны по
  broadcast/user/kind; удаление ловится status-поллингом 5 с.
- Offline: чат сохраняется в Dexie `broadcastChats`; downloads
  предупреждает перед удалением главы с сохранённым чатом.

## 11. Сайт и медиа

- `/about`, `/community`, `/support` читают `site_pages`; при отсутствии —
  дефолты `site-content.ts`; данные (developers, links, support, benefits)
  нормализуются/санитизируются.
- `translators` — отдельная таблица, привязка к user, соцсети jsonb, enabled.
- `site_settings.media`: `mediaProxyEnabled`, `mediaDirectBaseUrl`;
  при выключенном proxy `/api/media` отдаёт 302 на direct URL.
- `site_settings.mirrors`: список CDN с ролями default/ru/none; root layout
  отдаёт его клиенту, `mirror.ts` применяет; auto выбирает RU на RU-домене.
- `/feedback` 302 на `about.data.feedbackUrl` (http/https/tg).
- Media proxy: safe key (без traversal/control), MIME, Range/416, кэш
  10 МиБ/файл и 100 МиБ total. Новые загрузки всегда получают канонический
  `/api/media/...`; режим проксирования решает, отдать файл сайтом или 302 на
  direct-base. В direct-режиме route делает HEAD к CDN; если объекта там нет,
  отдаёт 302 на signed R2 URL (6 ч, no-store), чтобы не было 404.

## 12. UI, роутинг, темы, PWA, SEO

- SSR: `/`, `/books`, книга, том, about/community/support, profile,
  subscription, broadcasts, admin.
- Клиентские: bookmarks/history/downloads/settings/auth (+ login CTA).
- `+error.svelte`; 404 для unknown book/volume; admin legacy 303.
- Tailwind v4 + токены; mode-watcher; View Transitions.
- PWA: manifest #09090b, manual register, pages denylist, audio cache.
- OG: OpenGraphMeta на книге/томе; у трансляции — ручные meta; sitemap
  только книги/тома; robots закрывает admin/api; `lang=ru`.

## 13. Ошибки, логирование, наблюдаемость

- `handleError` + `createLogger`; prod browser warn, server info,
  `LOG_FORMAT=json`; SW console.
- `/api/metrics` — Prometheus; `/health` — БД; Docker healthcheck.
- Внешнего APM/Sentry/OTel нет; `/admin/analytics` — продуктовая панель.

## 14. Сборка, конфигурация, деплой

- SvelteKit-конфиг в `vite.config.ts`; `pnpm build` → `build/`;
  production — `node server.js` (gzip, cache, graceful).
- Dev Vite 5173; preview 4173; Traefik dev 5173/5174; production app 3000.
- Docker: multi-stage, non-root, миграции в entrypoint, healthcheck,
  Traefik LE, edge rate limit только analytics; BODY_SIZE_LIMIT 550M.
- Миграции `0000–0035`; `0005` no-op; `db:push` — dev-shortcut.
- Тесты: 38 unit/275, 9 e2e/45.

## 15. Ограничения и компромиссы

1. In-memory rate limit'ы и кэши на процесс; multi-replica не делит.
2. CSP `unsafe-inline`; HSTS/nonce нет; CSRF-токенов нет.
3. `syncBookDetails` гидрирует через `Promise.all` — не атомарно.
4. `buildDailyStatId` — 42 символа.
5. Admin content/users без пагинации; поиск limit 20/30.
6. `broadcast_illustrations` — legacy, данные в `chapter_illustrations`.
7. `chapters.published` default false; забытая публикация скрывает главу.
8. OPFS-имена версий кодируются; старый default сохранён.
9. Закладка с чужим id → PK-конфликт sync → 500.
10. analytics/listen без транзакции; nullable UNIQUE не конфликтуют.
11. progress/clear и delete без rate limit; delete проверяет Origin.
12. R2-удаление только admin content/broadcasts.
13. Нет UI repeat/shuffle/queue и мобильной громкости; setPositionState нет.
14. Broadcast chat/reactions только при активной подписке; live/replay.
15. Subscription — не гейт книг; только broadcasts/community.

## 16. Рецепты изменений

См. [AGENTS.md](../AGENTS.md) §7.
