# ARCHITECTURE.md — Hedgehog X

Свод архитектурных решений, конвенций и регламентов проекта. Каждое правило
здесь — норма для команды: при ревью и приёмке код сверяется с этим документом.
Факты соответствуют реальным файлам проекта (на ветке `fix/audit-cleanup`);
если вы изменили код так, что этот документ устарел — обновите и его.

---

## 1. Стек

- **Фреймворк**: SvelteKit 2 + Svelte 5 (runes: `$state`/`$derived`/`$effect`/`$props`), `adapter-node`.
- **Стили**: Tailwind CSS v4 (плагин `@tailwindcss/vite`, без `tailwind.config`) + shadcn-svelte (на базе **bits-ui**), стиль `vega`, иконки `@lucide/svelte`, шрифт Inter Variable.
- **БД**: PostgreSQL + Drizzle ORM (драйвер `postgres-js`). Prisma не используется.
- **Аутентификация**: better-auth — провайдеры Telegram (OIDC), Discord (OAuth2), Boosty (кастомный вход по телефону + SMS). Парольный вход отключён.
- **Офлайн/клиентский кэш**: Dexie/IndexedDB (offline-first зеркало) + OPFS/CacheStorage для аудио.
- **PWA**: vite-pwa (`injectManifest`, service worker `src/service-worker.ts`).
- **Тесты**: Playwright (e2e) + `node:test` (unit через `node --import tsx --test`).
- **Пакетный менеджер**: только `pnpm` (`packageManager: pnpm@11.7.0`).

Ключевые конфиги: `vite.config.ts`, `components.json`, `drizzle.config.ts`,
`playwright.config.ts`, `src/routes/layout.css`, `compose.yaml`.

---

## 2. Архитектура по слоям

Приложение **offline-first**: страницы читают данные из Dexie (IndexedDB), а не
напрямую с сервера. Сервер — источник истины; клиент тянет данные через
`syncService` и «гидрирует» их в локальную БД. При ошибке сети UI продолжает
работать на кэше.

### 2.1. Флоу данных (SSR/CSR + offline-first)

```
Сервер (PostgreSQL + Drizzle)
      │  GET /api/books, /api/books/[bookId], /api/user/sync
      │  (ETag/304 на деталях книги)
      ▼
syncService (src/lib/client/services/syncService.ts)
      │  map* → hydrate() → Dexie
      ▼
Dexie/IndexedDB (HedgehogDB)  ◄── useDexie() (liveQuery) читает страницы
```

- `syncBooks()` — список книг; `syncBookDetails(bookId)` — дерево книги
  (ETag-кэш: при `304` ничего не делает); `syncUserData()` — личные данные
  (`chapterLikes`/`volumeLikes`/`progress`/`bookmarks`), только для
  авторизованного (guard от data-loss, см. §4.3).
- `hydrate(table, data, purgeScope)` — вставка + удаление «осиротевших» записей
  в транзакции `rw`; `purgeScope` бывает `'all'` или `{ index, values }`.
- Маппинг сервер→офлайн — только в `mappers.ts` (добавляет `likesCount`).
- Триггеры: `src/routes/books/[bookId]/+layout.ts` фоново (без `await`) запускает
  `syncBookDetails` + (для залогиненного) `syncUserData`; `syncBooks` вызывают
  витрина/каталог.
- Push-мутаций на сервер пока нет: таблица `syncQueue` (Dexie) — только заготовка
  действий (`UPDATE_PROGRESS`, `LIKE_*`, `*_BOOKMARK`, …), не отправляется.

### 2.2. API

- Доменные эндпоинты — файлы `src/routes/api/**/+server.ts`:
  - `GET /api/books`, `GET /api/books/[bookId]` (ETag/304, `Cache-Control`),
  - `GET /api/user/sync`, `POST /api/user/delete`,
  - Boosty: `GET /api/boosty/phone-codes`, `POST /api/boosty/send-code`,
    `POST /api/boosty/confirm-code`, `GET /api/boosty/subscription`.
