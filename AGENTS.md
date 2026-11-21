Е# AGENTS.md — Hedgehog X (аудиокниги, SvelteKit PWA)

> Это основной входной документ для ИИ-агентов и разработчиков.
> Он намеренно короткий: детали — в `docs/`. Читай его целиком перед первой правкой.
>
> **Проверено:** 2026-11-18, ветка `dev`, коммит `5f67c5d` (worktree `dsh-d6a6b302-2f83`).
> Если код разошёлся с документами — прав код, но сначала обнови документы, а не наоборот.

## 0. Что это за проект

`hedgehog-x` — русскоязычное PWA-приложение для прослушивания аудиокниг
`HEDGEHOG.INC` (Telegram-озвучка `Overlord` / `Mushoku Tensei` и будущих книг).

Ключевая идея: **offline-first**. Сервер (PostgreSQL + Drizzle) — источник истины,
но страницы читают контент и действия пользователя из **Dexie/IndexedDB**.
Аудио можно скачивать в **OPFS** и слушать без сети. Авторизация — better-auth
(Telegram OIDC, Discord OAuth2), без паролей. Админка — SSR-панель с загрузкой
обложек/аудио в **Cloudflare R2**. PWA собирается через `vite-plugin-pwa` +
собственный `src/service-worker.ts`.

## 1. Что читать (по задаче)

| Задача                               | Обязательно прочитать                                    |
| ------------------------------------ | -------------------------------------------------------- |
| Любая первая сессия                  | этот файл + `docs/README.md`                             |
| Понять, как устроен проект           | `docs/ARCHITECTURE.md`                                   |
| Найти файл/маршрут/таблицу/компонент | `docs/PROJECT_MAP.md`                                    |
| Понять термины и инварианты          | `docs/DOMAIN.md`                                         |
| Запустить, настроить, задеплоить     | `docs/OPERATIONS.md`                                     |
| Что сломано / где расхождения        | `docs/AUDIT.md` (сначала P0/P1)                          |
| Менять offline-синхронизацию         | `docs/ARCHITECTURE.md` §5 + `docs/AUDIT.md` P0           |
| Менять плеер                         | `docs/ARCHITECTURE.md` §6 + `docs/AUDIT.md` §5.2         |
| Трогать миграции/БД                  | `docs/OPERATIONS.md` §4; история — `docs/AUDIT.md` P0-02 |

## 2. Стек (фактический)

- **SvelteKit 2.70 + Svelte 5.57 (runes)**, `@sveltejs/adapter-node`.
- **TypeScript 6**, strict; проверка `svelte-check` проходит.
- **Tailwind CSS v4** (плагин Vite, без `tailwind.config`) + **shadcn-svelte**
  (style `vega`) на **bits-ui**; иконки `@lucide/svelte`; Inter Variable.
- **PostgreSQL 18 + Drizzle ORM** (`postgres-js`); схема — `src/lib/server/db/schema.ts`.
- **better-auth 1.6.33** + `better-auth-telegram` (OIDC) + Discord.
- **Dexie 4** (IndexedDB) + **OPFS** для офлайн-аудио; `CacheStorage` для legacy/страниц.
- **PWA**: `vite-plugin-pwa` (`injectManifest`), свой service worker.
- **Тесты**: `node:test` + `tsx` (unit), Playwright (e2e).
- **Пакетный менеджер**: pnpm 11.7.0 (`packageManager`, Node 26 в `engines`).
- **Хранилище**: Cloudflare R2 (S3 API) с локальным fallback в `static/uploads`.
- **Аналитика**: собственные `listening_sessions` / `daily_listening_stats` + Umami (опционально).

## 3. Команды

```bash
pnpm dev                 # Vite dev (нужен .env + Postgres; см. OPERATIONS)
pnpm build               # production build (adapter-node) — проходит
pnpm preview             # preview собранного приложения
pnpm check               # svelte-check + sync — проходит
pnpm lint                # prettier --check . && eslint . — проходит
pnpm format              # prettier --write .
pnpm test:unit           # node --import tsx --test "src/**/*.test.ts" — 198 тестов, зелёные
pnpm test:e2e            # playwright install && playwright test — требует env, см. ниже
pnpm test:docker         # docker compose -f compose.test.yml up --build ...
pnpm db:push             # dev-only shortcut; может удалять колонки, не основной путь
pnpm db:seed             # node --import tsx src/lib/server/db/seed.ts
pnpm db:generate         # drizzle-kit generate (после изменения schema.ts)
pnpm db:migrate          # drizzle-kit migrate — РАБОЧИЙ способ (0000–0012)
pnpm db:studio           # drizzle-kit studio
pnpm auth:schema         # guard: требует ALLOW_AUTH_SCHEMA_OVERWRITE=1
```

