# AGENTS.md — инструкции для ИИ-агента

Это входная точка для любого агента в репозитории `hedgehog-x`.
Документ описывает **правила и алгоритмы**, а не историю. Карта —
[docs/PROJECT_MAP.md](docs/PROJECT_MAP.md), архитектура —
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), домен —
[docs/DOMAIN.md](docs/DOMAIN.md), запуск — [docs/OPERATIONS.md](docs/OPERATIONS.md),
тесты — [docs/TESTING.md](docs/TESTING.md).

## 0. Проект

`hedgehog-x` — русскоязычное PWA для аудиокниг HEDGEHOG.INC: каталог, версии
озвучки, плеер, офлайн, live/replay трансляции с чатом, Boosty-подписка через
Telegram/Discord, редактируемый сайт и SSR-админка.

Стек: SvelteKit 2 + Svelte 5 (runes), adapter-node, PostgreSQL 18 + Drizzle,
Dexie/OPFS, better-auth, Cloudflare R2, Tailwind v4 + shadcn-svelte,
vite-plugin-pwa (injectManifest).

Offline-first: сервер — истина, но контент книги и личные данные читаются из
Dexie; аудио — OPFS. Главная, каталог, книга, том, сайт, подписка, трансляции
и админка — SSR.

## 1. Первые шаги

1. Прочитайте этот файл целиком.
2. [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) §1–7 — масштаб/маршруты/API.
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §0–6 — потоки.
4. Перед БД — [docs/OPERATIONS.md](docs/OPERATIONS.md) §4.
5. Перед тестами — [docs/TESTING.md](docs/TESTING.md).

Если код и документ расходятся — прав код; обновите документ в той же правке.
Не создавайте историю изменений и списки «было/стало».

## 2. Нельзя ломать

1. **Hydrate/purge.** `hydrate(..., 'all')` с пустым/неполным ответом не стирает
   данные; `allowEmptyPurge` — только после auth/owner/queue.
2. **Гость и `/api/user/sync`.** Гость → 401; клиент не гидрирует пустой ответ;
   без `userId` — не гидрирует.
3. **Owner.** `meta.syncOwner` и `SyncItem.ownerUserId`; flush только текущего
   владельца; logout/expiry/switch очищают данные/очередь/owner.
4. **Пользователь — `locals.user`.** Не доверять `userId` из тела/query.
5. **SSR.** Не удалять `+page.server.ts` и 404 для книги/тома; не переносить
   книги/тома/каталог/главную/сайт/подписку/трансляции полностью в Dexie.
6. **Публикация.** `chapters.published` default false; публичные API/SSR
   отдают только true. Не показывайте неопубликованные главы без admin.
7. **Миграции.** `schema.ts` → `pnpm db:generate` → проверка SQL →
   `pnpm db:migrate` (0000–0035). Не редактировать применённые; `0005` no-op;
   `db:push` — только dev.
8. **R2.** Удалять заменяемые объекты через `deleteFromStorage` (content,
   broadcasts); в prod без R2 загрузки запрещены; не включать local fallback.
9. **Токен.** `session.token` не хранить в localStorage.
10. **Роли.** `user|admin|author`; `requireAdmin` = admin/author,
    `requireFullAdmin` = admin. Управление ролями/автором — только full admin;
    последнего админа снять нельзя.
11. **Подписка.** Не гейтить книги; она нужна для трансляций/чата/сообщества.
    `hasBroadcastAccess` = admin/author или active subscription. Не отключать
    проверку `blocked`/сессий.
12. **Трансляции.** `chapters.published` при старте; replay только при
    `saveRecording && publishedAt`; чат — live/replay с `chatEnabled`,
    500 символов, 5/10 с, allowlist ссылок.
13. **Sync actions.** Новое действие — producer + consumer + owner + тест.
14. **Валидация/лимиты.** Новые API: auth, размеры, корректные 4xx/5xx; батчи —
    лимит и транзакция; не добавлять unbounded-выборки.
15. **Секреты.** Не коммитить `.env`, R2/OAuth/Telegram secrets.
16. **UI.** Русские строки; `strings.ts` где возможно; никаких
    `alert/confirm/prompt` — `ConfirmModal`.
17. **Svelte 5 runes.** Без legacy stores/`$:`; общие runes — `*.svelte.ts`.
18. **SSR/SW-безопасность.** Общие .ts — без `window`/`document` на верхнем
    уровне и без импорта `svelte`.

## 3. Команды

| Команда                    | Что делает                 | Когда                             |
| -------------------------- | -------------------------- | --------------------------------- |
| `pnpm dev`                 | Vite dev 5173              | UI                                |
| `pnpm build`               | Сборка (типы не проверяет) | Перед PR                          |
| `pnpm preview`             | Preview 4173               | SSR/бандл                         |
| `pnpm check`               | sync + svelte-check        | Перед PR                          |
| `pnpm lint`                | prettier + eslint          | Перед PR                          |
| `pnpm test:unit`           | 270 unit                   | Логика                            |
| `pnpm test:coverage`       | Unit + coverage            | По необходимости                  |
| `pnpm test:e2e`            | Playwright                 | UI/потоки                         |
| `pnpm test:docker`         | E2E Docker                 | CI/по необходимости               |
| `pnpm db:generate`         | Миграция из diff           | После schema                      |
| `pnpm db:migrate`          | 0000–0035                  | После generate                    |
| `pnpm db:seed`             | Seed                       | Локально                          |
| `pnpm admin:grant <email>` | admin                      | Production                        |
| `pnpm auth:schema`         | auth-схема                 | С `ALLOW_AUTH_SCHEMA_OVERWRITE=1` |

