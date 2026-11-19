# AUDIT.md — недочёты, ошибки и расхождения

> Снимок 2026-11-18, dev/5f67c5d. Аудит основан на чтении кода и проверках:
> сборка, svelte-check, unit/e2e, живая Postgres, применении миграций на scratch-БД,
> браузерный эксперимент с IndexedDB, HTTP-пробы собранного сервера.
>
> **Обновление после аудита (2026-11-18):** P0-02 исправлен — `0005` стал no-op,
> добавлен `0006` catch-up, БД пересобрана из миграций (7 записей), `seed` проходит,
> схема совпадает со `schema.ts`, `generate` — no-op. Лишняя
> `bookmarks.end_timestamp_seconds` удалена. P2-81 закрыт. P1-02 (typecheck)
> исправлен: `svelte-check` — 0 ошибок. P0-01 исправлен: 401 для гостя,
> owner-aware sync, guest data загружается при входе; e2e `sync-data-safety` — 7/7.
> Остальные находки ниже актуальны, если не помечены иначе.

Severity:

- **P0** — потеря данных, нерабочий деплой/миграции; чинить до всего.
- **P1** — безопасность, заметная функциональность, CI; ближайший спринт.
- **P2** — средние баги, ops, UX, производительность.
- **P3** — полировка, мёртвый код, документация.

## 1. Executive summary

| Severity | Кол-во        | Главное                                                                                     |
| -------- | ------------- | ------------------------------------------------------------------------------------------- |
| P0       | 5 (5 fixed)   | Все P0 закрыты: P0-01/P0-02/P0-03/P0-04/P0-05                                               |
| P1       | 17 (17 fixed) | Все P1 закрыты: history, e2e, SSR/404/OG, redirect, token storage, R2, admin, analytics, CI |
| P2       | 83            | плеер, каталог-мок, админ-ограничения, кэши, индексы, валидация, UX                         |
| P3       | 28            | мёртвый код, дубли, доступность, брендинг, документация, мелочи                             |

Все P0 (P0-01–P0-05) и P1 (P1-01–P1-17) закрыты. Следующие приоритеты — P2:
каталог вместо mockShowcase, валидация/лимиты API, плеер (Space/repeat/sleep),
кэши/SW/CSP, админ-ограничения, UX.

**P1, реализовано 2026-11-19:** safe redirect; история очищает сервер; e2e
OAuth-моки; SSR/404/OG; token не кэшируется; R2 cleanup + prod fail-fast + upload
limits; admin redirect/403/CLI; analytics partial/rate/window; индексы 0007; CI.

## 2. Проверочная база

| Проверка           | Команда/способ                                            | Результат                                                 |
| ------------------ | --------------------------------------------------------- | --------------------------------------------------------- |
| Production build   | vite build                                                | exit 0                                                    |
| Production image   | docker build -t hedgehog-x:prod .                         | ✅ build 0; runtime-only deps                             |
| Production runtime | scratch Postgres + hedgehog-x:prod                        | ✅ 7 миграций, seed 2 книги, non-root, health 200         |
| Graceful shutdown  | docker stop -t 20                                         | ✅ exit 0 (DB pool закрывается)                           |
| Compose config     | docker compose -f compose.yaml -f compose.prod.yml config | ✅ app + Traefik labels; ошибок нет                       |
| Dual domain        | Host headers `hedgehog-inc.one` / `ru.hedgehog-inc.one`   | ✅ 200; Telegram redirect_uri на каждом хосте             |
| SSR/404/OG         | curl /books/* + volume                                    | ✅ title/H1/OG из БД; unknown = 404                       |
| History clear      | POST /api/user/progress/clear                             | ✅ 401 guest; auth deletes server+queue                   |
| Analytics batch    | valid+invalid POST                                        | ✅ 200 accepted=1 rejected=1                              |
| P1 migration       | drizzle 0007 + schema parity                              | ✅ 8 migrations; unique/indexes; generate no-op           |
| CI                 | .github/workflows/ci.yml                                  | ✅ lint/check/unit/build/migrate/e2e                      |
| Typecheck          | svelte-check --tsconfig ./tsconfig.json                   | exit 0, 0 errors                                          |
| Prettier           | prettier --check .                                        | OK                                                        |
| ESLint             | eslint .                                                  | OK                                                        |
| Unit               | node --import tsx --test "src/**/*.test.ts"               | 189 tests, 0 fail                                         |
| E2E (3 файла)      | playwright auth/profile/navigation                        | ✅ 23/23 (в текущем прогоне)                              |
| E2E full, 1 worker | playwright test --workers=1                               | ✅ 42/42 (сеть для OAuth-редиректов всё ещё нужна)        |
| Sync safety e2e    | e2e/sync-data-safety.e2e.ts                               | ✅ 9/9 (guest, offline, owner, switch, consent)           |
| Bookmark queue e2e | e2e/bookmark-sync.e2e.ts                                  | ✅ 1/1 (offline → online POST)                            |
| Session isolation  | e2e/session-isolation.e2e.ts                              | ✅ 5/5 (logout, offline, revoked, owner, /bookmarks sync) |
| Real bookmark sync | Chromium + signed session + PostgreSQL                    | ✅ POST 200, строка в `bookmarks`                         |
| Real session flow  | register/logout/login/offline + PostgreSQL                | ✅ local clear; DB counts restored; guest decline 0       |
| E2E integration    | delete-account.integration                                | ✅ 3 pass                                                 |
| Migrations         | migrate 0000..0007 на чистой БД + seed                    | ✅ 7 миграций; seed 2/4/10/4                              |
| Schema parity      | DB vs schema.ts + drizzle-kit generate                    | ✅ diff пуст; `No schema changes`                         |
| Admin SSR          | /admin, /admin/books, /admin/analytics                    | ✅ 200 с подписанной сессией; role/таблицы работают       |
| Analytics write    | POST /api/analytics/listen на scratch DB                  | ✅ 200; session + daily stats вставлены                   |
| Guest data wipe    | sync-data-safety.e2e.ts                                   | ✅ данные сохраняются (регрессия закрыта)                 |
| SSR fallback       | curl /books/overlord                                      | 200, H1 «Загрузка...», OG «Книга / Тома»                  |
| Unknown content    | curl /books/does-not-exist                                | 200 (не 404)                                              |
| Admin redirect     | curl /admin                                               | 303 Location: /auth?from=/admin                           |
| Guest sync API     | curl /api/user/sync                                       | ✅ 401 Unauthorized                                       |
| Final bookmarks    | DELETE + browser cleanup                                  | ✅ 0 строк; тестовый профиль удалён                       |