### Как проверять правки (минимум)

1. `pnpm test:unit` — быстрые чистые тесты.
2. `pnpm check` — типы/Svelte (проходит; не добавляй новых ошибок).
3. `pnpm lint`.
4. `pnpm build` — ловит SSR/бандл-проблемы, но НЕ типы.
5. Для UI/плеера — `pnpm dev` + ручная проверка; для e2e — см. OPERATIONS (нужен `BETTER_AUTH_SECRET`).

## 4. Маршруты и данные — карта в голове

```
Сервер: PostgreSQL ── Drizzle ── /api/books, /api/books/[bookId], /api/user/sync,
                                /api/analytics/listen, /api/user/delete, /admin actions
                                   │
                    syncService (клиент) ── mappers ── hydrate() ── Dexie
                                   │
Страницы ── useDexie(liveQuery) ───┘        (книги/тома SSR; остальные client)
```

- Контент (книги/тома/главы/иллюстрации) живёт в Dexie; страница книги `/books/:bookId`
  в `+layout.ts` фоново вызывает `syncBookDetails` и `syncUserData`.
- Личные данные (прогресс, лайки, закладки) — тоже Dexie; синхронизация через
  `/api/user/sync`.
- Главная `/` — витрина на `src/lib/data/mockShowcase.ts`; полный каталог — `/books`.
- `/books` — SSR-каталог книг с поиском; доступен из навигации.
- Аналитика прослушивания — отдельный поток `/api/analytics/listen` (не в user sync).
- Админка `/admin/**` — единственные SSR-страницы с данными из БД; доступ по `locals.user.role === 'admin'`.

## 5. Главные правила (нарушение = риск потери данных)

1. **Никогда не вызывай `hydrate(..., 'all')` с пустым/неполным ответом.**
   `hydrate` с `purgeScope: 'all'` удаляет все локальные записи, которых нет во входных
   данных. P0-01 исправлен (401 для гостя + owner-aware sync + guard), но правило
   остаётся: purge допустим только после проверки авторизации, владельца и очереди.
   Не ослабляй `allowEmptyPurge`.
2. **Пользователь — только `locals.user`.** Не доверяй `userId` из тела запроса.
3. **Не добавляй новые `syncQueue` actions без consumer'а и owner'а.** Каждый
   `SyncItem` хранит `ownerUserId`; flush отправляет только элементы текущего
   владельца. Новые actions обязаны иметь flush/retry, owner и тест. При logout
   очередь и локальные данные очищаются.
4. **Каталог — `/books`, SSR из БД.** `syncBooks()` удалён; контент книги по-прежнему гидрируется в Dexie при входе в книгу.
5. **SSR книг/томов содержит данные.** `/books/[bookId]` и volume имеют серверные
   `+page.server.ts` (404/OG); не ломай их. Остальные страницы всё ещё могут быть
   клиентскими.
6. **Миграции — рабочий способ.** Текущая БД собрана через `db:migrate` (0000–0012;
   `0005` — намеренный no-op, `0006` — catch-up из `schema.ts`). Не используй `db:push`
   как основной путь: он может удалять колонки. После изменения `schema.ts`:
   `db:generate` → проверь SQL → `db:migrate`. Не редактируй применённые миграции задним
   числом; добавляй новую. История инцидента — в `docs/AUDIT.md` P0-02.
7. **R2-объекты удаляются при delete/update контента** (P1-07). Новые CRUD-ветки
   обязаны вызывать `deleteFromStorage` для заменяемых файлов.
8. **Не храни секреты в клиенте.** Сессионный токен больше не пишется в localStorage
   (P1-06); кэшируются только user/expiresAt.
9. **Даты/ID:** ID книг/томов/глав — `varchar(128)`, генерируются в админке;
   `buildDailyStatId` может превысить 128 символов (AUDIT P2). Глава ID используется
   как имя файла в OPFS — не делай его небезопасным для ФС.
10. **Строки UI — русские.** Централизованный словарь `src/lib/constants/strings.ts`
    есть, но многие страницы хардкодят текст; новый код — через словарь, где возможно.

## 6. 10 мин-ловушек (кратко)

- Не возвращай гостю `200 + пустые массивы` в `/api/user/sync`: это историческая
  причина P0-01 (сейчас там 401). Гостевые данные должны переживать навигацию и
  загружаться при входе; это закреплено e2e `sync-data-safety`.
- `/admin` редиректит на `/auth?from=/admin`; `/auth` также понимает legacy `redirect`.
- `/books` — каталог; `/books/unknown` и `/books/id/unknown` отдают **404** (P1-04).
- Без `BETTER_AUTH_SECRET` приложение падает на старте (better-auth default secret).
- `pnpm test:e2e` требует env; внешние OAuth-редиректы замоканы (P1-03), но
  `--workers=1` всё ещё рекомендуется.