- Auth-эндпоинты `/api/auth/*` (sign-in/social, callback, get-session,
  link-social, unlink-account, list-accounts, sign-out) не имеют своих файлов —
  их обрабатывает `svelteKitHandler` в `src/hooks.server.ts`.
- `hooks.server.ts`: `auth.api.getSession(...)` кладёт в `event.locals.session`
  и `event.locals.user`, затем передаёт управление `svelteKitHandler`.
  Авторизация во всех серверных обработчиках — только через `locals.user`.

### 2.3. Клиентские сторы (runes-модули `.svelte.ts`)

- `src/lib/audio-store.svelte.ts` — `audioStore`: очередь, play/pause/seek,
  shuffle/repeat, громкость, скорость, sleep-таймер. UI-состояние персистится в
  `localStorage` (`audio:ui:store`).
- `src/lib/client/session.svelte.ts` — `useSession()`/`signOutAndRedirect()`:
  реактивная обёртка над `authClient.useSession`.
- `src/lib/client/accounts.svelte.ts` — `useAccounts()`: link/unlink/delete.
- `src/lib/client/downloads/downloadManager.svelte.ts` — `useDownloads()`:
  очередь загрузок (см. §2.5).

### 2.4. Плеер (3 слоя)

1. `audio-store.svelte.ts` — глобальный реактивный store (вся бизнес-логика).
2. `src/lib/html-audio.ts` — синглтон `htmlAudio`, тонкая обёртка над
   `HTMLAudioElement` (preload, retry ≤3, fade, blob/OPFS-подгрузка, live-детект).
   Тип `Track` описан здесь.
3. `src/lib/components/ui/audio/provider/audio-provider.svelte` — мост: слушает
   события `<audio>`, синхронизирует `audioStore`, сохраняет прогресс в Dexie
   (`progress`, каждые 5 с; `ended` → `isCompleted: true`), грузит треки в `$effect`.

UI-слой: `src/lib/components/audio/GlobalPlayer.svelte` + набор
`src/lib/components/ui/audio/player/*` (Root, ControlBar, Play/Pause, SeekBar,
Volume, Speed, SleepTimer, Download, …). Resume — через `startTime` из
`db.progress.get(chapter.id)`.

### 2.5. Загрузки (офлайн-аудио)

- `downloadManager.svelte.ts`: очередь обрабатывается **последовательно**;
  `performDownload` → `fetch(audioUrl + '?_cors=1')` → проверка свободного места
  (`navigator.storage.estimate`, резерв 50 МБ) → стриминг в **OPFS**
  (`navigator.storage.getDirectory().getFileHandle(chapter.id)`), с миграцией из
  legacy `audio-cache` (CacheStorage).
- Чтение: `html-audio._load` при `id` ищет файл сперва в OPFS, затем в
  `audio-cache`. Скачанные главы играбельны без сети.
- Статусы: `queued → downloading → downloaded | error`. `downloads` — чисто
  локально, с сервером не синхронизируется.

### 2.6. Схема БД

Схема в `src/lib/server/db/schema.ts` (доменные таблицы) +
`src/lib/server/db/auth.schema.ts` (таблицы better-auth, генерируются
`pnpm auth:schema`). Инстанс `db` — `src/lib/server/db/index.ts`.
Миграции — каталог `drizzle/` (`0000_*.sql` … `0007_*.sql` + `meta/_journal.json`),
конфиг `drizzle.config.ts` (`dialect: postgresql`, `strict: true`).

**auth-таблицы** (`auth.schema.ts`): `user` (доп. поля аватаров/username
провайдеров), `session`, `account` (`providerId`: `telegram-oidc`/`discord`/`boosty`),
`verification`.

**Доменные таблицы** (`schema.ts`):