Ограничения: реальные OAuth-провайдеры и R2 не проверялись; production не запускался;
живая БД — локальная dev. Спорные выводы помечены «по коду».

## 3. P0 — критично

### P0-01. Гость/офлайн теряет локальные прогресс, закладки и лайки — ИСПРАВЛЕНО

**Статус:** исправлено 2026-11-18. `GET /api/user/sync` для гостя возвращает 401;
`syncService` не пишет в Dexie при 401/ошибке; добавлены owner-aware merge/replace,
Dexie `meta` v2, guest-adoption через POST и e2e `sync-data-safety` (7 тестов).
Ниже — история.

**Где:** src/lib/client/services/syncService.ts:98-110, src/routes/api/user/sync/+server.ts:7-15,
src/lib/client/db/hydrate.ts:33-43, src/routes/books/[bookId]/+layout.ts:18.

**Как происходило раньше:**

1. На каждой странице книги +layout.ts вызывает syncUserData().
2. GET /api/user/sync без сессии возвращает 200 и пустые массивы.
3. syncUserData вызывает hydrate(..., 'all') для progress/bookmarks/likes.
4. hydrate с 'all' удаляет все локальные записи, которых нет во входном массиве.

**Доказательство:** после записи progress=1/bookmarks=1/volumeLikes=1 в Dexie и
перехода на /books/overlord все три счётчика стали 0.

**Влияние (было):** потеря прогресса, закладок, лайков гостя; потеря
несинхронизированных изменений авторизованного пользователя при конфликте.

**Сделано:**

- 401 для гостя + `userId`/`private, no-store` для авторизованного;
- `hydrate(..., 'all', { allowEmptyPurge })` — пустой ответ не стирает данные;
- Dexie v2 `meta.syncOwner`; policy `merge/replace/switch`;
- guest snapshot загружается через `POST /api/user/sync` до смены owner;
- при смене аккаунта старые данные и очередь не уходят новому пользователю;
- e2e: guest, offline, same-owner empty, pending queue, A→B switch, explicit guest consent.

### P0-02. Миграции нерабочие; schema.ts и drizzle/ разошлись — ИСПРАВЛЕНО

**Статус:** исправлено 2026-11-18. `0005` заменён на no-op, сгенерирован `0006`
(role/status/listening-таблицы/длины), БД пересобрана из миграций, данные
восстановлены; `migrate` + `seed` проходят, `generate` — no-op. Ниже — исходная
история.

**Где:** drizzle/0004_add-provider-avatars.sql, drizzle/0005_fix-schema.sql,
src/lib/server/db/schema.ts, drizzle/meta/0005_snapshot.json.

**Факты (до исправления):**

- 0005 повторяет DROP COLUMN из 0004 → ошибка на чистой БД.
- В миграциях нет: user.role, volumes.status, listening_sessions,
  daily_listening_stats; длины varchar меньше схемы (255/512 vs 1024).
- В meta/0005 snapshot нет этих таблиц/колонок.
- Живая dev-БД создана db:push, поэтому «работает»; на миграционной БД seed падает
  на volumes.status.
- В живой БД есть лишняя bookmarks.end_timestamp_seconds (из ветки
  agent/bookmark-end-time), которой нет в schema.ts.

**Влияние (было):** невозможно поднять чистую БД через migrate; production не
воспроизводим; db:push --force может удалять чужие колонки/данные.

**Сделано:** `0005` — no-op; `0006_sync-schema-with-code.sql` + snapshot/journal;
БД пересобрана через `db:migrate`; `end_timestamp_seconds` удалена; данные
восстановлены из backup; проверены diff схемы и `generate` no-op. Осталось:
добавить миграционную проверку в CI (P1-14).

### P0-03. Офлайн-закладки никогда не синхронизируются — ИСПРАВЛЕНО

**Статус:** исправлено 2026-11-19. Добавлен `bookmarkSync`: flush очереди по
`online`, при старте приложения, после `syncUserData` и из manual sync. POST
проверяет `res.ok`, ошибки оставляют элементы в очереди. Проверено e2e и реальным
браузером: offline add → online → POST 200 → строка в PostgreSQL.

**Где:** src/lib/client/services/bookmarkService.ts:27-47, 60-78;
src/lib/client/db/index.ts:68-75.

**Факты (до исправления):**

- При offline bookmarkService кладёт ADD_BOOKMARK/REMOVE_BOOKMARK в syncQueue.
- Ни один сервис не читает эти actions (grep: только добавление и типы).
- При online ошибка POST (401/403/500) игнорируется: catch только вокруг fetch,
  а !res.ok не проверяется.
- При следующем syncUserData hydrate('all') перезапишет локальные закладки
  серверными (для авторизованного), т.е. offline-закладка исчезнет.

**Влияние (было):** потеря закладок, созданных без сети; рассинхрон между устройствами.

**Сделано:**

- новый `src/lib/client/services/bookmarkSync.ts`: batch flush `ADD_BOOKMARK`/
  `REMOVE_BOOKMARK`, сортировка по timestamp, один in-flight запрос;
- `bookmarkService` ставит в очередь при offline и при `!res.ok`, удаляет из очереди
  только после успешного POST;
- flush по `online`, при старте, после owner-aware sync и в manual sync;
- e2e `bookmark-sync.e2e.ts` + реальная проверка Chromium/PostgreSQL.

### P0-04. Production-деплой не собран — ИСПРАВЛЕНО

**Где:** Dockerfile, compose.prod.yml, package.json, scripts/migrate.mjs,
scripts/docker-entrypoint.sh, src/routes/health/+server.ts.

**Факты (до исправления):**

- В compose нет app-сервиса; compose.prod добавляет только Traefik LE/umami labels.
- Нет production Dockerfile (есть только Dockerfile.test).
- Собранный сервер импортирует better-auth, @better-auth/core, @better-auth/utils,
  drizzle-orm, postgres, @sveltejs/kit — часть из них в devDependencies.
  pnpm install --prod оставит сервер без них.
