# OPERATIONS.md — запуск, окружение, тесты, деплой

Документ описывает, как поднять, проверить и выпустить приложение.
Архитектура — [ARCHITECTURE.md](ARCHITECTURE.md), карта — [PROJECT_MAP.md](PROJECT_MAP.md),
тесты — [TESTING.md](TESTING.md).

## 1. Требования

| Компонент           | Версия/примечание                                      |
| ------------------- | ------------------------------------------------------ |
| Node.js             | 26.x (`engines >=26 <27`, `.npmrc engine-strict=true`) |
| pnpm                | 11.x (`packageManager pnpm@11.7.0`)                    |
| PostgreSQL          | 18 (`postgres:18`)                                     |
| Docker + Compose    | БД, Traefik, Umami, e2e                                |
| mkcert/openssl      | HTTPS `*.hedgehog-inc.localhost`                       |
| Playwright Chromium | `pnpm exec playwright install chromium`                |

## 2. Окружение

### 2.1. Минимум

```dotenv
DATABASE_URL="postgres://root:mysecretpassword@localhost:5432/local"
BETTER_AUTH_SECRET="<32+ символа>"
BETTER_AUTH_ALLOWED_HOSTS="localhost,localhost:5173"
BETTER_AUTH_FALLBACK_URL="http://localhost:5173"
```

- `BETTER_AUTH_SECRET` ≥32; иначе падение на старте. `openssl rand -base64 32`.
- `DATABASE_URL` имеет fallback localhost в `db/index.ts`, но drizzle.config
  без него падает.
- `BODY_SIZE_LIMIT=550M` — для загрузок (Dockerfile/compose уже задают).
- Для dev-домена добавьте его в `BETTER_AUTH_ALLOWED_HOSTS`.

### 2.2. Все группы

| Группа          | Переменные                                                                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| БД              | `DATABASE_URL`                                                                                                                                                       |
| Auth            | `BETTER_AUTH_SECRET`, `BETTER_AUTH_ALLOWED_HOSTS`, `BETTER_AUTH_FALLBACK_URL`, `BETTER_AUTH_COOKIE_DOMAIN`, `BETTER_AUTH_URL`                                        |
| Вход            | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OIDC_CLIENT_ID/SECRET`, `DISCORD_CLIENT_ID/SECRET`                                                                                   |
| Подписка        | `SUBSCRIPTION_PRICE_PER_DAY_RUB`, `TELEGRAM_SUBSCRIPTION_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_SUBSCRIBER_ROLE_IDS` |
| R2              | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`                                                                       |
| Медиа/логи      | `MEDIA_CACHE_DIR`, `MEDIA_CACHE_MAX_BYTES`, `LOG_FORMAT`, `METRICS_TOKEN`, `LOCAL_UPLOAD_DIR`                                                                        |
| Umami           | `PUBLIC_UMAMI_HOST`, `PUBLIC_UMAMI_WEBSITE_ID`, `UMAMI_HOST`, `UMAMI_WEBSITE_ID`                                                                                     |
| Runtime         | `PORT`, `HOST`, `SHUTDOWN_TIMEOUT`, `NODE_ENV`                                                                                                                       |
| Скрипты         | `MIGRATIONS_FOLDER`, `SKIP_MIGRATIONS`, `ALLOW_AUTH_SCHEMA_OVERWRITE`, `SOURCE_R2_BUCKET`, `TELEGRAM_API_BASE_URL`, `DISCORD_API_BASE_URL`, `WEBHOOK_LOCAL_PORT`     |
| Compose/Traefik | `APP_HOST`, `APP_HOST_RU`, `ORIGIN`, `POSTGRES_*`, `ACME_EMAIL`, `UMAMI_APP_SECRET`, `COMPOSE_FILE`                                                                  |

`PUBLIC_SITE_URL` читается для trusted-host в link-preview, но в
`.env.example` отсутствует. `UMAMI_WEBSITE_ID` тоже читается, но не описан.
`BETTER_AUTH_URL` теперь используется как fallback host в link-preview.

### 2.3. Провайдеры входа

- Telegram OIDC: Redirect `https://<host>/api/auth/callback/telegram-oidc`.
- Discord: Redirect `https://<host>/api/auth/callback/discord`; scope
  `identify email guilds.members.read`.
- Без кредов приложение стартует, но провайдер не работает.
- В production redirect URI нужен для обоих доменов.

### 2.4. Подписка (Boosty через Telegram/Discord)

- `TELEGRAM_SUBSCRIPTION_CHAT_ID` — ID закрытой группы;
  `TELEGRAM_BOT_TOKEN` — бот должен быть админом группы.
- `DISCORD_GUILD_ID` + `DISCORD_SUBSCRIBER_ROLE_IDS` (через запятую) —
  сервер и роль подписчика; `DISCORD_BOT_TOKEN` рекомендуется, иначе
  используется OAuth-токен пользователя с `guilds.members.read`.