| Таблица                          | Ключевые поля                                                                                                                                                                          | Связи                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `books`                          | `id`, `title`, `description`, `coverUrl`, `blurhash`, `themeColor` (CHECK hex), `status` (enum `book_status`: `ongoing/completed/paused`, default `ongoing`), `createdAt`, `updatedAt` | 1→many volumes                         |
| `volumes`                        | `id`, `bookId`, `volumeNumber`, `title`, `coverUrl`, `blurhash`, timestamps                                                                                                            | cascade; 1→many chapters/illustrations |
| `chapters`                       | `id`, `volumeId`, `chapterNumber`, `title`, `audioUrl`, `durationSeconds`, `telegramPostUrl`                                                                                           | cascade                                |
| `illustrations`                  | `id`, `volumeId`, `imageUrl`, `blurhash`, `caption`, `sortOrder`                                                                                                                       | cascade                                |
| `listening_progress`             | `userId`, `chapterId`, `progressSeconds`, `isCompleted`, `updatedAt`                                                                                                                   | композитный PK (userId, chapterId)     |
| `volume_likes` / `chapter_likes` | `userId`, `volumeId`/`chapterId`, `createdAt`                                                                                                                                          | композитный PK                         |
| `bookmarks`                      | `id` (varchar 36), `userId`, `chapterId`, `timestampSeconds`, `note`                                                                                                                   | FK → user/chapters                     |

- FK контента (`books → volumes → chapters/illustrations`) — `onDelete/onUpdate: cascade`.
- FK от `user` (`session/account/listening_progress/*_likes/bookmarks`) — только
  `onDelete: cascade` (т.к. `user.id` — неизменяемый text-PK).
- `relations()` определены для всех связей (relational queries `db.query.*`).
- Индексы на FK: `volumes_book_id_idx`, `chapters_volume_id_idx`,
  `illustrations_volume_id_idx`, `bookmarks_user_id_idx`,
  `session_userId_idx`, `account_userId_idx`, `verification_identifier_idx`.

---

## 3. Структура папок

