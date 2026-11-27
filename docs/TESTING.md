# TESTING.md — тесты и проверка

Документ описывает текущий набор тестов, окружение и правила добавления.
Запуск/деплой — [OPERATIONS.md](OPERATIONS.md).

## 1. Стек

- Unit: `node:test` + `tsx`, файлы `src/**/*.test.ts`, БД не нужна.
- E2E: Playwright + Chromium, `e2e/*.e2e.ts`, `@axe-core/playwright`.
- Docker E2E: `compose.test.yml` + `Dockerfile.test`.
- CI: `.github/workflows/ci.yml`.

## 2. Unit

```bash
pnpm test:unit
pnpm test:coverage   # experimental-test-coverage
```

38 файлов, 275 вызовов `test()/it()`.

| Файл                                                  | Тестов | Что проверяет                   |
| ----------------------------------------------------- | -----: | ------------------------------- |
| `src/routes/api/analytics/analytics.test.ts`          |     30 | Валидация/даты/ID/агрегаты      |
| `src/lib/components/share/share.test.ts`              |     23 | Share-ссылки/тексты             |
| `src/lib/components/ui/pagination/pagination.test.ts` |     23 | Пагинация UI                    |
| `src/routes/settings/settings.test.ts`                |     23 | Настройки/зеркала/кэш           |
| `src/lib/utils/mirror.test.ts`                        |     24 | Зеркала/default/ru/auto         |
| `src/lib/components/seo/og.test.ts`                   |     18 | OG/Twitter                      |
| `src/lib/subscriptions/domain.test.ts`                |     13 | Дни/цена/lifetime/block/sources |
| `src/lib/client/services/likeService.test.ts`         |     10 | Like/очередь/owner              |
| `src/lib/server/site-content.test.ts`                 |      8 | Site pages/sanitize/translators |
| `src/lib/audio-version.test.ts`                       |      7 | Ключи/OPFS-имена                |
| `src/lib/client/broadcast-player.test.ts`             |      6 | Удаление/resume replay          |
| `src/lib/client/services/syncPolicy.test.ts`          |      6 | skip/merge/replace/switch       |
| `src/lib/delete-confirm.test.ts`                      |      6 | Кнопки удаления                 |
| `src/lib/server/site-settings.test.ts`                |      6 | Media/mirrors normalizers       |
| `src/lib/server/telegram-id.test.ts`                  |      5 | Telegram ID из OIDC claims      |
| `src/lib/client/auth-storage.test.ts`                 |      5 | Кэш без токена/TTL              |
| `src/lib/server/storage/r2.test.ts`                   |      5 | WebP/blurhash/upload/delete     |
| `src/lib/client/services/listeningTracker.test.ts`    |      4 | Heartbeat/offline               |
| `src/lib/server/broadcasts.test.ts`                   |      4 | Kind/chat/replay                |
| `src/lib/server/db/migration-safety.test.ts`          |      4 | Миграции/инварианты             |
| `src/lib/server/db/seed.test.ts`                      |      4 | DEFAULT_BOOKS/файлы             |
| `src/lib/server/og-preview.test.ts`                   |      4 | SSRF/allowlist                  |
| `src/lib/utils/social-links.test.ts`                  |      4 | Соцсети                         |
| `src/routes/api/books/books.test.ts`                  |      4 | ETag/данные                     |
| `src/lib/audio-queue.test.ts`                         |      3 | repeat/shuffle                  |
| `src/lib/client/downloads/downloadUtils.test.ts`      |      3 | Квота/_cors                     |
| `src/lib/logger.test.ts`                              |      3 | Уровни/формат                   |
| `src/lib/server/db/errors.test.ts`                    |      3 | isUniqueViolation               |
| `src/lib/server/feedback.test.ts`                     |      3 | safe target                     |
| `src/lib/utils/validation.test.ts`                    |      3 | Текст/секунды/hex               |
| `src/lib/volume/illustration-lock.test.ts`            |      3 | Lock иллюстраций                |
| `src/lib/utils/safeRedirect.test.ts`                  |      2 | Internal path                   |
| `src/lib/constants/strings.test.ts`                   |      1 | Словарь                         |
| `src/lib/utils/format.test.ts`                        |      1 | Bytes                           |
| `src/lib/utils/pagination.test.ts`                    |      1 | clamp/count                     |
| `src/lib/utils/slugify.test.ts`                       |      1 | Транслит                        |
| `src/lib/utils/time.test.ts`                          |      1 | Duration                        |
| `src/lib/volume-audio.test.ts`                        |      1 | Аудио тома                      |