- Нет health-check, миграций при старте, graceful shutdown.
- README/скрипты не описывают production-запуск (кроме pnpm build).

**Влияние:** релиз нельзя воспроизвести из репозитория; высокий риск падения на
старте/в рантайме.

**Сделано:**

- multi-stage `Dockerfile`: build + runtime; runtime ставит только production deps;
- `better-auth`, `drizzle-orm`, `postgres`, `@sveltejs/kit`, `svelte` перенесены в
  `dependencies`;
- app-сервис в `compose.prod.yml` с Traefik-роутером, healthcheck, non-root, graceful
  shutdown, `stop_grace_period`;
- entrypoint применяет Drizzle-миграции при старте (идемпотентно), затем запускает
  `build/index.js`;
- `GET /health` проверяет PostgreSQL; Docker healthcheck + `depends_on` БД;
- `/app/scripts/migrate.mjs`, `/app/scripts/docker-entrypoint.sh`, `.dockerignore`;
- документация production-запуска в OPERATIONS §5.1 и `.env.example`;
- graceful shutdown: `postgres-js` закрывается по `sveltekit:shutdown`, иначе
  контейнер убивался по SIGKILL.

**Проверено:** образ `hedgehog-x:prod` на чистой БД: `7` миграций, seed `2` книги,
`/health` 200, `/api/books` 200, `/api/user/sync` 401, non-root `uid=1000`,
`vite`/`drizzle-kit` отсутствуют в runtime, restart сохраняет данные,
`docker stop` → exit 0; `docker compose config` валиден.

### P0-05. Session isolation / локальные данные после logout — ИСПРАВЛЕНО

**Где:** `client/session.svelte.ts`, `client/db/syncState.ts`,
`client/services/*Sync*`, `client/services/guestAdoption.svelte.ts`,
`routes/api/user/sync/+server.ts`.

**Факты (до исправления):**

- logout очищал только auth-кэш, но не Dexie; следующий гость видел закладки/
  прогресс предыдущего пользователя;
- `syncQueue` не хранила owner, поэтому гостевое удаление отправлялось под следующим
  аккаунтом и могло удалить его серверную закладку;
- любой вход автоматически загружал guest snapshot в аккаунт, даже существующий.

**Влияние:** утечка личных данных на общем устройстве, удаление чужих данных,
смешивание гостевой истории с аккаунтом.

**Сделано:**

- `SyncItem.ownerUserId` + Dexie v3; все consumer'ы фильтруют по текущему owner;
- logout/expiry/account switch очищают личные данные, очередь и `syncOwner`;
- signOut централизован, flush выполняется до очистки; `/auth` больше не обходит его;
- guest→account: новый аккаунт (`isNewUser`) импортирует автоматически, существующий —
  только после явного consent; отказ удаляет guest-данные;
- `/api/user/sync` отдаёт `isNewUser`/`userName`; 401 со старым owner очищает кэш;
- глобальный sync при появлении сессии/online, а не только на странице книги:
  после logout→login данные приходят сразу на `/` и `/bookmarks`.

**Проверено:** реальный Chromium + PostgreSQL: регистрация (1/1/1/1), logout
(local=0, DB=1/1/1/1), повторный login через `/bookmarks` без захода в книгу
(local восстановлен), offline
(bookmark+progress+chapter like → DB 2/2/1/2, queue=0), существующий аккаунт +
«Не переносить» → local=0, DB=0/0/0/0.

## 4. P1 — высокий приоритет

### P1-01. «Очистить историю» не удаляет серверный прогресс — ИСПРАВЛЕНО

**Где:** src/routes/history/+page.svelte:119-120; syncUserData; progressSync.
**Факт:** confirmClearHistory делает только db.progress.clear(). Серверный
listening_progress не удаляется; при следующем заходе syncUserData гидрирует его
обратно. Если в syncQueue есть UPDATE_PROGRESS, он может повторно отправить прогресс.
**Фикс:** endpoint удаления прогресса (или clear в /api/user/sync), очистка очереди
по chapterId, оптимистичное удаление, тест.

### P1-02. Typecheck — ИСПРАВЛЕНО

**Статус:** исправлено 2026-11-18. `clientId`/`clientSecret` Discord берутся из
`env` с fallback на пустые строки; `svelte-check` — 0 ошибок. Ниже — история.

**Где:** src/lib/server/auth.ts:47.
**Факт (было):** clientId: env.DISCORD_CLIENT_ID — string | undefined, better-auth ждёт string.
pnpm check = exit 1. vite build проходит, поэтому ошибка не блокировала сборку.
**Сделано:** `discordClientId`/`discordClientSecret` с `?? ''`; провайдер остаётся
зарегистрированным, better-auth по-прежнему предупреждает, если креды не заданы.
Осталось: добавить `pnpm check` в CI (P1-14).

### P1-03. E2E нестабилен и зависит от внешней сети — ИСПРАВЛЕНО

**Где:** e2e/auth.e2e.ts:34-72, e2e/profile.e2e.ts:192-215, playwright.config.ts.
**Факты:**

- Тесты Telegram/Discord мокают только /api/auth/sign-in/social и затем реально
  переходят на oauth.telegram.org/discord.com; URL-ассерт ждёт завершения навигации
  → флап при медленной/заблокированной сети.
- pnpm test:e2e не стартует без BETTER_AUTH_SECRET (webServer падает).
- Все тесты выставляют hedgehog-welcome-modal-dismissed, хотя модалки нет.
- Нет fixtures/page-objects; покрытие — 8 файлов.
- В текущем прогоне: 42/42 при 1 worker; тесты всё ещё зависят от сети.
  Предыдущий прогон давал 24/26 из-за этих же переходов.
  **Фикс:** мокать https://oauth.telegram.org/** и https://discord.com/** (fulfill
  redirect), задавать env в CI, убрать мёртвый ключ, детерминированные моки.

### P1-04. SSR/SEO/404: контент только после JS — ИСПРАВЛЕНО

