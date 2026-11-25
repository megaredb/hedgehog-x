# OPERATIONS.md — запуск, окружение, тесты, деплой

> Снимок 2026-11-25. Все команды проверены в worktree `dsh-da32b3f2-1fd5`
> (ветка `dsh-da32b3f2-1fd5`, последний коммит `183aa41`, рабочее дерево), кроме отмеченных «не проверено».

## 1. Требования

| Компонент           | Версия/примечание                                               |
| ------------------- | --------------------------------------------------------------- |
| Node.js             | 26.x (проверено на v26.13.1)                                    |
| pnpm                | 11.x (проверено на 11.7.0); `packageManager` в package.json нет |
| Docker + Compose    | для Postgres/Traefik/Umami/Docker-e2e                           |
| PostgreSQL          | 18 (контейнер `postgres:18`); локальный порт 5432               |
| mkcert              | для HTTPS-доменов `*.hedgehog-inc.localhost` (dev)              |
| Playwright browsers | `pnpm exec playwright install`; в окружении были установлены    |

## 2. Окружение

### 2.1. Файл .env

В корне нужен `.env` (в git не коммитится). Основа — `.env.example`.

**Минимум для запуска:**

```dotenv
DATABASE_URL="postgres://root:mysecretpassword@localhost:5432/local"
BETTER_AUTH_SECRET="<32+ символа высокой энтропии>"
BETTER_AUTH_ALLOWED_HOSTS="localhost,localhost:5192"
BETTER_AUTH_FALLBACK_URL="http://localhost:5192"
```

- `BETTER_AUTH_SECRET` обязателен, минимум 32 символа; без него приложение
  падает на старте с явной ошибкой. Генерация: `openssl rand -base64 32`.
- `BODY_SIZE_LIMIT` — лимит тела form-запросов SvelteKit (по умолчанию 512K);
  для загрузки обложек/аудио задайте `550M`.
- `BETTER_AUTH_SECRET` должен быть одинаковым для всех инстансов/реплик.
- `BETTER_AUTH_ALLOWED_HOSTS` — через запятую; включает host:port для dev.
- `ORIGIN` — в multi-domain production **не задавать** (adapter-node берёт
  `X-Forwarded-Host/Proto`); в dev можно не задавать.
- `.env.example` содержит также Telegram/Discord/R2/Umami/Postgres/Traefik.
- **Docker CLI `--env-file` не снимает кавычки**: `TELEGRAM_BOT_TOKEN="..."`
  попадёт в контейнер вместе с `"`, из-за чего Telegram отвечает `bot_id required`.
  Используйте `docker compose` (`env_file:`) или санитизированный env-файл без
  обрамляющих кавычек.

### 2.2. Провайдеры входа

- **Telegram OIDC** (BotFather → Web Login):
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OIDC_CLIENT_ID`, `TELEGRAM_OIDC_CLIENT_SECRET`;
  Redirect URL = `https://<host>/api/auth/callback/telegram-oidc`.
- **Discord**: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`;
  Redirect = `https://<host>/api/auth/callback/discord`.
- Без кредов приложение стартует, но логирует предупреждения; вход не работает.
- Для локального HTTPS: mkcert создаёт сертификаты в `certs/`, Traefik берёт
  `dynamic/dev.yaml`; без сертификатов dev-прокси не поднимется.

### 2.2.1. Подписки и Boosty

Переменные (все опциональны, без них приложение работает, но источники не активны):

- `SUBSCRIPTION_PRICE_PER_DAY_RUB` — стартовая цена дня, по умолчанию 7. После
  первого изменения в `/admin/users` источник истины — `subscription_settings`;
  цена меняется в модалке «Цена дня» с режимом `new`/`all`.
- `TELEGRAM_SUBSCRIPTION_CHAT_ID` — ID закрытой Telegram-группы (например
  `-1001234567890`). Бот `TELEGRAM_BOT_TOKEN` должен быть **администратором**
  группы, иначе `getChatMember` вернёт 400/403. Если обычная группа стала
  супергруппой, Telegram возвращает `migrate_to_chat_id`; код повторяет проверку
  по новому ID, но для webhook обновите `TELEGRAM_SUBSCRIPTION_CHAT_ID`.
