# HEDGEHOG.INC / hedgehog-x

Русскоязычное PWA-приложение для прослушивания аудиокниг: онлайн, офлайн и с
синхронизацией прогресса между устройствами. Контент — озвучки HEDGEHOG.INC
(«Повелитель», «Реинкарнация безработного» и будущие книги).

> Это не учебный шаблон. Проект находится в активной разработке; перед запуском
> и особенно перед деплоем прочитайте [docs/AUDIT.md](docs/AUDIT.md) — там
> перечислены известные P0/P1-проблемы.

## Что умеет

- Каталог книг → тома → главы; иллюстрации тома и Telegram-обсуждение.
- Глобальный плеер: play/pause, seek, скорость, громкость, таймер сна,
  закладки с заметками, автопереход, undo seek.
- Офлайн: скачивание глав в OPFS, прослушивание без сети, PWA-кэш страниц.
- Синхронизация прогресса/лайков/закладок для авторизованных; локальная работа
  для гостей.
- Вход через Telegram (OIDC) и Discord; привязка нескольких способов входа.
- Админка: книги, тома, главы, иллюстрации; загрузка медиа в Cloudflare R2
  (WebP + BlurHash + theme color), аналитика прослушиваний, пользователи и подписки.
- Управление сайтом из админки: тексты страниц, обратная связь, медиа-прокси,
  динамические CDN-зеркала и привязка аккаунтов к разработчикам/переводчикам.
- Прямые трансляции глав: расписание, синхронизированное аудио, чат с антифлудом,
  запись/replay с чатом по таймингу, иллюстрации на фоне и live-аналитика.
- Тёмная/светлая тема, адаптивный интерфейс, PWA-установка.

## Стек

| Слой           | Технологии                                                               |
| -------------- | ------------------------------------------------------------------------ |
| Фронтенд       | SvelteKit 2 / Svelte 5 (runes), Tailwind CSS v4, shadcn-svelte + bits-ui |
| Сервер         | Node (adapter-node), better-auth                                         |
| БД             | PostgreSQL 18 + Drizzle ORM (postgres-js)                                |
| Клиентский кэш | Dexie/IndexedDB, OPFS, CacheStorage                                      |
| PWA            | vite-plugin-pwa (injectManifest), Workbox                                |
| Медиа          | Cloudflare R2 (S3 API), sharp, blurhash                                  |
| Аналитика      | собственные heartbeat'ы + Umami (опционально)                            |
| Тесты          | node:test + tsx, Playwright                                              |

## Быстрый старт

```bash
cp .env.example .env          # заполнить BETTER_AUTH_SECRET и провайдеров
pnpm install
docker compose up -d db       # или pnpm dev:all
pnpm db:migrate               # собрать схему из миграций (0000–0034)
pnpm db:seed                  # опционально; сервер выполняет seed сам при старте
pnpm dev
```

Откройте http://localhost:5192. Для HTTPS-доменов *.hedgehog-inc.localhost
нужны сертификаты mkcert и Traefik (см. [docs/OPERATIONS.md](docs/OPERATIONS.md)).

**Обязательно:** BETTER_AUTH_SECRET (32+ символа). Без него приложение падает
на старте. `db:migrate` — рабочий способ; `db:push` оставлен как dev-shortcut и
может удалять колонки, не используйте его как основной путь.

## Скрипты

| Команда                                                          | Назначение                            |
| ---------------------------------------------------------------- | ------------------------------------- |
| pnpm dev                                                         | Vite dev-сервер                       |
| pnpm build                                                       | production-сборка (adapter-node)      |
| pnpm preview                                                     | предпросмотр сборки                   |
| pnpm check                                                       | svelte-check (проходит)               |
| pnpm lint / pnpm format                                          | prettier + eslint / автоформат        |
| pnpm test:unit                                                   | unit-тесты (node:test)                |
| pnpm test:coverage                                               | unit + покрытие Node                  |
| pnpm test:e2e                                                    | Playwright (нужен BETTER_AUTH_SECRET) |
| pnpm test:docker                                                 | e2e в Docker (tmpfs Postgres)         |
| pnpm db:push                                                     | dev-shortcut (может удалять колонки)  |
| pnpm db:seed / db:studio                                         | сид / Drizzle Studio                  |
| pnpm db:migrate                                                  | применить миграции 0000–0034          |
| docker build -t hedgehog-x:prod .                                | production-образ                      |
| docker compose -f compose.yaml -f compose.prod.yml up -d --build | production-стек                       |

## Структура

```text
src/
  routes/            страницы, /admin, /api
  lib/
    server/          auth, db, storage (R2), seed
    client/          Dexie, sync, auth, downloads
    components/      UI (shadcn) + плеер + контент
    audio-store...   глобальный store плеера
    html-audio.ts    HTMLAudioElement + OPFS
drizzle/             миграции 0000–0034 (0005 — no-op, 0006 — catch-up)
e2e/                 Playwright
static/              медиа и PWA-ассеты
docs/                архитектура, карта, аудит, операции
```

## Документация

Начните с [AGENTS.md](AGENTS.md) — это входная точка для агентов и разработчиков.

- [docs/README.md](docs/README.md) — индекс и порядок чтения.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — как устроены потоки и подсистемы.
- [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) — маршруты, API, БД, модули, env.
- [docs/DOMAIN.md](docs/DOMAIN.md) — глоссарий и инварианты.
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — запуск, тесты, Docker, деплой.
- [docs/AUDIT.md](docs/AUDIT.md) — дефекты, риски, расхождения, приоритеты.

## Статус

Снимок 2026-11-25 (ветка `dsh-da32b3f2-1fd5`, последний коммит `183aa41`; рабочее дерево без коммита):

- pnpm build — проходит; pnpm lint — чисто; pnpm test:unit — 250/250 (35 файлов).
- `pnpm test:coverage` — 88.00% строк / 82.89% ветвей / 65.66% функций для модулей, загруженных unit-тестами (не весь проект).
- pnpm check — **зелёный** (0 ошибок).
- E2E — 48/48 при `--workers=1` (тесты внешних OAuth-редиректов всё ещё зависят от сети), интеграционный — 3/3.
- db:migrate — **работает**; БД пересобрана из миграций, схема совпадает с schema.ts.
- production-деплой собран: `Dockerfile`, app-сервис в `compose.prod.yml`, миграции при старте, `/health`, graceful shutdown — проверено на чистой БД.
- Гость больше не теряет прогресс/закладки при заходе в книгу — **P0-01 исправлен**, есть e2e.
- Офлайн-закладки синхронизируются при возврате в сеть — **P0-03 исправлен**, есть e2e и проверка с реальной БД.
- Logout/истечение сессии очищают локальные личные данные; guest→аккаунт — только с явным согласием (кроме нового аккаунта) — **P0-05 исправлен**.
- P1 закрыт: SSR/404/OG, очистка истории, безопасные redirects, token storage, R2, admin, analytics, индексы, CI.

Подробности и порядок исправлений — в [docs/AUDIT.md](docs/AUDIT.md).

## Лицензия

Не указана. Контент аудиокниг принадлежит HEDGEHOG.INC; код — авторам проекта.