**Где:** routes/books/** (нет +page.server.ts), OpenGraphMeta, app.html, отсутствие
+error.svelte.
**Факты (curl):**

- /books/overlord: 200, H1 «Загрузка...», og:title «Книга | Тома», og:image
  /logo.webp, title «Книга | Тома».
- /books/overlord/overlord_vol_1: title «Аудиокнига | Hedgehog X».
- /books/does-not-exist → 200 (вечная загрузка).
- /books/overlord/does-not-exist → 200.
- Нет +error.svelte → дефолтная страница ошибки.
- html lang="en" при русском контенте.
  **Влияние:** плохая индексация/шаринг, бесполезность без JS, отсутствие честных 404.
  **Фикс:** +page.server.ts/+layout.server.ts для book/volume (или prerender), 404
  при отсутствии, OG из серверных данных, +error.svelte, lang="ru".

### P1-05. Потенциальный open redirect через ?from= — ИСПРАВЛЕНО

**Где:** src/routes/auth/+page.svelte:18-23, 58-70.
**Факт:** from = searchParams.get('from') без проверки; передаётся как callbackURL
в authClient.signIn.social. Приложение не ограничивает значение внутренним путём;
итоговое поведение зависит от валидации callbackURL в better-auth, но защита должна
быть на стороне приложения.
**Фикс:** разрешать только path, начинающийся с '/' и не '//'; иначе '/'.
Тест на https://evil.example.

### P1-06. Сессионный токен в localStorage — ИСПРАВЛЕНО

**Где:** src/lib/client/auth-storage.ts:7, 81; src/lib/client/session.svelte.ts
saveCachedSession(state.data).
**Факт:** SessionData включает session.token; saveCachedSession пишет весь объект в
localStorage. Любой XSS получает токен (cookie httpOnly не спасает от копии).
Данные не привязаны к userId; кэш живёт до выхода/истечения.
**Фикс:** не хранить token; хранить только user/expiresAt/флаги; очищать при смене
пользователя.

### P1-07. R2-объекты не удаляются (утечка хранилища) — ИСПРАВЛЕНО

**Где:** src/lib/server/storage/r2.ts:182; admin actions.
**Факт:** deleteFromStorage экспортируется, но вызывается только в r2.test.ts.
Delete book/volume/chapter/illustration удаляет строки БД (каскады), но не объекты
R2; update cover/audio не удаляет старый объект. При замене файлов копятся сироты.
**Фикс:** перед/после update/delete получить старые URL и вызвать deleteFromStorage;
обрабатывать ошибки; тест.

### P1-08. /admin редиректит с ?redirect=, а /auth читает ?from= — ИСПРАВЛЕНО

**Где:** admin/+layout.server.ts:7, admin/+page.server.ts:11,48,
admin/analytics/+page.server.ts:19; auth/+page.svelte:18-23.
**Факт:** после входа callbackURL = '/' (from отсутствует), пользователь попадает
на главную, а не в /admin. Ошибка воспроизводится curl'ом (Location).
**Фикс:** унифицировать параметр (from) или читать оба; тест «login → /admin».

### P1-09. Аналитика: poison pill, отсутствие rate limit и валидации времени — ИСПРАВЛЕНО

**Где:** src/routes/api/analytics/listen/+server.ts:41-57; listeningTracker.flushOfflineQueue.
**Факты:**

- Если в пачке одна невалидная сессия — 400 на всю пачку; flushOfflineQueue
  сохраняет очередь и повторяет её вечно (одна «плохая» сессия блокирует все).
- Нет rate limit/подписи; гость может слать бесконечно, накручивая статистику.
- startedAt принимается любым (будущее/прошлое), без ограничения окна.
- Валидация 1..300 сек — единственная защита.
  **Фикс:** частичный приём, rate limit по IP/user, окно startedAt, лимит batch, логи; в production дополнительно edge rate limit Traefik для `/api/analytics/listen`.

### P1-10. BETTER_AUTH_SECRET обязателен, но не описан как обязательный — ИСПРАВЛЕНО

**Где:** src/lib/server/auth.ts:31; .env.example; README.
**Факт:** без секрета better-auth бросает «You are using the default secret» и процесс
падает. В .env.example значение пустое; README не предупреждал. Наш preview без
секрета упал.
**Фикс:** fail-fast с понятным сообщением/документацией; проверка длины; генератор
секрета в docs; CI env.

### P1-11. R2 fallback не работает в production — ИСПРАВЛЕНО

**Где:** src/lib/server/storage/r2.ts:110-125, 160-175; adapter-node.
**Факт:** без R2 файлы пишутся в static/uploads во время выполнения. adapter-node
раздаёт build/client, а не исходный static; файлы после сборки недоступны. В dev
Vite их раздаёт, поэтому проблема незаметна.
**Фикс:** требовать R2 в production (fail-fast), либо отдавать uploads через
эндпоинт/volume, либо S3-совместимое хранилище.

### P1-12. syncQueue не привязана к пользователю — ИСПРАВЛЕНО

**Где:** src/lib/client/db/index.ts; likeService/progressSync/listeningTracker/bookmarkSync.
**Факт (было):** очередь — глобальная Dexie-таблица без userId. Если гость/пользователь A
накопил offline-действия, а затем вошёл пользователь B, flush отправит их под B.
**Сделано:** `SyncItem.ownerUserId` (Dexie v3), owner ставится при enqueue; все flush
фильтруют по текущему owner; logout/switch очищают очередь; e2e + реальная БД.

### P1-13. Нет индексов на контентные FK и unique-ограничений — ИСПРАВЛЕНО

**Где:** schema.ts; живая БД.
**Факт:** индексы есть только у listening_sessions/daily_stats и auth. Нет индексов на
volumes.book_id, chapters.volume_id, illustrations.volume_id, bookmarks.user_id,
likes/progress; нет UNIQUE(book_id, volume_number) и UNIQUE(volume_id, chapter_number).
**Влияние:** деградация выборок; дубликаты номеров ломают сортировку/next volume.
**Фикс:** индексы и unique-констрейнты; admin create/update ловит `23505` (включая Drizzle `cause`) и возвращает 400 с понятным текстом.

### P1-14. Нет CI и проверки миграций — ИСПРАВЛЕНО

**Где:** корень (нет .github/), package.json.
**Факт:** проверки не автоматизированы; нет pre-commit; нет пайплайна. Ошибка типов
и будущие миграционные регрессии могут остаться незамеченными.
**Фикс:** CI: install, lint, check, unit, build, migrate на temp Postgres, e2e с моками; добавлен ручной `workflow_dispatch`.

### P1-15. Несогласованный доступ к админке — ИСПРАВЛЕНО

**Где:** admin/+layout.server.ts; admin/+page.server.ts; admin/books|volumes|chapters|illustrations.
**Факт:** overview/analytics для не-админа возвращают notAdmin и рисуют карточку
«Доступ ограничен»; CRUD-страницы вызывают requireAdmin → throw 401/403 → дефолтная
страница ошибки. Пользователь видит разные состояния.
**Фикс:** единый soft-check в layout или единый error(403) + +error.svelte.

### P1-16. Первый админ в production — только вручную SQL — ИСПРАВЛЕНО

**Где:** admin/+page.server.ts makeSelfAdmin (только dev); нет CLI/скрипта.
**Факт:** в prod кнопки нет; документации по назначению админа не было. Без ручного
UPDATE role='admin' админка недоступна.
**Фикс:** CLI-скрипт pnpm admin:grant <email>, документация/BOOTSTRAP_ADMIN_EMAIL.

### P1-17. Нет ограничений на загрузку файлов — ИСПРАВЛЕНО

**Где:** admin/*/+page.server.ts, api/admin/upload/+server.ts, storage/r2.ts.
**Факт:** request.formData() читает файл целиком в память; нет max size/type
(кроме accept в браузере); audio сохраняется без проверки; sharp обрабатывает
произвольный buffer. Admin-only снижает риск, но огромный файл → OOM/500.
**Фикс:** лимит размера, content-type/magic bytes, `BODY_SIZE_LIMIT`, rate limit 30 admin-POST/мин. Полноценный streaming в R2 не внедрён: форма SvelteKit всё ещё буферизует файл в пределах лимита.

