# HEDGEHOG.INC / hedgehog-x

Русскоязычное PWA для аудиокниг HEDGEHOG.INC: каталог, тома, главы, версии
озвучки, глобальный плеер, закладки, офлайн-скачивание, live/replay трансляции
с чатом, подписка через Boosty (Telegram/Discord), редактируемый сайт и
SSR-админка с Cloudflare R2.

> Документация описывает текущий код; если документ и код расходятся — прав код.

## Что умеет

- Каталог и витрина из БД; книга → тома → главы (только опубликованные) →
  иллюстрации и тайминги показа.
- Версии озвучки: базовая/архивные, отдельные прогресс/лайки/закладки.
- Плеер: play/pause, seek, скорость, громкость, sleep timer, undo seek,
  автопереход, закладки с диапазоном, Media Session, wake lock.
- Офлайн: OPFS-скачивание глав/томов, PWA-кэш страниц и аудио.
- Синхронизация прогресса/лайков/закладок; гости локально; owner-aware очередь;
  consent при переносе гостевых данных.
- Трансляции: live/replay, чат с реакциями и ответами, иллюстрации по таймингу,
  слушатели/просмотры, прогресс на нескольких устройствах.
- Подписка: Boosty через Telegram-группу и Discord-роль, ручные донаты/выдачи,
  lifetime, отзыв/блокировка, история, цена дня и уведомления.
- Админка: контент и публикация глав, версии, иллюстрации/тайминги, R2-библиотека,
  трансляции, сайт (about/support/community, переводчики, соцсети, реквизиты,
  зеркала), пользователи и подписки, аналитика прослушиваний и доходов.
- Тёмная/светлая тема, адаптив, PWA-установка.

## Стек

| Слой           | Технологии                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------- |
| UI             | SvelteKit `^2.70.3`, Svelte `^5.57.2` (runes), Tailwind CSS `^4.3.3`, shadcn-svelte `vega`, bits-ui |
| Сервер         | Node (adapter-node), better-auth `~1.6.33` + `better-auth-telegram`, Discord OAuth2/Bot API         |
| БД             | PostgreSQL 18 + Drizzle ORM `^0.45.4`                                                               |
| Клиентский кэш | Dexie `^4.4.6` (IndexedDB), OPFS, CacheStorage                                                      |
| PWA            | vite-plugin-pwa `injectManifest`, Workbox 7                                                         |
| Медиа          | Cloudflare R2 (S3 API), sharp `^0.35.5`, blurhash                                                   |
| Тесты          | `node:test` + tsx (`test:coverage`), Playwright, axe                                                |
| Tooling        | TypeScript `^6.0.3`, Vite `^8.3.4`, pnpm 11.7.0, Node 26                                            |

Точные версии — `package.json`.

## Быстрый старт

```bash
cp .env.example .env          # BETTER_AUTH_SECRET и провайдеры
pnpm install
docker compose up -d db       # или docker compose up -d
pnpm db:migrate               # 0000–0035
pnpm db:seed                  # опционально; сервер сеет сам
pnpm dev                      # http://localhost:5173
```

- `BETTER_AUTH_SECRET` обязателен, ≥32; без него падение на старте.
- Для HTTPS-домена нужны Traefik + сертификаты (`certs/`, `dynamic/dev.yaml`).
- Production: `docker build -t hedgehog-x:prod .` и
  `docker compose -f compose.yaml -f compose.prod.yml up -d --build`.
- Подписка/трансляции опциональны: без Telegram/Discord env работают книги,
  плеер и админка; см. `docs/OPERATIONS.md`.

## Скрипты

| Команда                     | Назначение                              |
| --------------------------- | --------------------------------------- |
| `pnpm dev`                  | Vite dev (5173)                         |
| `pnpm build`                | Production-сборка; типы не проверяет    |
| `pnpm preview`              | Preview (4173)                          |
| `pnpm check`                | sync + svelte-check                     |
| `pnpm lint` / `pnpm format` | prettier + eslint / автоформат          |
| `pnpm test:unit`            | Unit (38 файлов, 275 тестов)            |
| `pnpm test:coverage`        | Unit + experimental coverage            |
| `pnpm test:e2e`             | Playwright (нужен `BETTER_AUTH_SECRET`) |
| `pnpm test:docker`          | E2E в Docker                            |
| `pnpm db:generate`          | Миграция из diff                        |
| `pnpm db:migrate`           | Применить 0000–0035                     |
| `pnpm db:seed`              | Seed 2/4/10/4                           |
| `pnpm db:studio`            | Drizzle Studio                          |
| `pnpm db:push`              | Dev-shortcut                            |
| `pnpm admin:grant <email>`  | role=admin                              |
| `pnpm auth:schema`          | Перегенерация auth-схемы                |

## Порты

| Что                        | Порт |
| -------------------------- | ---- |
| Vite dev                   | 5173 |
| Vite preview / Playwright  | 4173 |
| Traefik preview            | 5174 |
| App production (в compose) | 3000 |
| PostgreSQL                 | 5432 |
| dbgate (dev)               | 3000 |
| Umami (dev)                | 3001 |

## Структура

```text
src/
  routes/                страницы, /api, /admin, /health, /sitemap.xml
  lib/server/            auth, db, broadcasts, subscriptions, site, storage, metrics
  lib/client/            Dexie, sync, broadcast player/chat, session, downloads
  lib/broadcasts/        правила эфира
  lib/subscriptions/     правила подписки
  lib/components/        UI, плеер, контент, админка, site, 28 каталогов ui/
  lib/audio-store*.ts    состояние плеера
  lib/html-audio.ts      HTMLAudioElement + OPFS/cache/URL
  lib/analytics/         валидация/агрегаты прослушивания
  service-worker.ts      precache, pages (denylist), audio
drizzle/                 36 миграций 0000–0035 + meta
e2e/                     Playwright, 9 файлов
scripts/                 migrate, entrypoint, grant-admin, normalize-storage,
                         backfill-donation-ledger, serveo-webhook, TLS
static/                  аудио/изображения/видео/QR/PWA
docs/                    архитектура, карта, домен, операции, тесты
```

## Документация

- [AGENTS.md](AGENTS.md) — правила/алгоритмы для ИИ.
- [docs/README.md](docs/README.md) — индекс.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — потоки и подсистемы.
- [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) — исчерпывающая карта.
- [docs/DOMAIN.md](docs/DOMAIN.md) — глоссарий/инварианты.
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — запуск/БД/деплой.
- [docs/TESTING.md](docs/TESTING.md) — тесты/проверка.

## Лицензия

Проприетарная. См. [LICENSE](LICENSE): код и контент принадлежат HEDGEHOG.INC;
использование/копирование/изменение/распространение без письменного разрешения
запрещены.