- `TELEGRAM_WEBHOOK_SECRET` + публичный HTTPS нужен для мгновенного
  обновления при входе/выходе из группы; без webhook — кнопка «Проверить
  статус» на `/subscription` или `/admin/users/integrations`.
- Локально webhook можно поднять через `scripts/serveo-webhook.mjs`
  (`WEBHOOK_LOCAL_PORT`, по умолчанию 5180) + serveo/ngrok; Telegram принимает
  только HTTPS.
- `SUBSCRIPTION_PRICE_PER_DAY_RUB` — стартовая цена; после первого изменения
  цена хранится в `subscription_settings`.
- Boosty API не вызывается; приложение проверяет членство/роль.

### 2.5. R2 и медиа

- Без R2 в dev файлы пишутся в `static/uploads`; в production загрузки
  запрещены (fail-fast).
- `R2_PUBLIC_URL` — база медиа; для работы переключателя используйте
  относительный `/api/media`. Новые загрузки сохраняются как `/api/media/...`
  независимо от режима; absolute CDN-URL не запекается в контент.
- `/admin/site` → «Настройки»: `mediaProxyEnabled` и `mediaDirectBaseUrl`.
  При выключенном proxy `/api/media` отдаёт 302 на direct URL; иначе стримит
  Range и кэширует изображения (10 МиБ/файл, 100 МиБ total).
- `site_settings.mirrors` — CDN-хосты с ролями default/ru/none; клиент
  применяет их автоматически.

### 2.6. Umami

`PUBLIC_UMAMI_WEBSITE_ID/HOST` для клиента; `UMAMI_HOST`/`UMAMI_APP_SECRET`
для контейнера; без id скрипт не подключается.

## 3. Локальный запуск

### 3.1. Всё в Docker + dev

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate      # 0000–0035
pnpm db:seed
pnpm dev             # Vite 5173
```

- `compose.yaml` + `compose.dev.yml`: Postgres `127.0.0.1:5432`, Traefik
  `127.0.0.1:80/443`, dbgate `127.0.0.1:3000`, Umami `127.0.0.1:3001`.
- Traefik: `hedgehog-inc.localhost` → 5173, preview → 5174.
- Для preview на 5174: `pnpm preview -- --port 5174` (по умолчанию preview 4173).
- `pnpm dev:all` = compose up + dev.

### 3.2. Только БД

```bash
docker compose up -d db
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Seed вызывается и хуком при старте/на `/api/books*`; `db:seed` — если нужно
вручную.

### 3.3. Порты

| Что                        | Порт |
| -------------------------- | ---- |
| Vite dev                   | 5173 |
| Vite preview / Playwright  | 4173 |
| Traefik preview            | 5174 |
| App production (в compose) | 3000 |
| PostgreSQL                 | 5432 |
| dbgate (dev)               | 3000 |
| Umami (dev)                | 3001 |
| serveo webhook             | 5180 |

## 4. База данных

### 4.1. Источник схемы

- 36 миграций `0000–0035`; `0005` — no-op.
- Изменить `schema.ts` → `pnpm db:generate` → проверить SQL → `pnpm db:migrate`.
  Не редактировать применённые миграции.
- `pnpm db:push` — dev-shortcut, может удалять колонки.
- `db:generate` должен быть no-op на актуальной схеме; CI проверяет
  `git diff --exit-code -- drizzle`.

### 4.2. Команды

| Команда            | Что делает                            |
| ------------------ | ------------------------------------- |
| `pnpm db:generate` | SQL + snapshot из diff                |
| `pnpm db:migrate`  | Применяет 0000–0035                   |
| `pnpm db:seed`     | Seed 2/4/10/4                         |
| `pnpm db:studio`   | Drizzle Studio                        |
| `pnpm db:push`     | Dev-shortcut                          |
| `pnpm auth:schema` | Перегенерация auth.schema (guard env) |

### 4.3. Сброс/бэкап

```bash
docker exec <db> pg_dump -U root -d local -Fc -f /tmp/hedgehog.dump
docker compose down -v
docker compose up -d db
pnpm db:migrate
pnpm db:seed
```

Не запускать `db:migrate` поверх БД, созданной старым `db:push` без истории.

### 4.4. Роли и первый админ

```bash
pnpm admin:grant user@example.com   # role=admin
```

- Роли: `user`, `admin`, `author`.
- `admin` — полный доступ; `author` — контент/аналитика/сайт/подписки, но не
  управление ролями/автором; `include_in_stats=false` у автора.
- В dev кнопка «Сделать меня админом» на `/admin`.
- `/admin/users` позволяет назначать роли/автора (только full admin) и
  управлять подписками.

### 4.5. Донаты

`scripts/backfill-donation-ledger.ts` — заполнение ledger историческими
донатами; запускать после проверки данных.

## 5. Сборка и preview

```bash
pnpm build       # vite build; типы не проверяет
pnpm check       # svelte-check
node server.js   # PORT 3000
pnpm preview     # 4173
```