Минимум: unit, check, lint; для UI — build + ручная проверка. `build` не
заменяет `check`.

## 4. Устройство

```text
Браузер: UI → Dexie → syncQueue → /api/user/sync
          audioStore ↔ htmlAudio (OPFS/cache/URL), broadcast progress отдельно
Сервер: hooks → SSR/API → Drizzle → PostgreSQL
        broadcasts/subscriptions/site content/R2/media proxy
PWA: SW injectManifest, pages denylist, audio cache
```

- Контент: books → volumes → chapters (published) / illustrations /
  chapter_illustrations.
- Личное: progress/likes/bookmarks, version_id в ключе.
- Broadcasts: состояние, чат, слушатели, просмотры, прогресс.
- Subscriptions: manual/Boosty Telegram/Discord, events, price, donations.
- Site: site_pages/site_settings/translators.
- Auth: better-auth, roles user/admin/author.
- Админка: content/broadcasts/site/users/integrations.

## 5. Где что искать

| Нужно          | Файлы                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Страница       | `src/routes/**/+page.svelte`, `+page.server.ts`                                                 |
| API            | `src/routes/api/**/+server.ts`, `feedback/+server.ts`                                           |
| Схема/миграции | `server/db/schema.ts`, `drizzle/*.sql`                                                          |
| Auth/роли      | `server/auth.ts`, `server/admin.ts`, `client/session*`                                          |
| Синхронизация  | `client/services/*`, `client/db/*`                                                              |
| Трансляции     | `server/broadcasts.ts`, `lib/broadcasts/domain.ts`, `api/broadcasts/**`, `routes/broadcasts/**` |
| Подписки       | `server/subscriptions/*`, `lib/subscriptions/domain.ts`, `routes/subscription`                  |
| Сайт           | `server/site-content.ts`, `site-settings.ts`, `routes/admin/site`                               |
| Плеер          | `audio-store`, `html-audio`, `ui/audio/provider`, `components/audio/*`                          |
| Загрузки/OPFS  | `client/downloads/*`, `html-audio.ts`                                                           |
| PWA            | `service-worker.ts`, `client/page-cache.ts`, `vite.config.ts`                                   |
| R2             | `server/storage/r2.ts`, `admin/content`, `admin/broadcasts`                                     |
| Аналитика      | `analytics/stats.ts`, `listeningTracker`, `api/analytics/listen`, `admin/analytics`             |
| Тесты          | `src/**/*.test.ts`, `e2e/*.e2e.ts`                                                              |

## 6. Код

### Svelte/UI

- Runes; без stores и `$:`. `$derived(expr)`/`$derived.by`.
- `*.svelte.ts` — runes-модули; не импортировать в server/SW.
- UI — `$lib/components/ui/<name>`; корневого barrel нет; kbd/popover нет.
- Tailwind-токены; hex — брендовые иконки/поддержка; тёмная тема `.dark`.
- Space уже один; не добавлять дубли.

### TS/SSR

- strict, `unknown` вместо `any`; `$lib`/`$lib/server`.
- SSR/SW-safe модули без `window` на верхнем уровне.
- Клиентские данные — Dexie/liveQuery.

### Сервер/БД

- Drizzle; сырой SQL — редко.
- Валидация `boundedText`, `timestampSeconds`, статусы, hex.
- Транзакции для батчей; `isUniqueViolation`.
- Кэш: private no-store для личного; публичное — осознанно.
- Логи `createLogger`.

### Клиент/данные

- Оптимистично в Dexie → очередь → flush.
- Owner в `meta.syncOwner`/`ownerUserId`.
- Пустой `hydrate('all')` без `allowEmptyPurge` запрещён.
- Загрузки: квота/размер/partial.
- OPFS-имена — только через `opfsAudioFileName`.

## 7. Алгоритмы

### 7.1. Поле контента

1. `schema.ts` + index/check.
2. `db:generate` → SQL → `db:migrate`.
3. `admin/content` + форма.
4. `api/books/[bookId]` (select/relations).
5. `mappers.ts` + `Offline*`.
6. Seed/тесты.
7. PROJECT_MAP §8 + DOMAIN.

### 7.2. API

1. `+server.ts`; auth; Origin/CSRF для state-changing.
2. Валидация/лимиты; красные 4xx/5xx; без секретов.
3. Private no-store для личного.
4. Unit + e2e.
5. PROJECT_MAP §4.

### 7.3. Страница