```
src/
├─ hooks.server.ts          # better-auth: locals.session/user + svelteKitHandler
├─ app.d.ts                 # типы App.Locals (user/session)
├─ app.html                 # <html lang="ru">
├─ service-worker.ts        # vite-pwa: precache, pages-cache, audio-cache
├─ lib/
│  ├─ constants.ts          # общие изотропные константы (кэши, Dexie, плеер)
│  ├─ route-titles.ts       # ROUTE_TITLES / segmentTitle / routeTitle
│  ├─ utils.ts              # cn(), типы, getInitial()
│  ├─ html-audio.ts         # синглтон HTMLAudioElement + тип Track + formatDuration
│  ├─ audio-store.svelte.ts # глобальный store плеера (runes)
│  ├─ delete-confirm.ts     # чистый хелпер подтверждения удаления (unit-тест)
│  ├─ assets/               # favicon.svg
│  ├─ data/                 # mockShowcase.ts (витрина-мок)
│  ├─ actions/              # inview.ts
│  ├─ server/
│  │  ├─ auth.ts            # конфиг better-auth (провайдеры, линковка, hooks)
│  │  ├─ config.ts          # server-only константы (Boosty, таймауты, секреты)
│  │  ├─ rate-limit.ts      # in-memory rate limiter (Boosty-вход)
│  │  ├─ db/                # index.ts, schema.ts, auth.schema.ts
│  │  └─ boosty/            # phone-client, complete-flow, subscriptions, token-utils
│  ├─ client/
│  │  ├─ authClient.ts      # createAuthClient (+ telegramClient)
│  │  ├─ session.svelte.ts  # useSession / signOutAndRedirect
│  │  ├─ accounts.svelte.ts # useAccounts (link/unlink/delete)
│  │  ├─ providers.ts       # AUTH_PROVIDERS, providerAvatar/Username
│  │  ├─ boosty.ts          # клиент Boosty-флоу + форматтеры
│  │  ├─ db/                # index.ts (Dexie), hydrate.ts, useLiveQuery.svelte.ts
│  │  ├─ services/          # syncService.ts, mappers.ts
│  │  └─ downloads/         # downloadManager.svelte.ts
│  └─ components/
│     ├─ ui/                # shadcn-примитивы (accordion…tooltip, brand-icons)
│     │  └─ audio/          # player/* (контролы), provider/ (мост)
│     ├─ audio/             # GlobalPlayer.svelte, Download.svelte
│     ├─ header/            # AppNavigation, Logo, UserAvatar, ProfileDropdown, ThemeSwitchButton
│     ├─ layout/            # PageHeader.svelte, AppBreadcrumbs.svelte
│     ├─ auth/              # ProviderIcon, BoostyLogin, BoostyLoginModal
│     ├─ downloads/         # DownloadVolumeGroup, DownloadChapterRow, types
│     ├─ overlay/           # BaseModal, ConfirmModal, ValueChangeOverlay
│     └─ showcase/          # ShowcaseBackground/Item/Nav
├─ routes/
│  ├─ +layout.svelte        # ModeWatcher, Tooltip.Provider, AudioProvider, SW-регистрация
│  ├─ +page.svelte          # витрина (mockShowcase)
│  ├─ +error.svelte         # 404 / общая ошибка
│  ├─ layout.css            # токены темы (oklch), @theme, @utility/@custom-variant
│  ├─ auth/ about/ bookmarks/ community/ downloads/ history/ profile/ settings/ support/
│  ├─ books/+page.ts        # redirect → /
│  ├─ books/[bookId]/       # +layout.ts (фоновый sync), +page.svelte
│  ├─ books/[bookId]/[volumeId]/  # +page.svelte (главы, плеер), +page.ts
│  └─ api/
│     ├─ books/[+server.ts], books/[bookId]/+server.ts
│     ├─ boosty/{phone-codes,send-code,confirm-code,subscription}/+server.ts
│     └─ user/{sync,delete}/+server.ts
e2e/
├─ config.ts                # BASE_URL (E2E_BASE_URL ?? http://localhost:4173)
├─ fixtures/                # data.ts, mocks.ts, test.ts (фикстуры), utils.ts
└─ *.e2e.ts                 # showcase, catalog, player, navigation, pages, titles,
                            # downloads, auth, boosty-login, profile,
                            # api.integration, delete-account.integration
drizzle/
├─ 0000_*.sql … 0007_*.sql  # миграции
└─ meta/                    # _journal.json, *_snapshot.json
```

---

## 4. Конвенции и регламенты

### 4.1. DB (Drizzle)

- **Без сырого SQL в запросах.** Только Drizzle-параметризация (`eq`, `and`,
  `inArray`, `desc`, relational `db.query.*`). Шаблонный `sql` допустим лишь в
  DDL-ограничениях схемы (например `books` CHECK на `theme_color`).
- **`snake_case` ↔ `camelCase`**: имена колонок в БД — `snake_case` (задаются
  явной строкой), поля в TypeScript — `camelCase` (маппинг берёт на себя Drizzle).
- **Индексы на внешних ключах** — обязательны для всех FK, по которым ищут
  (см. список в §2.6).
- **Статусы — через `pgEnum`, инварианты — через `CHECK`**, а не свободный текст
  (пример: `book_status`, `books_theme_color_hex_check`).
- **`.notNull()` на всех `createdAt`/`updatedAt`**; `updatedAt` получает
  `.$onUpdate(() => new Date())`.
- **Связи объявлять через `relations()`**, чтобы relational queries
  (`db.query.books.findFirst({ with: {...} })`) работали.
- **`auth.schema.ts` руками не править** — он перегенерируется `pnpm auth:schema`;
  дополнительные поля пользователя задаются в `auth.ts` (`user.additionalFields`).