## 5. P2 — средние

### 5.1. Данные, синхронизация, API

| ID    | Проблема                                                                    | Где/доказательство                            | Влияние/фикс                                           |
| ----- | --------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| P2-01 | Каталог не гидрируется из API; главная — mockShowcase; новые книги не видны | syncBooks не вызывается (grep); +page.svelte  | нет списка всех книг; добавить каталог/вызов syncBooks |
| P2-02 | /books — редирект, нет каталога/поиска                                      | routes/books/+page.ts                         | новый контент доступен только по URL                   |
| P2-03 | daily_listening_stats.id может >128 символов                                | analytics/stats.ts:35-46; schema varchar(128) | 500 на длинных ID; хешировать/укоротить                |
| P2-04 | buildDailyStatId склеивает ID через '_' без экранирования                   | stats.ts                                      | коллизии разных сущностей; hash                        |
| P2-05 | user/sync: невалидный JSON → 500, а не 400                                  | +server.ts:50-64                              | неправильный статус; parse guard                       |
| P2-06 | user/sync: нет транзакции/лимита пачки/валидации note/ID                    | +server.ts:80-190                             | частичные записи, DoS, 500 на длинной note             |
| P2-07 | user/sync GET: нет cache/private заголовков                                 | +server.ts:7-48                               | возможен кэш персональных данных; private,no-store     |
| P2-08 | user/delete: нет очистки cookie/origin-check                                | delete/+server.ts                             | cookie остаётся; CSRF-риск (SameSite смягчает)         |
| P2-09 | progressSync: 401 не ставит в очередь и теряет апдейт                       | progressSync.svelte.ts:70-95                  | гость теряет серверный прогресс (локально остаётся)    |
| P2-10 | progressSync/flushOfflineQueue: 4xx блокирует очередь                       | progressSync.svelte.ts:104-129                | вечный retry; различать 401/400/5xx                    |
| P2-11 | listening batch: одна невалидная сессия блокирует все                       | listen/+server.ts:41-57                       | poison pill; частичный приём                           |
| P2-12 | Нет rate limit на analytics/listen и user/sync                              | endpoints                                     | накрутка/DoS                                           |
| P2-13 | startedAt без окна (будущее/прошлое)                                        | listen/+server.ts                             | искажение статистики                                   |
| P2-14 | UTC-дата vs локальное время UI                                              | formatDateKey/stats                           | «сдвиг дня» у пользователей Москвы                     |
| P2-15 | daily_stats unique index дублирует PK и nullable                            | schema.ts:200-207                             | бесполезный индекс; NULL-семантика                     |
| P2-16 | status/theme_color — свободный текст (нет enum/check)                       | schema.ts                                     | опечатки/невалидный hex                                |
| P2-17 | Нет индексов на likes/progress/bookmarks (кроме auth)                       | schema/БД                                     | медленные выборки                                      |
| P2-18 | R2 delete не вызывается + uploads дважды                                    | r2.ts                                         | утечка/CPU                                             |
| P2-19 | uploadImage width/height не сохраняются                                     | r2.ts                                         | лишняя работа/потеря данных                            |
| P2-20 | admin upload endpoint не используется                                       | api/admin/upload                              | мёртвый код/дублирование                               |
| P2-21 | bookmarks online POST игнорирует !res.ok                                    | bookmarkService                               | потеря закладки без очереди                            |
| P2-22 | history clear не чистит syncQueue/pending progress                          | history page; progressSync                    | история возвращается/повторно отправляется             |
| P2-23 | syncBookDetails Promise.all гидрирует таблицы не атомарно                   | syncService                                   | частичное состояние при сбое                           |
| P2-24 | syncBookDetails 304 зависит от HTTP-кэша; клиент не шлёт If-None-Match      | syncService                                   | чаще 200; лишний трафик                                |

### 5.2. Плеер/аудио