Особенности: r2.test пишет во временный каталог; seed.test не требует БД;
listeningTracker импортирует Dexie и переносит отсутствие IndexedDB;
migration-safety проверяет инварианты миграций без живой БД.

## 3. E2E

```bash
BETTER_AUTH_SECRET='test-secret-at-least-32-characters-long-key' \
BETTER_AUTH_ALLOWED_HOSTS='localhost,localhost:4173' \
BETTER_AUTH_FALLBACK_URL='http://localhost:4173' \
pnpm exec playwright test --workers=1
```

`playwright.config.ts`: `pnpm preview` 4173, chromium,
`testMatch **/*.e2e.{ts,js}`, `reuseExistingServer:!CI`.

9 файлов, 45 тестов (+1 условный `test.skip` интеграционного файла без секрета):

| Файл                                | Тестов | Что проверяет                           |
| ----------------------------------- | -----: | --------------------------------------- |
| `a11y.e2e.ts`                       |      1 | Axe: /, /books, /about, /auth           |
| `auth.e2e.ts`                       |      6 | Telegram/Discord redirects/errors       |
| `bookmark-sync.e2e.ts`              |      1 | offline bookmark → POST                 |
| `catalog.e2e.ts`                    |      1 | Каталог/фильтр (seed)                   |
| `delete-account.integration.e2e.ts` |      3 | Реальное удаление + каскады             |
| `navigation-and-content.e2e.ts`     |      4 | Community/support/mobile/admin redirect |
| `profile.e2e.ts`                    |     14 | Профиль/accounts/delete                 |
| `session-isolation.e2e.ts`          |      5 | logout/expiry/owner                     |
| `sync-data-safety.e2e.ts`           |     10 | 401/guest/offline/switch/consent        |

Моки: OAuth-домены, `/api/user/sync`, auth-session, accounts; fixtures/page-objects
нет.

## 4. Docker E2E

```bash
pnpm test:docker
pnpm test:docker:down
```

Postgres 18 tmpfs + Playwright; `db:migrate` → `db:seed` → `build` → test.

## 5. CI

`.github/workflows/ci.yml`: Postgres 18, Node 26, pnpm 11.7.0;
`install --frozen-lockfile` → `lint` → `check` → `test:unit` →
`db:migrate` → `db:generate` → `git diff --exit-code -- drizzle` → `db:seed` →
`build` → `playwright install` → `playwright test --workers=1`.

Env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_ALLOWED_HOSTS`,
`BETTER_AUTH_FALLBACK_URL`, `ORIGIN`.

## 6. Покрытие

Покрыто: аналитика/даты, OG/share, пагинация, настройки, зеркала, sync policy,
likes, auth-storage, download utils, safe redirect, validation, seed, R2,
broadcast kind/chat/replay, subscription domain, site content/settings,
feedback, OG-preview, illustration lock, migrations.

E2E: auth, profile, delete-account, catalog, a11y, navigation, sync safety,
bookmark flush, session isolation.

Не покрыто: `downloadManager`, `audioStore`, `audio-provider`, `html-audio`,
admin form actions, broadcast API/live UI, subscription UI, media proxy,
metrics/health, hooks/CSP, OPFS/WebLocks в реальном браузере.

## 7. Как добавлять

Unit: файл рядом, `*.test.ts`, `node:test`; не писать в `static/uploads`,
не ходить в реальный R2; для Dexie — чистая логика или перенос отсутствия
IndexedDB.

E2E: `e2e/*.e2e.ts`, мокать OAuth/сеть, не добавлять реальные переходы;
интеграционные с БД — `test.skip(!secret)`, чистить данные; webServer — preview 4173.

## 8. Ручная проверка

1. Гость: книга/глава/прогресс после refresh; лайк → модалка входа.
2. Вход существующего с гостевыми данными → consent; отказ чистит.
3. Logout→другой аккаунт: данные/очередь не текут.
4. Offline: закладка/прогресс/лайк → online flush.
5. Скачивание/OPFS/отмена; версия; удаление с broadcast-чатом.
6. Плеер: play/seek/speed/volume/sleep/undo/auto/Space.
7. Трансляция: live sync, heartbeat/listeners, чат/реакции/replay, удаление
   админом → плеер очищается.
8. Подписка: статус, Boosty-источник, grant/revoke/block, цена/уведомление,
   blocked login.
9. Админка: content published/тайминги/R2 picker; broadcasts; site; users.
10. PWA install/offline/update; мобильный drawer.
11. A11y: axe на ключевых страницах.