Production: `NODE_ENV=production`, `PORT`, `HOST`, `BETTER_AUTH_ALLOWED_HOSTS`;
`ORIGIN` при двух доменах не задавать.

## 6. Production Docker

```bash
docker build -t hedgehog-x:prod .
docker compose -f compose.yaml -f compose.prod.yml up -d --build
```

- Multi-stage, runtime-only deps, `USER node`, healthcheck `/health`.
- Entrypoint: `scripts/migrate.mjs` (если `SKIP_MIGRATIONS!=true`), затем
  `node server.js`; повторный запуск идемпотентен.
- `BODY_SIZE_LIMIT=550M`; hooks: 520 МиБ body + 30 POST/мин на admin/API admin.
- Traefik LE, оба домена; edge rate limit только `/api/analytics/listen`
  (`average=1`, `burst=30`).
- `stop_grace_period=35s` > `SHUTDOWN_TIMEOUT=30`; postgres pool закрывается
  по `sveltekit:shutdown`.
- Media proxy/кэш: при необходимости volume для `MEDIA_CACHE_DIR`.

Проверка: `/health`, `/api/books`, `/api/user/sync` 401, вход на обоих
доменах, R2-загрузка, `/api/metrics`, перезапуск.

## 7. Тесты

```bash
pnpm test:unit
pnpm test:coverage
BETTER_AUTH_SECRET='test-secret-at-least-32-characters-long-key' \
BETTER_AUTH_ALLOWED_HOSTS='localhost,localhost:4173' \
BETTER_AUTH_FALLBACK_URL='http://localhost:4173' \
pnpm exec playwright test --workers=1
```

Playwright сам поднимает preview на 4173; без секрета webServer падает.
Docker: `pnpm test:docker`. CI — `.github/workflows/ci.yml`.

## 8. Наблюдаемость

- `createLogger`; prod browser warn, server info; `LOG_FORMAT=json`.
- `/health` — PostgreSQL; `/api/metrics` — Prometheus (admin/Bearer).
- `handleError` + счётчики; внешнего APM нет.
- Broadcast caches: active/listener/subscription — in-memory TTL (1–10 с).
- `/admin/analytics` — прослушивания/доходы; `/admin/users/integrations` —
  Telegram/Discord статус.

## 9. Диагностика

| Симптом                             | Причина/решение                                           |
| ----------------------------------- | --------------------------------------------------------- |
| `BETTER_AUTH_SECRET is required...` | Секрет не задан/<32                                       |
| `DATABASE_URL is not set`           | drizzle/скрипт без env                                    |
| `relation ... does not exist`       | Не применены миграции                                     |
| `column ... does not exist`         | Схема старше миграций                                     |
| `db:generate` создаёт миграцию      | Snapshot/schema разошлись                                 |
| 403 «Нужна активная подписка»       | Трансляция/чат без подписки; выдать дни                   |
| 403 «Аккаунт заблокирован»          | `subscriptions.blocked_at`; снять block                   |
| `/subscription` не обновляет статус | Проверить Telegram/Discord env; cooldown 20 с             |
| Webhook не приходит                 | Нет HTTPS/секрета; `/admin/users/integrations`            |
| Ошибка Discord-роли                 | Бот/роль/guild ID; OAuth scope                            |
| 413 при загрузке                    | BODY_SIZE_LIMIT/520 МиБ; image 15/audio 500/video 100     |
| 429                                 | Admin 30/мин, sync 120/мин, analytics 60/мин, chat 5/10 с |
| R2 upload 500                       | Креды/бакет; prod без R2 запрещён                         |
| `/api/media` 302                    | mediaProxyEnabled=false; direct URL                       |
| Аудио не играет                     | URL/зеркало/OPFS/квота/CORS                               |
| Скачивание зависает                 | OPFS/место (резерв 50 МБ)/CORS                            |
| PWA старое                          | Очистить CacheStorage/обновить SW                         |
| e2e webServer exit 1                | Нет секрета/allowed hosts                                 |
| Traefik не стартует                 | Нет certs/неверные имена                                  |
| Node engine error                   | Нужен Node 26                                             |

## 10. Бэкапы

- Postgres: `pgdata`, `pg_dump`; перед миграциями.
- R2: lifecycle/versioning на стороне Cloudflare; удаление — только админка.
- Dexie/OPFS не бэкапятся сервером; потеря браузера = потеря локального.

## 11. Security-checklist

- [ ] Secret ≥32, уникален.
- [ ] Allowed hosts только реальные.
- [ ] Cookie domain для двух доменов.
- [ ] R2 настроен; публичный URL HTTPS.
- [ ] Subscription env: Telegram chat/webhook secret, Discord guild/roles.
- [ ] `METRICS_TOKEN` если метрики снаружи.
- [ ] Первый admin/author назначен.
- [ ] Понимать: CSP `unsafe-inline`, нет CSRF-токенов, rate limit in-memory,
      edge-лимит только analytics.
- [ ] Бэкапы Postgres и lifecycle R2.