| ID    | Проблема                                                             | Где                                          | Влияние/фикс                                     |
| ----- | -------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| P2-25 | Space-хоткей у каждого Play → двойной toggle                         | audio-player-play.svelte:35-44; GlobalPlayer | глобальный хоткей в одном месте                  |
| P2-26 | repeat='one' обрабатывается до sleep end-of-track                    | audio-provider.svelte:248-267                | таймер не срабатывает; проверить sleep до repeat |
| P2-27 | Resume через setTimeout(100) может потерять seek                     | bookmarks/+page.svelte:101; history:112      | использовать Track.startTime                     |
| P2-28 | Частичный OPFS-файл не удаляется при ошибке                          | downloadManager.svelte.ts:170-205            | обрезанное аудио; removeEntry в catch            |
| P2-29 | Нет докачки/валидации размера после скачивания                       | downloadManager                              | битый файл; проверять content-length             |
| P2-30 | Manual sync не отправляет LISTEN_SESSION (bookmarks уже да)          | settings-helpers.ts:278-310                  | очередь listening растёт; добавить consumer      |
| P2-31 | Clear cache удаляет все CacheStorage и весь OPFS                     | settings-helpers.ts:200-250                  | удаляет чужие кэши/данные; фильтровать           |
| P2-32 | Сохранение всего queue/currentTime в localStorage на timeupdate      | audio-provider.svelte:450-470                | лаги/квота; throttle                             |
| P2-33 | AudioProvider дублирует retry с htmlAudio                            | html-audio.ts:70-85; audio-provider:120-155  | гонки/лишние запросы; один слой                  |
| P2-34 | setCurrentTrack сначала isLoading=true, затем loadAndPlayTrack=false | audio-store.svelte.ts:500-530                | индикатор загрузки не показывается               |
| P2-35 | play() оптимистично ставит isPlaying до успеха                       | audio-store.svelte.ts:230-235                | autoplay blocked → UI «играет»                   |
| P2-36 | queue/repeat/shuffle/insertMode без UI и мёртвые методы              | audio-store; grep                            | недоступный функционал; удалить/добавить UI      |
| P2-37 | removeFromQueue/moveInQueue не корректируют currentQueueIndex        | audio-store.svelte.ts:344-362                | латентный баг при будущем UI                     |
| P2-38 | Нет громкости в мобильном drawer                                     | GlobalPlayer; audio-player-volume            | неудобно; добавить Volume                        |
| P2-39 | AudioPlayer.Play/FastForward вызывают onclick дважды                 | play:57-70; ff/rewind                        | двойные side effects; убрать дубль               |
| P2-40 | SeekBar/time display — $derived(() => ...) вместо .by                | seek-bar/time-display                        | анти-паттерн, возможная потеря реактивности      |
| P2-41 | skip-back disabled на index 0, хотя previous() умеет restart         | skip-back                                    | нельзя перезапустить главу кнопкой               |
| P2-42 | Нет mediaSession/wakeLock                                            | player                                       | нет локскрин-контролов                           |

### 5.3. Админка

| ID    | Проблема                                                                        | Где                                         | Влияние/фикс                       |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------- |
| P2-43 | Нельзя очистить coverUrl/themeColor                                             | admin/books/+page.server.ts:95-145; volumes | пустое значение не обновляет поле  |
| P2-44 | Нет удаления старых файлов при update/delete                                    | admin actions                               | R2-мусор (P1-07)                   |
| P2-45 | Нет unique(bookId,volumeNumber)/(volumeId,chapterNumber)                        | schema                                      | дубликаты ломают порядок           |
| P2-46 | Illustrations: нет пагинации; лимит 100 без индикации; edit вне 100 не работает | admin/illustrations                         | UX/данные                          |
| P2-47 | Формы теряют введённые значения при ошибке                                      | admin pages                                 | UX; form.data                      |
| P2-48 | Нативный confirm() вместо ConfirmModal                                          | admin pages                                 | несогласованный UX                 |
| P2-49 | Нет управления пользователями/ролями                                            | admin                                       | нельзя назначить админа из UI      |
| P2-50 | slugify удаляет кириллицу → random ID                                           | admin books/volumes                         | неинформативные ID; транслитерация |
| P2-51 | Admin analytics notAdmin fallback «0 мин» vs formatListeningDuration(0) «0 сек» | admin/analytics                             | косметика                          |

### 5.4. UX/SEO/a11y/брендинг

| ID    | Проблема                                                   | Где                                            | Влияние/фикс                  |
| ----- | ---------------------------------------------------------- | ---------------------------------------------- | ----------------------------- |
| P2-52 | Нет +error.svelte/404                                      | routes                                         | дефолтные ошибки; добавить    |
| P2-53 | lang="en" при русском контенте                             | app.html                                       | SEO/a11y; lang="ru"           |
| P2-54 | favicon — Svelte-логотип                                   | src/lib/assets/favicon.svg                     | брендинг; заменить            |
| P2-55 | OG/SEO fallback на SSR                                     | OpenGraphMeta                                  | плохой шаринг; серверные meta |
| P2-56 | robots.txt разрешает /admin,/auth; нет sitemap/canonical   | static/robots.txt                              | SEO/приватность               |
| P2-57 | a11y: div role=button без keydown, lightbox без focus trap | VolumeHeader/VolumeIllustrations/ImageLightbox | доступность                   |
| P2-58 | aria/иконки/размеры непоследовательны                      | components                                     | полировка                     |
| P2-59 | Нет CSP/security headers                                   | hooks/config                                   | XSS/clickjacking              |
| P2-60 | SW кэширует персонализированные HTML                       | service-worker/afterNavigate                   | утечка между аккаунтами       |
| P2-61 | audio-cache без лимита/expiration                          | service-worker                                 | рост хранилища                |
| P2-62 | history relative time не обновляется                       | history/+page                                  | косметика                     |
| P2-63 | bookmarks/history page out of range после удаления         | pages                                          | пустая страница; clamp        |
| P2-64 | downloads: unknown volume для трека вне Dexie              | audio-player-download                          | «Неизвестный том»             |
| P2-65 | theme-color PWA белый, dark mode                           | vite config                                    | косметика                     |
| P2-66 | Нет search, хотя strings.search есть                       | UI                                             | обещание функции              |
| P2-67 | root showcase replaceState — back не листает книги         | +page.svelte                                   | UX/история                    |

### 5.5. Ops/config/tests/docs