1. `+page.svelte`; `+page.server.ts` для SSR.
2. Dexie — `useDexie`.
3. meta/OG.
4. SSR/404/mobile.
5. nav/PROJECT_MAP.

### 7.4. Синхронизация

1. `SyncItem.action`.
2. Producer: Dexie + queue + owner.
3. Consumer: flush + retry + удаление после успеха.
4. Сервер: `/api/user/sync` (валидация/транзакция) или endpoint.
5. Owner/replace guard; тест.
6. ARCHITECTURE §5.3.

### 7.5. Плеер

- Состояние — store; DOM — htmlAudio; provider — мост.
- Retry только provider; persist 5 с/изменения.
- Broadcast: `broadcastId/broadcastLive`, отдельный progress key.
- Проверить live/replay/OPFS/ошибки/drawer.

### 7.6. Офлайн/PWA

- downloadManager: sequential, 50 МБ, content-length, OPFS, partial.
- htmlAudio: OPFS → cache → URL; blob revoke.
- SW: pages denylist, audio CacheFirst; manual register.
- Не кэшировать personal/subscription/broadcasts.
- `opfsAudioFileName` для версий.

### 7.7. Админка/R2

- `requireAdmin`/full admin; published; validation.
- R2 limits 15/500/100, magic; rollback; delete old.
- Media library `/api/admin/r2/files`.
- No pagination content/users; limit search.
- PROJECT_MAP/ARCHITECTURE §9.

### 7.8. Трансляции

- `broadcastKind`, start/end/publish; chapter published.
- Access: subscription/admin/author; chat flags.
- Chat limits/allowlist/reactions; illustrations via chapter timings.
- Progress/heartbeat/status; replay flags.
- Admin broadcasts + API + tests.

### 7.9. Подписка

- `subscriptions`/sources/events/ledger; active formula.
- Manual grant/revoke/restore/block; price/notices.
- Boosty: Telegram/Discord checks; webhook.
- Blocked sessions; not a content gate.
- Tests `subscriptions/domain`, `/admin/users`, `/subscription`.

### 7.10. Сайт

- `site_pages`/translators/settings; sanitize URL.
- Admin site; public loads; defaults.
- Media/mirrors; link-preview allowlist.
- Update DOCS.

### 7.11. Auth

- server/auth.ts; client session/accounts; safe redirect.
- Roles/full admin; page-cache denylist; token not stored.
- Test both domains.

### 7.12. Тесты

- Unit `*.test.ts`; e2e `*.e2e.ts`; mocks; no real R2.
- DB integration skip without secret; cleanup.
- TESTING §7.

### 7.13. Docs

- Schema/API/flow/deploy → PROJECT_MAP + ARCHITECTURE.
- Rules → AGENTS; tests → TESTING.
- No history/audit files.

## 8. Перед сдачей

- [ ] `pnpm test:unit` (270).
- [ ] `pnpm check` 0 ошибок.
- [ ] `pnpm lint`.
- [ ] `pnpm build`.
- [ ] Ручной сценарий TESTING §8 для UI/плеера/трансляций/подписки.
- [ ] `db:generate` не создаёт лишнего.
- [ ] Нет секретов/токенов.
- [ ] Документы обновлены.

Если окружение не позволяет (нет .env/node_modules/Node 26) — укажите это и не
выдавайте непроверенное за проверенное.

## 9. Ловушки

1. Rate limit'ы/кэши in-memory на процесс: sync 120/мин, analytics 60/мин,
   admin/API admin 30/мин, chat 5/10 с, link-preview 20/мин, subscription
   cache 10 с, active broadcast cache.
2. `broadcast_illustrations` — legacy; читается `chapter_illustrations`.
3. `chapters.published` default false; забытая публикация скрывает главу.
4. `buildDailyStatId` — 42 символа.
5. `syncBookDetails` — `Promise.all`, не атомарно.
6. Admin content/users без пагинации; поиск limit 20/30.
7. `broadcastKind` ленивый; live = startedAt+duration; replay требует
   `saveRecording && publishedAt`.
8. CSP `unsafe-inline`; HSTS/nonce нет; CSRF-токенов нет.
9. `/api/user/progress/clear` и `/api/user/delete` без rate limit; delete
   проверяет Origin/Sec-Fetch-Site.
10. `/api/media` 302 при direct; кэш 10 МиБ/файл и 100 МиБ total.
11. OPFS-имена версий кодируются; default старый формат.
12. `role=author` исключён из статистики; управление ролями — только full admin.
13. Blocked subscription удаляет сессии; restore/revoke замораживает остаток.
14. Bookmark с чужим id → PK-конфликт sync → 500.
15. Analytics/ listen без транзакции; nullable UNIQUE.
16. Нет UI repeat/shuffle/queue и мобильной громкости; setPositionState нет.
17. Media proxy/mirrors из site_settings; admin site управляет.
18. Удаление аккаунта обезличивает аналитику/донаты, но не удаляет их.

## 10. Отчёт

- Что изменено (файлы).
- Что проверено командами/результат.
- Что не проверено и почему.
- Какие документы обновлены.
- Риски/ограничения.