- `TELEGRAM_WEBHOOK_SECRET` — случайная строка. Используется как
  `secret_token` в `setWebhook` и проверяется по заголовку
  `X-Telegram-Bot-Api-Secret-Token`. URL webhook:
  `https://<host>/api/telegram/webhook`. Telegram требует публичный HTTPS;
  для локальной проверки используйте туннель (ngrok/cloudflared) или кнопку
  «Настроить webhook» на `/admin/users/integrations` в production. В тестовом
  окружении можно запустить `node --env-file=.env scripts/serveo-webhook.mjs`:
  скрипт поднимает Serveo-туннель и автоматически переустанавливает webhook
  при переподключении. Serveo — временный адрес; для production нужен постоянный домен.
- `DISCORD_GUILD_ID` — ID сервера; `DISCORD_SUBSCRIBER_ROLE_IDS` — ID ролей
  через запятую. Роль — единственный сигнал подписки.
- `DISCORD_BOT_TOKEN` — опционально. Если задан, роли проверяются REST-ботом
  (`GET /guilds/{guild}/members/{user}`). Если пуст, используется OAuth-токен
  пользователя; Discord-приложение должно запрашивать scope
  `guilds.members.read`, а redirect URI — `https://<host>/api/auth/callback/discord`.

Telegram-источник можно обновить лениво кнопкой «Проверить статус» на
`/subscription` или «Проверить источники» в карточке пользователя. Webhook
обновляет кэш сразу при входе/выходе из группы. Ошибка проверки не сбрасывает
уже известный активный статус.

### 2.3. R2 (медиа)

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
`R2_PUBLIC_URL`. Без них uploadImage/uploadAudio пишут в `static/uploads/`
(работает в dev; в production-сборке runtime-файлы не раздаются — нужен R2).

Для локальной разработки с закрытым бакетом задайте
`R2_PUBLIC_URL="/api/media"`: [media proxy](../../src/routes/api/media/%5B...key%5D/+server.ts)
стримит объекты из R2 и поддерживает HTTP Range (перемотка аудио). В production
Режим доставки (прокси или прямой CDN) переключается в админке: **Сайт → Настройки → Сеть и зеркала**.
При выключенном проксировании используется основное включённое зеркало; `mediaDirectBaseUrl` вычисляется автоматически.

### 2.4. Umami (опционально)

`PUBLIC_UMAMI_WEBSITE_ID`, `PUBLIC_UMAMI_HOST` для клиента; `UMAMI_HOST`,
`UMAMI_APP_SECRET` для контейнера. Без website id скрипт не подключается.

## 3. Локальный запуск

### Вариант A: всё в Docker + dev-сервер

```bash
cp .env.example .env      # заполнить секреты
pnpm install
docker compose up -d      # Postgres + Traefik + Umami + dbgate
pnpm db:migrate           # первый запуск: 0000–0034
pnpm db:seed              # первый запуск: демо-контент
pnpm dev                  # Vite на 5192
```

- `compose.yaml` + `compose.dev.yml` поднимают Postgres (127.0.0.1:5432),
  Traefik (80/443), dbgate (3000), umami (3001), db-init.
- `pnpm dev` — Vite на 5192; Traefik проксирует
  `https://hedgehog-inc.localhost` → host:5192.
- Если БД уже инициализирована, достаточно `pnpm dev:all` (compose up + dev).

### Вариант B: только БД

```bash
docker compose up -d db
pnpm install
pnpm db:migrate           # собрать схему из миграций 0000–0034
pnpm db:seed              # опционально; сервер выполняет seed сам при старте
pnpm dev
```

- `hooks.server.ts` вызывает seed при старте; при первом `/api/books` — тоже.
- Если БД пустая и seed не сработал, `pnpm db:seed` создаст 2 книги/4 тома/10 глав.

### Worktree vs основной checkout

- Worktree не содержит `node_modules` и `.env` (они в основном checkout).
  Для запуска в worktree: `pnpm install` + скопировать `.env` (не коммитить).