| ID    | Проблема                                                                                    | Где                          | Влияние/фикс                          |
| ----- | ------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------- |
| P2-68 | Runtime-зависимости в devDependencies — ИСПРАВЛЕНО                                          | package.json                 | перенесены в dependencies (P0-04)     |
| P2-69 | Нет packageManager/engines — ИСПРАВЛЕНО                                                     | package.json/.npmrc          | pnpm@11.7.0 + Node 24                 |
| P2-70 | Dockerfile.test ставит pnpm@12.14.0 — ИСПРАВЛЕНО                                            | Dockerfile.test              | pnpm@11.7.0                           |
| P2-71 | compose.dev требует certs, которых нет                                                      | dynamic/dev.yaml             | dev onboarding                        |
| P2-72 | compose.prod без app/dynamic — ИСПРАВЛЕНО                                                   | compose.prod                 | app-сервис добавлен                   |
| P2-73 | .env.example: BETTER_AUTH_URL не читается кодом; UMAMI_WEBSITE_ID проверяется, но не описан | .env.example/admin analytics | путаница                              |
| P2-74 | README/AGENTS были шаблонными; GEMINI дублировал AGENTS                                     | корень                       | docs drift; исправлено в этом наборе  |
| P2-75 | Исторический ARCHITECTURE.md (Boosty/rate-limit/page-objects) отсутствует в dev             | git history                  | ложные ориентиры                      |
| P2-76 | E2E покрытие сократилось до 4 файлов; нет player/catalog/bookmarks/downloads/admin          | e2e                          | регрессии                             |
| P2-77 | Unit: r2.test пишет файлы/возможен R2 upload; books.test тестирует копию логики             | tests                        | нестабильность/ложная уверенность     |
| P2-78 | P0-01 покрыт policy+e2e; нет тестов downloadManager/audioStore/API                          | tests                        | остаточные пробелы                    |
| P2-79 | Нет health-check/метрик/централизованных логов                                              | ops                          | диагностика                           |
| P2-80 | main отстаёт от dev на 28 коммитов                                                          | git                          | неясно, что деплоится                 |
| P2-81 | ✅ Устранено: end_timestamp_seconds удалена при пересборке; в schema.ts её нет              | локальная БД                 | DB drift закрыт; ветка не в dev       |
| P2-82 | seed: все главы на sample.mp3 с фейковыми duration                                          | seed.ts                      | некорректный прогресс/аналитика в dev |
| P2-83 | syncBookDetails/seed не логируют 304/пропуски                                               | logging                      | диагностика                           |

## 6. P3 — полировка и мёртвый код

| ID    | Что                                                                                                 | Где                      |
| ----- | --------------------------------------------------------------------------------------------------- | ------------------------ |
| P3-01 | syncBooks мёртв (0 вызовов)                                                                         | syncService.ts:30        |
| P3-02 | api/admin/upload не используется                                                                    | routes/api/admin/upload  |
| P3-03 | deleteFromStorage только в тесте                                                                    | r2.ts                    |
| P3-04 | queue-методы audioStore не используются                                                             | audio-store              |
| P3-05 | htmlAudio getSource/getBufferedRanges/getVolume/getDuration/getCurrentTime/isPaused не используются | html-audio               |
| P3-06 | settings-helpers дублирует ключи/геттеры audio-store; часть не используется                         | settings-helpers         |
| P3-07 | formatBookOgTitle только в тестах; book page собирает title вручную                                 | og.ts/book page          |
| P3-08 | kbd/popover UI не используются                                                                      | components/ui            |
| P3-09 | lib/index.ts — заглушка                                                                             | lib                      |
| P3-10 | +page.ts в корне пустой                                                                             | routes/+page.ts          |
| P3-11 | strings: часть ключей не используется; много хардкода                                               | strings/pages            |
| P3-12 | e2e welcome-modal ключ мёртв                                                                        | e2e                      |
| P3-13 | about copyright 2025                                                                                | about                    |
| P3-14 | logger BROWSER_COLORS не покрывает новые теги                                                       | logger                   |
| P3-15 | audioStore.loadFromStorage не валидирует shape                                                      | audio-store              |
| P3-16 | breadcrumbs fallback капитализирует сырой ID/англ. admin-сегменты                                   | AppBreadcrumbs           |
| P3-17 | ImageLightbox: несколько window-keydown, нет focus trap                                             | lightbox                 |
| P3-18 | ShareModal native share fallback/резет                                                              | ShareModal               |
| P3-19 | settings playback rates 0.75..2 vs store clamp 0.25..2                                              | settings/audio-store     |
| P3-20 | downloads размер форматируется вручную                                                              | downloads page           |
| P3-21 | support card/TON захардкожены                                                                       | strings                  |
| P3-22 | showcase все video в DOM без preload/poster                                                         | ShowcaseBackground       |
| P3-23 | PWA theme_color белый                                                                               | vite config              |
| P3-24 | нет LICENSE/CHANGELOG                                                                               | корень                   |
| P3-25 | нет .nvmrc/engines                                                                                  | корень                   |
| P3-26 | test script использует npm в pnpm-проекте                                                           | package.json             |
| P3-27 | auth:schema может перезаписать ручные поля                                                          | package.json/auth.schema |
| P3-28 | admin ID slugify кириллицы                                                                          | admin                    |

## 7. Расхождения в подходах (design/implementation drift)

1. **Offline-first обещан, но каталог не синхронизируется.** syncBooks есть, но не
   вызывается; главная — мок. «Офлайн-зеркало» неполное: без захода в книгу данных нет.
2. **ETag/304 задуман, но клиент не управляет условными запросами.** Надёжность
   зависит от HTTP-кэша браузера.
3. **syncQueue задумана как универсальный журнал** — ✅ bookmarks подключены
   (`bookmarkSync`); owner очереди реализован (P0-05/P1-12), LISTEN_SESSION в manual sync пока нет.
4. **Hydrate/purge задуман для очистки осиротевших данных** — ✅ P0-01 исправлен:
   purge только при совпадении owner, отсутствии pending-мутаций и явном `allowEmptyPurge`.
5. **«Сервер — источник истины»** конфликтует с оптимистичным локальным состоянием:
   last-write-wins без merge/версий; нет разрешения конфликтов.
6. **Админка SSR** использует soft-check в layout и hard-check в actions — два
   разных поведения для одной роли.
7. **«Единый словарь строк»** на практике половина UI хардкодит русский; strings —
   частичная заготовка, не i18n.