- **Миграции**: после изменения `schema.ts` → `pnpm db:generate`, затем
  `pnpm db:push`/`db:migrate`. Миграции обязаны накатываться на чистую БД без
  ошибок; в CI обязательна проверка `drizzle-kit check` (конфиг уже в
  `strict: true`).
- **Секреты только из `$env/dynamic/private`** (`env.DATABASE_URL`), не хардкодить.

### 4.2. Backend (`src/routes/api/**`, `src/lib/server/**`)

- **IDOR-защита**: пользователя брать только из `locals.user`, а выборку —
  фильтровать по владельцу (`where(eq(....userId, locals.user.id))`). Никогда не
  доверять `userId`/идентификаторам из тела запроса (пример — `boosty/subscription`
  ищет `account` по `userId = currentUser.id`).
- **Валидация входа до обращения к БД/апстриму**: JSON-парсинг, форматы
  (`normalizePhone`/`isE164Phone`, UUID, 6-значный код) — см. `send-code`/`confirm-code`.
- **Статусы 4xx vs 5xx**: невалидный ввод клиента → `400`; не авторизован → `401`;
  не найдено → `404`; неверный метод → `405`; превышен лимит → `429`;
  сбой апстрима Boosty → `502`; внутренняя ошибка → `500`. Не маскировать ошибку
  апстрима под «не найдено».
- **Секреты только `$env/dynamic/private`** (`BETTER_AUTH_SECRET`,
  `TELEGRAM_*`, `DISCORD_*`, `DATABASE_URL`); ничего не класть в `$env/static` и
  не импортировать на клиент.
- **Таймауты на внешние `fetch`**: всегда `AbortSignal.timeout(...)`
  (`BOOSTY_FETCH_TIMEOUT_MS = 12_000`).
- **`429` → заголовок `Retry-After`** (секунды до сброса окна) — см.
  `src/lib/server/rate-limit.ts`.
- **Транзакции для мультистрочных записей** одной операции (`db.transaction(...)`)
  — пример: создание `user`+`account`+`session` в `completeBoostyLogin`.
- **Fail-fast по `BETTER_AUTH_ALLOWED_HOSTS` в production**: `auth.ts` бросает
  ошибку, если в prod список доверенных хостов пуст (защита origin-check/CSRF).

### 4.3. Client (`src/lib/client/**`, `src/lib/*.svelte.ts`)

- **Runes-паттерны**: реактивное состояние — `$state`, производные — `$derived`,
  побочные эффекты — `$effect`, входные параметры — `$props`. Без legacy-стора
  (writable/store) в Svelte 5.
- **Store-обёртки** (runes-хуки) для разделяемого состояния: `audioStore`,
  `useSession()`, `useAccounts()`, `useDownloads()`. Вызываются внутри компонента;
  доступ наружу — через `get`-геттеры.
- **Изотропность модулей**: обычные `.ts`-модули (`constants.ts`,
  `route-titles.ts`, `utils.ts`, `mappers.ts`) не импортируют `svelte`/`browser`/env
  и безопасны для SSR и service worker. `.svelte.ts` (runes) — клиентские модули:
  импортировать их **только** из компонентов/клиентского кода, не из сервера и не
  из SW.
- **Guard против data-loss**: перед `hydrate(..., 'all')` проверять, что ответ не
  «пустой» (неавторизованный/нет данных) — иначе сотрётся локальный прогресс
  гостя (см. `syncService.syncUserData`); детальную очистку вести по scope
  (`{ index, values }`) для связанных сущностей книги.

### 4.4. UI (`src/lib/components/**`)

- **shadcn-паттерн**: примитивы в `src/lib/components/ui/**`, импортируются из
  barrel-`index.ts` (`import { Button } from '$lib/components/ui/button'`). Новые
  примитивы — через `pnpm dlx shadcn-svelte add <name>` (регистр в `components.json`).