- Не используйте symlink `node_modules` на другой checkout: pnpm считает его
  невалидным и пытается пересоздать (в неинтерактивном режиме падает с
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`).

## 4. База данных

### 4.1. Источник схемы — миграции

- Цепочка миграций исправлена и проверена на чистой БД:
  - `0000`–`0004` — исходная схема и провайдерские поля;
  - `0005` — **намеренный no-op** (legacy-колонки уже удалены в `0004`);
  - `0006` — catch-up: `user.role`, `volumes.status`, `listening_sessions`,
    `daily_listening_stats`, длины varchar 1024;
  - `0015` — подписки: `subscriptions`, `subscription_sources`,
    `subscription_events`, индекс `account(provider_id, account_id)`;
  - `0016` — цена дня: `subscription_settings`, `subscription_price_changes`,
    `subscription_price_notices`, `subscription_events.price_per_day`;
  - `0017` — пауза/блокировка: `subscriptions.revoked_at`,
    `subscriptions.revoked_remaining_ms`, `subscriptions.blocked_remaining_ms`;
  - `0018` — `donation_ledger` для сохранения донатов после удаления пользователя;
  - `0019` — `user.include_in_stats` для роли автора;
  - `0020` — обезличенная аналитика при удалении пользователя (`user_id ON DELETE SET NULL`);
  - `0021` — `site_pages` и `translators`;
  - `0022` — `site_pages.data` для структурированных ссылок и реквизитов;
  - `0023` — `translators.links` для соцсетей переводчиков;
  - `0024` — `translators.enabled` для скрытия переводчика;
  - `0025` — `translators.user_id` для привязки к пользователю;
  - `0026` — `site_settings` для проксирования медиа и CDN-зеркал;
  - `0027` — `chapters.published` и таблицы трансляций/чата/слушателей/иллюстраций/просмотров;
  - `0028` — `broadcast_reactions` для быстрых эмодзи-реакций;
  - `0029` — `broadcasts.cover_blurhash` для blurhash-фона;
  - `0030` — OG-превью ссылок в сообщениях чата;
  - `0031` — ответы на сообщения (`reply_to_*`);
  - `0032` — теги иллюстраций в сообщениях чата;
  - `0033` — привязка иллюстраций к главам (`chapter_illustrations`);
  - `0034` — `broadcast_progress` (live/replay resume per user).
- Текущая dev-БД **пересобрана через `db:migrate`** (`drizzle.__drizzle_migrations`
  содержит все записи `0000`–`0034`), затем `db:seed`; пользовательские данные восстановлены из
  предварительного бэкапа.
- После применения `0034` схема и `schema.ts` совпадают; `drizzle-kit generate`
  отвечает `No schema changes, nothing to migrate`. Для существующей БД просто
  примените `pnpm db:migrate`; для проверки используйте отдельную
  `hedgehog_x_test` (§4.1.1).
- `db:push` — только dev-shortcut; он может удалять колонки и не является
  источником истины. Не используйте его как основной путь.
- Если БД была создана старым `db:push` и в ней нет таблицы миграций, не запускайте
  `db:migrate` поверх неё: пересоберите БД из миграций (см. §4.3) или осознанно
  сделайте baseline. Перед этим — `pg_dump`.

### 4.1.1. Глобальные настройки сайта

На `/admin/site` вкладка **«Настройки»** хранит `site_settings`:

- `media` — режим доставки медиа/аудио (`mediaProxyEnabled`, вычисляемый
  `mediaDirectBaseUrl`). При включённом режиме файлы идут через `/api/media`
  с дисковым кешем изображений; при выключенном — через основное CDN-зеркало.
- `mirrors` — список CDN-зеркал с полями `label`, `host`, `description`,
  `enabled`, `autoRole` (`default`/`ru`/`none`). «Автоматически» на публичной
  странице настроек выбирает RU-зеркало на RU-домене, иначе основное.

Изменения применяются к новым запросам сразу после сохранения; root layout
передаёт mirrors в клиентский резолвер, а `/api/media` может отвечать `302`
на прямой адрес зеркала.

### 4.1.2. Трансляции и load test

Админ-страница `/admin/broadcasts` создаёт эфир для главы, хранит обложку, тайминги
иллюстраций, настройки записи/публикации и показывает live-слушателей и replay-просмотры.
Публичные страницы `/broadcasts` и `/broadcasts/[id]` требуют входа и активной подписки
(кроме admin). Чат: 500 символов, 5 сообщений за 10 секунд, только разрешённые ссылки
(Telegram/Boosty/Discord/домены HEDGEHOG.INC).

Нагрузочный тест без зависимостей:

```bash
node scripts/load-test-broadcast.mjs \
  --url http://127.0.0.1:5180 \
  --concurrency 50 --duration 10 --interval 2000
```

Результаты локального прогона (dev Vite, live-трансляция): 50 клиентов/2с —
250 запросов, 0 ошибок, p95 ≈136 мс; 100 — p95 ≈339 мс; 200 — p95 ≈264 мс.
Для авторизованного state endpoint передайте cookie через `--cookie 'session=...'`.
Это проверяет polling; реальные аудиопотоки идут напрямую с CDN/`/api/media`, а не через
один Node-процесс.

### 4.1.3. Изолированная тестовая БД для подписок

Чтобы проверять миграции/выдачу подписок, не трогая текущую `local`:

```bash
docker exec hedgehog-x-db-1 createdb -U root hedgehog_x_test
DATABASE_URL='postgres://root:mysecretpassword@localhost:5432/hedgehog_x_test' \
  pnpm db:migrate
```

Затем запускайте dev-сервер с `DATABASE_URL` тестовой БД (или отдельным
`.env`). Проверка: `select count(*) from drizzle.__drizzle_migrations` и
`select tablename from pg_tables where schemaname='public' and tablename like 'subscription%'`.
Не применяйте миграции к `local`, если не хотите менять рабочую БД.

### 4.2. Команды

| Команда            | Что делает                                 | Когда                              |
| ------------------ | ------------------------------------------ | ---------------------------------- |
| `pnpm db:push`     | dev-shortcut, может удалять колонки        | только осознанно, не основной путь |
| `pnpm db:generate` | генерирует SQL-миграцию + snapshot из diff | после правки schema                |
| `pnpm db:migrate`  | применяет 0000–0034                        | **рабочий способ**                 |
| `pnpm db:seed`     | идемпотентный сид                          | вручную/тест                       |
| `pnpm db:studio`   | Drizzle Studio                             | отладка                            |
| `pnpm auth:schema` | перегенерирует auth.schema.ts              | после изменения auth-конфига       |

**Правило:** после `db:generate` проверьте SQL глазами, закоммитьте `.sql` +
`meta/*_snapshot.json` + `meta/_journal.json`. Не редактируйте уже применённые
миграции; `0005` специально оставлен no-op.

### 4.2.1. Нормализация R2 и архивных озвучек

Скрипт `scripts/normalize-storage.mjs` приводит dev-бакет к структуре production
(`<book>/<volume>/<file>`, `OLD VERSION/`, `preview.jpg`), обновляет URL в БД и
импортирует архивные треки в `audio_versions` / `chapter_audio_versions`.

```bash
# dry-run: только отчёт
node scripts/normalize-storage.mjs

# копирование, обновление БД и импорт версий
node scripts/normalize-storage.mjs --apply

# после проверки — удалить старые hash-based объекты
node scripts/normalize-storage.mjs --apply --delete-old
```

Перед `--apply` сделайте `pg_dump` таблиц `chapters`, `volumes`, `books` и
`audio_versions`; `--delete-old` запускайте только после проверки медиа-URL.

### 4.3. Сброс БД

Сначала **обязательный бэкап**:

```bash
docker exec hedgehog-x-db-1 pg_dump -U root -d local -Fc -f /tmp/hedgehog_before_reset.dump
```

Затем (destructive):

```bash
docker compose down -v      # удалит volume pgdata — все данные!
docker compose up -d db
pnpm db:migrate             # 0000–0034
pnpm db:seed
```

Для локальной БД без пересоздания контейнера можно очистить `public` schema и
применить миграции заново. Не запускайте без бэкапа: пользователи, прогресс,
закладки и аналитика будут потеряны (если не восстановите из dump).

### 4.4. Первый админ

В production кнопки «сделать меня админом» нет (только `dev`). Назначьте вручную:

```sql
UPDATE "user" SET role = 'admin' WHERE email = '<email>';
-- автор: только один пользователь, назначается через /admin/users
UPDATE "user" SET role = 'author', include_in_stats = false WHERE id = '<id>';
```

В dev: войти → `/admin` → карточка «Доступ ограничен» → кнопка
«Сделать меня администратором» (form action `?/makeSelfAdmin`).

## 5. Сборка и preview

```bash
pnpm build
node server.js                  # compression + cache headers; env: DATABASE_URL, BETTER_AUTH_SECRET, PORT
# или
pnpm preview                   # Vite preview на 4173
```

- `build/index.js` — adapter-node handler; production запускается через `server.js`.
- `pnpm build` **не проверяет типы**; для типов запускайте отдельно `pnpm check`
  (сейчас 0 ошибок).
- Для production задайте `BETTER_AUTH_ALLOWED_HOSTS`, `PORT`, `HOST=0.0.0.0`;
  `ORIGIN` не задавайте при двух доменах — используйте заголовки Traefik.
- PWA service worker — `build/client/service-worker.js`.

### 5.1. Production Docker

```bash
# .env: APP_HOST, APP_HOST_RU, BETTER_AUTH_SECRET, POSTGRES_*, OAuth/R2/Umami
docker build -t hedgehog-x:prod .
docker compose -f compose.yaml -f compose.prod.yml up -d --build
```

- `APP_HOST=hedgehog-inc.one`, `APP_HOST_RU=ru.hedgehog-inc.one`; оба домена
  должны резолвиться на сервер.
- Единый Traefik-роутер: `Host(hedgehog-inc.one) || Host(ru.hedgehog-inc.one)`.
- `ORIGIN` не задаётся: adapter-node берёт origin из `X-Forwarded-Host/Proto`.
- `BETTER_AUTH_COOKIE_DOMAIN=.hedgehog-inc.one` — одна сессия на оба хоста.
- OAuth redirect URI нужно зарегистрировать для **обоих** доменов.
- `app` собирается из `Dockerfile`; runtime-стадия ставит только production deps.
- При старте entrypoint выполняет `scripts/migrate.mjs` (Drizzle migrator), затем
  `node server.js`; повторный запуск идемпотентен. `SKIP_MIGRATIONS=true` отключает.
- `GET /health` проверяет PostgreSQL; Docker healthcheck и `depends_on` БД.
- `GET /api/metrics` — Prometheus-метрики (admin или `METRICS_TOKEN`).
- `LOG_FORMAT=json` включает структурированные JSON-логи для Loki/CloudWatch/Vector.
- Приложение работает под `node` (не root), `STOPSIGNAL SIGTERM`, adapter-node
  завершает HTTP-сервер, после чего `postgres-js` закрывает пул.
- Traefik роутит `https://${APP_HOST}` и `https://${APP_HOST_RU}` на `app:3000`;
  наружу порт не публикуется.
- Для `/api/analytics/listen` в production включён edge rate limit Traefik
  (`average=1`, `burst=30`) — он общий для всех реплик app.
- Admin POST/загрузки ограничены 30 запросами в минуту на IP в `hooks.server.ts`;
  тело формы — `BODY_SIZE_LIMIT=550M`, файл — 15 МБ image / 500 МБ audio.
- Данные БД — volume `pgdata`; `docker compose down -v` удаляет их.

Локальная проверка production-образа на чистой БД:

```bash
docker build -t hedgehog-x:prod .
# поднять scratch Postgres и app с DATABASE_URL/APP_HOST/APP_HOST_RU, затем:
curl http://127.0.0.1:3000/health
```

Результат текущего прогона: миграции `9`, seed `2` книги, `/health` 200,
`/api/books` 200, `/api/user/sync` 401, restart сохраняет данные, `docker stop`
завершается с exit 0.

## 6. Тесты и проверки

### 6.1. Unit

```bash
pnpm test:unit
```

- 35 файлов, 250 тестов; в снимке — все зелёные.
- `r2.test.ts` пишет файлы в `static/uploads/test*` (или в R2, если env настроен)
  и пытается удалить; побочный эффект.
- `listeningTracker.test.ts` использует Dexie без браузера; часть проверок
  проглатывает отсутствие IndexedDB.

### 6.1.1. Покрытие

```bash
pnpm test:coverage
```

- 88.00% строк / 82.89% ветвей / 65.66% функций для модулей, реально загруженных
  unit-тестами. Это не покрытие всего приложения.
- Не покрыты: `downloadManager`, `audioStore`, `audio-provider`, admin form actions,
  большинство route handlers и UI; e2e не покрывает плеер/историю/загрузки/настройки/админку/live.

### 6.2. Typecheck и lint

```bash
pnpm check     # svelte-check: 0 ошибок
pnpm lint      # prettier + eslint: зелёный
pnpm format
```

- `pnpm check` проходит. Не игнорируйте новые ошибки.
- `pnpm build` зелёный; не путайте с типовой проверкой.

### 6.3. E2E

```bash
# ВАЖНО: webServer (vite preview) падает без секрета
export BETTER_AUTH_SECRET='test-secret-at-least-32-characters-long-key'
export BETTER_AUTH_ALLOWED_HOSTS='localhost,localhost:4173'
export BETTER_AUTH_FALLBACK_URL='http://localhost:4173'

pnpm exec playwright install      # если браузеров нет
pnpm test:e2e                    # или: pnpm exec playwright test
pnpm exec playwright test --workers=1   # стабильнее
```

- Конфиг сам поднимает `pnpm preview -- --host 0.0.0.0 --port 4173`
  (`reuseExistingServer` вне CI), поэтому перед запуском не нужно вручную
  поднимать preview.
- Без `BETTER_AUTH_SECRET` webServer падает: `BetterAuthError: default secret`.
- Тесты Telegram/Discord редиректов мокают провайдерские домены
  (`oauth.telegram.org`, `discord.com`), поэтому e2e не ходят в сеть.
  В текущем прогоне: **48/48** при `--workers=1` (все зелёные);
  `e2e/sync-data-safety.e2e.ts` покрывает P0-01 (9 сценариев, включая consent),
  `e2e/bookmark-sync.e2e.ts` — P0-03 (offline → online flush),
  `e2e/session-isolation.e2e.ts` — P0-05 (logout/owner).
- `migration-safety.test.ts` проверяет отсутствие кошельков/карт/ключей/паролей/токенов в `drizzle/*.sql`.
- `delete-account.integration.e2e.ts` использует реальную Postgres и
  `BETTER_AUTH_SECRET`; без секрета skip. Тест создаёт и удаляет тестового
  пользователя; ожидает cookie `__Secure-better-auth.session_token` (production
  preview). Проверено: 3/3 проходят при заданном секрете.
- Скриншоты/трейсы — в `test-results/` (gitignored).

### 6.4. Docker-e2e

```bash
pnpm test:docker
pnpm test:docker:down
```

- `compose.test.yml`: `test-db` (tmpfs) + `playwright` (Dockerfile.test).
- Dockerfile.test: `db:migrate` → `db:seed` → `build` → `playwright test`.
- Требует Docker; сеть для `pnpm install`/playwright внутри образа.

### 6.5. CI

`.github/workflows/ci.yml` запускается на push в `dev`/`main`, pull request и
вручную через `workflow_dispatch`. Job `quality` поднимает `postgres:18` сервисом
и выполняет `pnpm install --frozen-lockfile`, `lint`, `check`, `test:unit`,
`db:migrate`, `db:seed`, `build`, `playwright install` и `playwright test --workers=1`.

Локальный эквивалент (без GitHub):

```bash
node ./node_modules/prettier/bin/prettier.cjs --check .
node ./node_modules/eslint/bin/eslint.js .
node ./node_modules/svelte-check/bin/svelte-check --tsconfig ./tsconfig.json
node --import tsx --test "src/**/*.test.ts"
node ./node_modules/vite/bin/vite.js build
```

## 7. Docker / инфраструктура

### 7.1. Состав

| Сервис       | compose            | Порты (dev)      | Назначение                    |
| ------------ | ------------------ | ---------------- | ----------------------------- |
| `db`         | compose.yaml       | 127.0.0.1:5432   | PostgreSQL 18, volume pgdata  |
| `traefik`    | compose.yaml + dev | 127.0.0.1:80/443 | reverse proxy, TLS            |
| `db-init`    | compose.yaml       | —                | создаёт БД umami (idempotent) |
| `umami`      | compose.yaml       | 127.0.0.1:3001   | аналитика                     |
| `dbgate`     | compose.dev.yml    | 127.0.0.1:3000   | SQL UI                        |
| `test-db`    | compose.test.yml   | —                | tmpfs Postgres для тестов     |
| `playwright` | compose.test.yml   | —                | e2e в контейнере              |

### 7.2. Traefik dev

- `dynamic/dev.yaml`: `hedgehog-inc.localhost` → host:5192,
  `preview.hedgehog-inc.localhost` → host:5174; TLS из `/certs`.
- В `compose.dev.yml` монтируется `./certs:/certs:ro` и `./dynamic:/dynamic:ro`.
- Создайте сертификаты mkcert; иначе Traefik не загрузит конфиг.
- `compose.yaml` сам по себе не монтирует `./dynamic` — только dev.

### 7.3. Production status

- app-сервис и production Dockerfile добавлены; runtime deps перенесены в
  `dependencies`.
- Traefik-роутер для `${APP_HOST}` и `${APP_HOST_RU}` описан в `compose.prod.yml`.
- Есть `/health` (PostgreSQL), миграции при старте, non-root, graceful shutdown.
- Остаётся: CSP/security headers, rate limit, централизованные логи, бэкапы,
  реальный TLS/LE smoke на сервере.

### 7.4. Production checklist

1. [x] Миграции проверены на чистой БД (`db:migrate` + `db:seed`); при деплое
       повторить на production-БД.
2. [x] Runtime-зависимости перенесены в `dependencies`.
3. [x] Собран production-образ; entrypoint применяет миграции и запускает сервер.
4. [x] Заданы `BETTER_AUTH_ALLOWED_HOSTS` (оба домена), `BETTER_AUTH_COOKIE_DOMAIN`,
       `BETTER_AUTH_SECRET`, `DATABASE_URL`; `ORIGIN` не задан.
5. [ ] Настроить R2 (иначе загрузки будут недоступны в prod).
6. [x] Traefik-роутер и production compose описаны; TLS/LE проверить на сервере.
7. [ ] Назначить первого admin в БД.
8. [ ] Проверить cookie-флаги (Secure/HttpOnly/SameSite) и HTTPS на сервере.
9. [ ] Настроить бэкапы Postgres и жизненный цикл R2.
10. [x] Smoke локально: `/health`, `/api/books`, `/api/user/sync`, restart, stop.
        Полный UI smoke (вход, лайк, download, admin) — на сервере.

## 8. Диагностика проблем

| Симптом                                                          | Причина/решение                                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `BetterAuthError: default secret` при старте                     | задать `BETTER_AUTH_SECRET` (32+ символа)                                                |
| `[better-auth-telegram] OIDC: clientId is required`              | не заданы `TELEGRAM_OIDC_*`/`TELEGRAM_BOT_TOKEN`; Telegram-вход не работает              |
| `Social provider discord is missing clientId or clientSecret`    | не заданы `DISCORD_*`                                                                    |
| `pnpm check` падает                                              | раньше была `auth.ts:47` (исправлено); проверьте новую ошибку и `svelte-kit sync`        |
| `db:migrate`: column "telegram_id" ... does not exist            | у вас старая ревизия с дублем в `0005`; обновите `drizzle/` (текущий `0005` — no-op)     |
| `db:migrate` → relation ... already exists                       | БД создана `db:push` без истории; пересоберите из миграций (§4.3) или сделайте baseline  |
| `db:seed` → column "status" of relation "volumes" does not exist | БД неполная/старая; пересоберите из `0000–0034`                                          |
| `db:generate` снова создаёт миграцию                             | `schema.ts` и snapshot разошлись; проверьте и закоммитьте новую миграцию                 |
| Страница вечно «Загрузка...»                                     | нет данных в Dexie: API/БД недоступны, книга не существует, или JS не загрузился         |
| `/admin` после входа ведёт на `/`                                | redirect= vs from= (AUDIT P1-08); откройте `/admin` снова                                |
| Аудио не играет                                                  | проверьте URL/зеркало/OPFS-квоту/CORS; в консоли — Audio-ошибки; `sample.mp3` — заглушка |
| Скачивание зависает/ошибка                                       | OPFS недоступен, нет места, CORS/mirror; см. консоль Downloads                           |
| R2 upload 500                                                    | проверить креды/bucket/public URL; без R2 — fallback (dev)                               |
| Traefik не стартует                                              | нет `certs/` или неверные имена сертификатов                                             |
| e2e webServer exit 1                                             | задать `BETTER_AUTH_SECRET` и allowed hosts                                              |
| e2e падает на OAuth-редиректе                                    | сеть/флап; запустить отдельно/с `--workers=1`                                            |
| `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`                     | symlink node_modules; удалить symlink и `pnpm install`                                   |

## 9. Логи и наблюдаемость

- Сервер: `createLogger` → stdout/stderr; уровень `info` в prod.
- Браузер: `createLogger` → console; уровень `warn` в prod, override:
  `localStorage.setItem('LOG_LEVEL','debug')`.
- Service worker: `createLogger('SW')` в console SW.
- Better-auth пишет предупреждения о конфиге при старте.
- Нет централизованного сбора ошибок; для диагностики используйте
  `docker compose logs -f`, DevTools, `/admin/analytics`.
- `/api/books` и `/api/user/sync` не логируют запросы; `db:seed` логирует шаги.

## 10. Бэкапы

- **Postgres**: volume `pgdata`; `pg_dump`/restore. Перед `db:migrate`, `db:push`,
  reset или `db:generate` — бэкап.
- **R2**: версионирование/жизненный цикл на стороне Cloudflare; приложение не
  удаляет объекты (AUDIT P1-07), поэтому очистка — ручная.
- **Пользовательские локальные данные** (Dexie/OPFS) не бэкапятся сервером;
  потеря браузера = потеря локальных закладок/скачанного.

## 11. Проверочный снимок (2026-11-25)

| Проверка            | Команда                                       | Результат                                                           |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| Build               | `node vite build`                             | ✅ exit 0                                                           |
| Typecheck           | `svelte-check`                                | ✅ 0 errors                                                         |
| Lint                | prettier + eslint                             | ✅                                                                  |
| Unit                | `node --import tsx --test "src/**/*.test.ts"` | ✅ 250 pass                                                         |
| E2E (3 файла)       | `playwright test auth profile navigation`     | ✅ 23/23 (в текущем прогоне)                                        |
| E2E full (1 worker) | `playwright test --workers=1`                 | ✅ 48/48 (включая a11y; сеть для OAuth-редиректов всё ещё нужна)    |
| Sync safety e2e     | `e2e/sync-data-safety.e2e.ts`                 | ✅ 9/9 (P0-01 + guest consent)                                      |
| Bookmark queue e2e  | `e2e/bookmark-sync.e2e.ts`                    | ✅ 1/1 (P0-03)                                                      |
| Session isolation   | `e2e/session-isolation.e2e.ts`                | ✅ 5/5 (P0-05)                                                      |
| E2E integration     | `delete-account.integration.e2e.ts`           | ✅ 3 pass                                                           |
| Migrations          | migrate 0000..0034 на чистой БД + seed        | ✅ 35 миграций, seed 2/4/10/4                                       |
| Schema parity       | DB vs schema.ts / generate                    | ✅ diff пуст; `No schema changes`                                   |
| Admin SSR           | /admin, /admin/content, /admin/analytics      | ✅ 200 с подписанной сессией; старые content-URL редиректят         |
| Analytics write     | POST /api/analytics/listen на scratch DB      | ✅ 200; session + daily stats вставлены                             |
| Guest data loss     | Playwright + IndexedDB                        | ❌ progress/bookmarks/likes стёрты после перехода на страницу книги |

Подробности — в [AUDIT.md](AUDIT.md).