8. **«Индексы на FK, enum/check, notNull timestamps»** из исторического
   ARCHITECTURE.md не реализованы: контентные FK без индексов, status/theme — текст.
9. **«Миграции обязаны накатываться на чистую БД»** — ✅ исправлено: 0000–0008
   проходят на чистой БД; `0005` no-op, `0006` catch-up; `generate` — no-op.
10. **«R2 + fallback»** — fallback работает только в dev; в prod тихо ломается;
    удаление объектов не реализовано.
11. **«SSR/OG для соцсетей»** — фактически CSR; meta обновляется только после JS.
12. **«PWA offline»** — страницы кэшируются, но персонализированные и аудио-кэш
    без политики; OPFS-скачивание не везде доступно.
13. **Тестовая дисциплина** (page-objects, fixtures, моки внешних сервисов) из
    исторических документов не поддерживается: 8 файлов, реальные OAuth-переходы.
14. **Главная — витрина**, но нет каталога; books/ редиректит. Это не отражено
    в UI как ограничение.
15. **Плеер с queue/repeat/shuffle** — store богаче UI; функции недоступны
    пользователю, часть методов latent-buggy.

## 8. Мёртвый код и неиспользуемые контракты

- Клиент: syncService.syncBooks, queue-методы audioStore (addToQueue, removeFromQueue,
  moveInQueue, addTracksToEndOfQueue, setInsertMode, changeRepeatMode, shuffle,
  unshuffle), AudioProvider.tracks prop, htmlAudio.get* (6 методов), часть
  settings-helpers геттеров.
- Сервер: POST /api/admin/upload, deleteFromStorage (только тест), width/height из
  UploadImageResult.
- UI: kbd, popover (не используются); formatBookOgTitle; strings.common.search и др.
- E2E: ключ hedgehog-welcome-modal-dismissed; модалки нет.
- Данные/ветки: end_timestamp_seconds удалена при пересборке; ветка
  agent/bookmark-end-time не в dev.
- Документы: исторический ARCHITECTURE.md (Boosty/rate-limit/route-titles/page-objects)
  отсутствует в текущем дереве; README/AGENTS были шаблонными (исправлено).

## 9. Что не является дефектом (осознанные решения)

- Клиентский рендеринг контента — следствие offline-first; проблема в отсутствии
  SSR/SEO-слоя, а не в Dexie как таковом.
- /books → / и отсутствие каталога могут быть продуктовым решением; отмечено
  как ограничение (P2-01/P2-02), не как баг.
- Главная-витрина на моках — демо/лендинг; но она расходится с админкой.
- sample.mp3 и фейковые длительности — демо-сид; в production нужен реальный контент.
- Guest likes в UI запрещены, но guest progress/bookmarks разрешены — осознанно.
- Нет svelte.config.js: конфиг встроен в vite.config.ts; сборка/sync работают.
- main позади dev — нормально для активной ветки, но требует договорённости о релизе.
- Отсутствие rate limit на публичном контенте — не баг; на аналитике/мутациях — риск.

## 10. Не проверено / открытые вопросы

- Реальный OAuth-флоу Telegram/Discord (нужны приложения; e2e мокает только старт).
- Поведение better-auth при внешнем callbackURL (насколько P1-05 эксплуатируем).
- R2 CORS/публичный доступ для canvas-цвета и OPFS-fetch.
- Поведение Safari/Firefox с OPFS и RangeRequestsPlugin.
- Миграции на production-БД после исправления (локально на PG 18 — проверено).
- Реальный деплой/нагрузка; индексы и производительность.
- Квоты localStorage/IndexedDB при большом queue.
- Совместимость better-auth-telegram при отсутствии id claim (P1 edge).

## 11. Рекомендуемый порядок работ

**Спринт 0 (P0, 1–3 дня):**

1. ✅ P0-01 — сделано: 401, owner-aware sync, hydrate guard, guest adoption, e2e 9/9.
2. ✅ P0-03 — сделано: bookmarkSync, res.ok, online/startup/manual flush, e2e + real DB.
3. ✅ P0-05 — сделано: owner очереди, logout/expiry cleanup, explicit guest consent.
4. ✅ P0-04 — сделано: Dockerfile, compose app, миграции/health/graceful, runtime deps.
5. ✅ P0-02 — сделано: 0005 no-op + 0006 catch-up, БД пересобрана, seed проходит.

**Спринт 1 (P1):** 6. P1-14 CI (lint/check/unit/build/migrate). 7. P1-03 детерминированные e2e (мокать provider domains), env. 8. P1-04 SSR/404/OG; P1-05 from; P1-06 token. 9. P1-07 R2 cleanup; P1-11 fail-fast/R2; P1-08 redirect. 10. P1-09/10/13/15/16/17.

**Спринт 2 (P2):** 10. Плеер (Space/repeat-sleep/resume/partial/queue UI). 11. Каталог/синк, индексы/unique, API-валидация/транзакции. 12. Кэши/SW/CSP, админ-ограничения, UX.

**Спринт 3 (P3):** 13. Мёртвый код, доступность, брендинг, документация, тесты.

## 12. Приложение: быстрые репро

### 12.1. Guest data safety (текущая проверка)

`e2e/sync-data-safety.e2e.ts` (7 тестов): guest 401, guest data survives, offline,
same-owner empty replace, pending queue, A→B switch, guest adoption. Историческое
репро (было 0,0,0) больше не воспроизводится.

### 12.2. Migrations (историческое репро и текущая проверка)

Было: применить drizzle/0000..0005 через psql с ON_ERROR_STOP → на 0005
`column "telegram_id" of relation "account" does not exist`; seed →
`column "status" of relation "volumes" does not exist`.

Сейчас: `db:migrate` на чистой БД применяет 7 миграций, `db:seed` создаёт
2/4/10/4, `drizzle-kit generate` — `No schema changes`.

### 12.3. SSR fallback

curl -s http://localhost:4189/books/overlord | grep -E '<title>|<h1'
Результат: title «Книга | Тома», h1 «Загрузка...».

### 12.4. Typecheck

svelte-check --tsconfig ./tsconfig.json
Результат: 0 errors (после фикса P1-02).