- **Токены вместо hex**: цвета только через токены (`bg-card`,
  `text-muted-foreground`, `border-border`, `text-destructive-foreground`, …);
  hex допустим только в самом `layout.css` и в бренд-цветах провайдеров
  (`providers.ts`). Поддерживать и светлую, и тёмную (`.dark`) тему.
- **Только валидные Tailwind-классы** (v4); произвольные значения — через
  токены/`@theme`, а не ad-hoc hex.
- **Иконки — `size-*`** (`size-4`, `size-5`, …), не произвольные `w/h` в px.
- **`aria-label`** на икон-кнопках и интерактивных элементах без текста
  (селекторы тестов опираются на роли/лейблы).
- **Без вложенных интерактивных элементов** (кнопка внутри кнопки/ссылки).
- **Единый стиль импортов**: компоненты приложения — по `$lib`-алиасам,
  shadcn-примитивы — из barrel, переиспользуемые компоненты — из
  `src/lib/components/**` (PageHeader, UserAvatar, ProviderIcon, …); не дублировать
  вёрстку, если аналог уже есть.
- **Переиспользование обязательных примитивов приложения**: `layout/PageHeader`,
  `layout/AppBreadcrumbs`, `header/*`, `auth/*`, `downloads/*`.

### 4.5. Страницы (`src/routes/**`)

- **Единый формат `<title>`**: `«Раздел — HEDGEHOG.INC»`, заголовок берётся из
  `route-titles.ts` (`segmentTitle('…')`), для динамических страниц — из данных
  Dexie с fallback (`{volumeQuery.data?.title || 'Том'} — HEDGEHOG.INC`).
- **Заголовки и крошки — из `route-titles.ts`**, не хардкод на страницах
  (`PageHeader` + `AppBreadcrumbs` используют `segmentTitle`/`ROUTE_TITLES`).
- **Разделять loading / empty**: загрузка — `Skeleton`, пустое состояние —
  `src/lib/components/ui/empty/**`; не смешивать.
- **`+error.svelte`** — единая страница ошибки (404 и общая), с `<title>` в том же
  формате и ссылкой на главную.
- **Санитизация `?from`** (open-redirect): в `auth/+page.svelte` `from` принимается
  только как внутренний путь — `raw.startsWith('/') && !raw.startsWith('//')`,
  иначе `resolve('/')`. Это же правило — для любых будущих редиректов по URL-параметру.

### 4.6. Стили / конфиг

- **Только `pnpm`**; `package-lock.json`/`npm`-артефактов быть не должно
  (зафиксирован `pnpm-lock.yaml`).
- **Tailwind v4**: кастом через `@utility` (например `no-scrollbar`) и
  `@custom-variant` (тёмная тема `@custom-variant dark (&:is(.dark *))`); токены
  пробрасываются в Tailwind через `@theme inline` в `layout.css`.
- **`lang="ru"`** — атрибут на `<html>` в `app.html` (и в офлайн-фолбэке SW).
- **Секреты и env** — только `$env/dynamic/private`; `.env` в `.gitignore`,
  образец в `.env.example`.

### 4.7. Тесты

- **DRY-фикстуры** в `e2e/fixtures/**`: `data.ts` (мок-данные), `mocks.ts`
  (переиспользуемые `page.route`-моки: `mockGetSession`, `mockCatalog`,
  `mockAudio`, `mockBoosty`), `test.ts` (фикстуры `guest`/`loggedIn`/`catalog`/`audio`),
  `utils.ts` (`openPage`, `KILL_ANIMATIONS`, `unquote`). Новые моки/данные — туда же.
- **Ассерты — вне колбэков `page.route`** (колбэк только формирует ответ);
  «последний зарегистрированный route побеждает» — тест может переопределить мок.
- **Селекторы по ролям/текстам/`data-*`** (`getByRole`, `getByText`, `aria-label`),
  **без CSS-классов**.
- **Внешние сервисы всегда мокаются** (Telegram/Discord/Boosty — через
  `page.route`); OAuth-редиректы проверяются по URL, без реальных провайдеров.