- Space-хоткей теперь один на приложение; sleep-timer срабатывает раньше repeat.
- Переход по закладке/истории использует `Track.startTime`; seek больше не теряется.
- Прерванная загрузка удаляет частичный OPFS-файл и проверяет размер.
- `pnpm build` не проверяет типы: запускай отдельно `pnpm check` (сейчас зелёный).

## 7. Структура (сокращённо)

```
src/
  hooks.server.ts        # better-auth -> locals.session/user; seed при старте
  app.d.ts               # App.Locals
  service-worker.ts      # Workbox: precache, pages-cache, audio-cache
  lib/
    audio-store.svelte.ts         # глобальный store плеера (runes)
    html-audio.ts                 # HTMLAudioElement-обёртка, OPFS, retry
    logger.ts, delete-confirm.ts, utils.ts
    analytics/stats.ts            # валидация heartbeat, даты, агрегаты
    server/
      auth.ts, admin.ts, db/{index,schema,auth.schema,seed}.ts, storage/r2.ts
    client/
      authClient.ts, session.svelte.ts, accounts.svelte.ts, providers.ts
      auth-storage.ts             # localStorage-кэш сессии/аккаунтов
      db/{index,hydrate,syncState,useLiveQuery.svelte}.ts
      services/{syncService,mappers,likeService,bookmarkService,bookmarkSync,
                guestAdoption.svelte,progressSync.svelte,listeningTracker.svelte}.ts
      downloads/downloadManager.svelte.ts
    components/
      ui/ (159 shadcn-примитивов)  audio/ (GlobalPlayer, Download)
      volume/ comments/ header/ layout/ overlay/ showcase/ support/ auth/ seo/ share/
      overlay/GuestDataAdoptionModal.svelte
    data/mockShowcase.ts, constants/strings.ts, actions/inview.ts, utils/*
  routes/
    +layout.svelte, +page.svelte
    about/ admin/ auth/ bookmarks/ books/ community/ downloads/ history/
    profile/ settings/ support/ api/
drizzle/                  # SQL-миграции 0000–0012 (актуальны; 0005 — no-op)
e2e/                      # 9 Playwright-файлов
static/                   # аудио/картинки/видео/QR/PWA-иконки
```

## 8. Конвенции кода

- Svelte 5 runes; НЕ использовать legacy stores. Общие runes-модули — `*.svelte.ts`.
- Общие `.ts` модули должны быть безопасны для SSR и service worker (не импортировать
  `svelte`, `window` на верхнем уровне без guard).
- Импорты: `$lib/...`; shadcn-примитивы — из barrel `index.ts`.
- Стили — токены Tailwind (`bg-card`, `text-muted-foreground`, ...), не hex; тёмная тема
  поддерживается через `.dark`.
- Новые API: `RequestHandler`, проверка `locals.user`, валидация входа, корректные 4xx/5xx,
  никаких секретов в ответе. Для state-changing — подумай о CSRF/origin.
- Новые клиентские мутации: сначала Dexie (optimistic UI), затем очередь `syncQueue`,
  затем flush. Не забывай consumer и retry/poison-pill.
- Новые SQL-запросы: Drizzle; не добавляй сырой SQL без причины.
- Логи — `createLogger('Tag')`, не `console.log` (в SW/сервере особенно).
- Тесты: unit — чистые функции; e2e — мокай внешние сервисы; не добавляй реальные
  OAuth-переходы в CI.

## 9. Svelte MCP (сохранено из исходного AGENTS.md)

Для задач по Svelte/SvelteKit используй Svelte MCP:

1. `list-sections` — сначала найди разделы документации.
2. `get-documentation` — получи релевантные разделы.
3. `svelte-autofixer` — обязательно прогоняй перед отдачей Svelte-кода.
4. `playground-link` — только после подтверждения пользователя и не для файлов проекта.

## 10. Поддержание документов

- Любое изменение схемы БД, API-контракта, offline-потока или деплоя → обнови
  `docs/PROJECT_MAP.md` и `docs/ARCHITECTURE.md`; если меняешь поведение из AUDIT —
  обнови статус находки.
- Не создавай второй источник истины: `README.md` — краткий обзор, `AGENTS.md` — правила,
  `docs/` — детали. `GEMINI.md` — только указатель на этот файл.
- Если добавляешь крупное архитектурное решение — зафиксируй его в
  `docs/ARCHITECTURE.md` §14 «Решения и компромиссы» (и, если отменяет старое, отметь это).