- **Skip-гарды с проверкой доступности БД**: интеграционные тесты
  (`e2e/integration/api.e2e.ts`, `e2e/integration/delete-account.e2e.ts`) —
  `test.skip(!hasEnv, …)`
  без `.env`/Postgres; `loadEnv()` из `dotenv`.
- **Unit — только для чистой логики** (`pnpm test:unit`, `node --test`), без
  БД/браузера: `delete-confirm`, `token-utils`, `rate-limit`, `html-audio`
  (чистые функции), `utils`, `route-titles`, `mappers`.
- Новые e2e — в feature-подпапках `e2e/<feature>/*.e2e.ts`
  (`profile catalog player downloads navigation titles auth boosty showcase pages
integration`), импортировать `test` из `../fixtures/test`;
  относительные пути (в конфиге `use.baseURL`). Анимации глушить инъекцией стилей.

### 4.8. Безопасность

- **Session-cookie**: `httpOnly: true`, `sameSite: 'lax'`,
  `secure: isProduction || isHttps`; имя в prod с префиксом `__Secure-`
  (`sessionCookieName`); значение — `token + '.' + base64(HMAC-SHA256(secret, token))`
  (`buildSessionCookieValue`), без повторного `encodeURIComponent`.
- **Очистка cookie при удалении аккаунта** (`/api/user/delete`): `cookies.set(..., { maxAge: 0 })`.
- **Обобщённые ошибки клиенту**: наружу — понятный текст без сырых деталей
  апстрима/стека («Не удалось отправить код…», `502`), детали — только в
  серверный лог.
- **Open-redirect — только внутренние пути**: любые редиректы из пользовательского
  ввода ограничивать внутренними путями (см. §4.5 про `?from`).
- **Секреты не коммитить**; `BETTER_AUTH_SECRET` обязателен (prod — 32 симв., высокая энтропия).

---

## 5. Известные гэпы / backlog

Осознанно отложено (с причиной):

1. **Полный i18n-слой** — сейчас русские строки захардкожены на страницах;
   `route-titles.ts` даёт только названия разделов, общего механизма локализации нет.
2. **jsdom/браузерные unit-тесты** для:
   - `audio-store.svelte.ts` (runes-модуль — нет рантайма runes в `node --test`),
   - `html-audio._load` (нужен OPFS/CacheStorage и `<audio>`),
   - `syncService` 304 (нужен Dexie + `fetch`),
   - `downloadManager.performDownload` (нужен OPFS/`fetch`-стриминг).
3. **Перенос рантайм-серверных пакетов** (`better-auth`, `postgres`, `drizzle-orm`)
   из `devDependencies` в `dependencies` — сейчас они в devDeps, для продакшн-образа
   это нужно поправить (в `dependencies` только `better-auth-telegram`, `dexie`,
   `mode-watcher`, wheel-picker).
4. **Ленивая загрузка chapters в `downloadManager`** — сейчас `useDownloads`
   грузит `db.chapters.toArray()` целиком (все главы), а не только нужные для очереди.
5. **`aria-pressed` / hover-фокус списка глав** — доступность списка глав не доведена.
6. **Унификация размеров иконок** — размеры иконок местами разнобойны.
7. **Семантический `--success` токен** — в `layout.css` нет токена успеха
   (для подтверждённых действий), используется ad-hoc.
8. **`advanced.ipAddress` для better-auth rate-limit** — встроенный rate-limit
   better-auth не сконфигурирован; сейчас работает кастомный in-memory
   `src/lib/server/rate-limit.ts` (только Boosty-вход, сбрасывается при рестарте/
   горизонтальном масштабировании — для multi-replica нужен Redis).
9. **Мёртвый экспорт `routeTitle`** — функция экспортируется из `route-titles.ts`,
   но в приложении не используется (ссылается только собственный unit-тест
   `route-titles.test.ts`); стоит либо задействовать, либо удалить.
