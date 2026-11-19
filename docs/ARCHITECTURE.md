# ARCHITECTURE.md — как реально устроен Hedgehog X

> Снимок 2026-11-18 (dev / 5f67c5d). Документ объясняет **поведение системы**,
> а не перечисляет файлы (для файлов — [PROJECT_MAP.md](PROJECT_MAP.md)).
> Все обнаруженные дефекты и расхождения — в [AUDIT.md](AUDIT.md).

## 0. Резюме в 12 строках

Hedgehog X — SvelteKit-приложение с **клиентским кэшем как основным источником
чтения**. PostgreSQL хранит контент и (для авторизованных) активность; сервер отдаёт
её JSON-эндпоинтами. Браузер гидрирует ответы в **Dexie/IndexedDB**; страницы
подписаны на Dexie через liveQuery и не имеют серверных данных контента.
Плеер — глобальный runes-store + singleton HTMLAudioElement; аудио умеет играть
из OPFS (скачано), из legacy CacheStorage или по URL. Прогресс/лайки/закладки
пишутся локально и синхронизируются пакетами; прослушивание отдельно
телеметрируется heartbeat'ами. Админка — SSR-панель с form actions и загрузкой
медиа в R2. PWA кэширует страницы (NetworkFirst) и аудио (CacheFirst), а также
регистрирует собственный service worker. Авторизация — better-auth (Telegram OIDC,
Discord), роли — в user.role. Главная — статичная витрина, не каталог из БД.

## 1. Контекст и топология

```text
┌──────────────────────────── Browser (PWA) ────────────────────────────┐
│  Svelte 5 UI (SSR shell + hydration)                                  │
│    │ useDexie/liveQuery          │ audioStore            │ auth hooks  │
│    ▼                             ▼                       ▼             │
│  Dexie "HedgehogDB"        HTMLAudioElement        better-auth client │
│  10 stores                 (URL / blob:OPFS)        (fetch /api/auth)  │
│    │                             ▲                                    │
│    │ syncService (fetch)         │ downloadManager → OPFS             │
│    ▼                             │                                    │
│  Service Worker: pages-cache, audio-cache, precache                   │
└───────────────┬───────────────────────────────────────────────────────┘
                │ HTTPS /api/*, / (SSR HTML)
┌───────────────▼──────────────────── Node (adapter-node) ──────────────┐
│  hooks.server.ts: auth.api.getSession → locals → svelteKitHandler     │
│  /api/books, /api/books/[id]        /api/user/sync, /api/user/delete  │
│  /api/analytics/listen             /api/auth/* (better-auth)          │
│  /admin/** form actions (requireAdmin)                                │
│                      │ Drizzle/postgres-js                            │
└──────────────────────┼─────────────────────────────────────────────────┘
                       ▼
             PostgreSQL 18 (14 tables)
                       ▲
        Cloudflare R2 (media)   Umami (optional)   Telegram (comments)
```

- **Один Node-процесс** (adapter-node); нет отдельного API-сервера.
- **Postgres** — единственное серверное хранилище; R2 — только медиа.
- **Umami** — отдельный контейнер/сервис, не критичен.
- **Traefik** — reverse proxy для dev и production; production app-сервис
  описан в `compose.prod.yml` (см. OPERATIONS §5.1).

## 2. Жизненный цикл запроса страницы

1. **Сервер.** SvelteKit принимает запрос. hooks.server.ts:
   - если !building, при старте модуля запускает ensureDefaultBooks() (fire-and-forget);
   - для /api/books* дополнительно await ensureDefaultBooks();
   - auth.api.getSession({ headers }) кладёт session/user в event.locals;
   - svelteKitHandler обрабатывает /api/auth/* и отдаёт управление.
2. **SSR страниц.** Большинство страниц не имеют +page.server.ts, поэтому SSR
   рендерит только каркас. useDexie на сервере возвращает fallback
   (undefined/[]), поэтому в HTML видно «Загрузка...» и дефолтные OG-теги.
3. **Hydration.** Браузер загружает JS, поднимает Dexie и liveQuery. Если URL —
   /books/:bookId, срабатывает universal +layout.ts:
   syncBookDetails(bookId) и syncUserData() (без await).
4. **Синхронизация.** syncService делает fetch, мапит ответ, вызывает hydrate
   (bulkPut + purge). liveQuery замечает изменения и перерисовывает компоненты.
5. **Навигация.** onNavigate использует View Transitions API; afterNavigate
   кладёт HTML страницы в pages-cache (если онлайн и ещё нет).
6. **PWA.** registerSW из virtual:pwa-register; service worker берёт контроль,
   страницы — NetworkFirst, аудио — CacheFirst.

**Следствие:** без JS контент не появляется; поисковики/соцсети видят fallback.
Это осознанный offline-first компромисс, но он не покрыт серверным рендерингом
(см. AUDIT P1-04).

## 3. Слои и границы

```text
routes/                       # композиция страниц; минимум логики
  +layout.svelte              # глобальный каркас
  books/...                   # страницы контента
  admin/...                   # SSR CRUD
  api/...                     # HTTP-контракты
lib/components/               # UI (в т.ч. 159 shadcn-примитивов)
lib/client/                   # браузерные сервисы/сторы/кэш
lib/server/                   # auth, БД, storage, admin guard
lib/*.svelte.ts, lib/*.ts     # плеер, логгер, утилиты
```

Правила границ:

- .svelte.ts (runes) — только клиент/компоненты; не импортировать из server/SW.
- lib/server/** — никогда не импортировать в клиент (кроме типов через
  typeof import(...) в syncService/mappers).
- lib/utils/**, constants/strings.ts, analytics/stats.ts — изотропные,
  безопасны для SSR/SW (без window на верхнем уровне).
- UI-примитивы импортируются из barrel index.ts.

## 4. Данные: сервер и контракты

### 4.1. Схема и идентификаторы

Полная схема — [PROJECT_MAP.md §7](PROJECT_MAP.md#7-база-данных). Ключевое:

- Контент: books → volumes → chapters/illustrations (FK cascade).
- Активность: listening_progress, volume_likes, chapter_likes, bookmarks
  (PK по user+сущность).
- Аналитика: listening_sessions (сырые сессии) и daily_listening_stats
  (агрегат по дате/книге/главе/пользователю).
- Auth: user/session/account/verification; user.role.
- ID — строки; контентные ID генерируются админкой/сидом; bookmarks.id — UUID.
- **Миграции соответствуют схеме** (после P0-02): 0000–0004 — история, 0005 —
  намеренный no-op, 0006 — catch-up (role/status/listening-таблицы/длины). Текущая
  БД пересобрана через db:migrate; `drizzle-kit generate` — no-op.

### 4.2. API-стиль

- Плоские +server.ts с RequestHandler; без OpenAPI/валидации схем (кроме
  ручной в analytics).
- Ошибки: json({error}, {status}); для 404 book — plain text Not found.
- Аутентификация: locals.user (hooks); в API — проверка наличия.
- Кэш: только /api/books/[bookId] (weak ETag SHA1 + must-revalidate);
  /api/user/sync и /api/books без cache-заголовков.
- Персональные данные не кэшируются на CDN; но и приватных заголовков нет.
- Мутации — JSON (кроме admin multipart form actions); нет CSRF-токенов/явного
  origin-check на +server.ts (SvelteKit form actions имеют встроенную защиту).

### 4.3. Почему ETag не гарантирует 304

Сервер корректно считает ETag и отвечает 304 при If-None-Match. Но
syncService.syncBookDetails **не отправляет** If-None-Match вручную; 304 возможен
только если браузер сам сделает условный запрос из HTTP-кэша. С
Cache-Control: public, max-age=0, must-revalidate это вероятно, но не гарантировано
(например, fetch с cache: 'no-store' или отключённый кэш → всегда 200).
См. AUDIT P2.

## 5. Offline-first (главная подсистема)

### 5.1. Поток чтения

```text
GET /api/books/[id] ──► syncService.syncBookDetails()
      │                        │
      │ (200 JSON)             ├─ mapServerBook/Volume/Chapter/Illustration
      │                        └─ hydrate('books'|'volumes'|'chapters'|'illustrations',
      │                                     data, purgeScope)
      ▼
Dexie  ◄──── useDexie(liveQuery) ◄──── страницы/компоненты
```

- hydrate в одной rw-транзакции делает bulkPut и удаляет записи, которых нет
  во входных данных:
  - 'all' — удалить всё, чего нет в массиве;
  - {index, values} — удалить только в рамках (например, volumeId).
- syncBookDetails:
  - 304 → ничего не делает;
  - 200 → гидрирует книгу, тома по bookId, главы/иллюстрации по всем volumeId
    (существующим + новым), удаляя осиротевшие;
  - ошибка сети → тихо оставляет кэш.
- syncBooks (список книг) **не вызывается**; каталог не гидрируется. Главная
  использует mockShowcase, поэтому новые книги не видны (AUDIT P2).

### 5.2. Поток пользовательских данных

```text
Dexie progress/likes/bookmarks ──► syncQueue (при offline/ошибке)
        ▲                                   │
        │ optimistic UI                     ▼
   likeService / bookmarkService / progressSync / listeningTracker
        │                                   │
        └──────────── fetch /api/user/sync ─┘
```

- syncUserData() fetch'ит /api/user/sync: на странице книги, при появлении
  авторизованной сессии и при `online` (root layout).
- Гость получает **401**; клиент не пишет в Dexie. Если при этом остался `syncOwner`
  от истёкшей сессии, локальные личные данные очищаются. Ошибка сети/5xx
  означает «оставить локальный кэш».
- Для авторизованного: `syncOwner` в Dexie `meta`; политика `merge/replace/switch`:
  guest + local data → явный consent (кроме нового аккаунта, `isNewUser`); same owner +
  empty queue → replace (сервер авторитетен); другой owner → clear + replace.
- Logout и истечение сессии: flush (если online), затем очистка локальных личных
  данных, очереди и `syncOwner`. Гость не видит данные предыдущего аккаунта.
- `hydrate(..., 'all')` с пустым массивом по умолчанию **не удаляет** данные;
  `allowEmptyPurge` передаётся только после проверки auth/owner/queue.
- Закладки: `bookmarkService` пишет в Dexie и сразу POST при online; при offline/
  ошибке — в `syncQueue`, который флашит `bookmarkSync` (online/start/manual sync).
- `syncQueue.ownerUserId` привязан к владельцу; flush отправляет только элементы
  текущего owner. Элементы без owner считаются гостевыми и не уходят под аккаунтом.

### 5.3. Очередь и её consumer'ы

| Action                      | Кто кладёт                      | Кто отправляет                 | Retry                  |
| --------------------------- | ------------------------------- | ------------------------------ | ---------------------- |
| UPDATE_PROGRESS             | progressSync                    | progressSync.flushOfflineQueue | по online              |
| LIKE_VOLUME/UNLIKE_VOLUME   | likeService                     | syncLikesQueue                 | по online/новому лайку |
| LIKE_CHAPTER/UNLIKE_CHAPTER | likeService                     | syncLikesQueue                 | то же                  |
| LISTEN_SESSION              | listeningTracker.enqueueOffline | flushOfflineQueue              | по online/visibility   |
| ADD_BOOKMARK                | bookmarkService (offline/error) | bookmarkSync                   | online/start/manual    |
| REMOVE_BOOKMARK             | bookmarkService (offline/error) | bookmarkSync                   | online/start/manual    |

- Manual sync вызывает likes + progress + bookmarks; listen-сессии в manual sync
  пока не входят.
- Каждый элемент `syncQueue` хранит `ownerUserId`; flush фильтрует по текущему
  владельцу, legacy/missing owner трактуется как guest.
- Нет лимита/дедупликации; при ошибке 4xx элементы не отбрасываются (кроме
  малформed likes с пустым id), поэтому один «плохой» элемент может блокировать
  очередь (analytics batch, progress).

### 5.4. Офлайн-аудио

downloadManager.svelte.ts:

1. enqueueDownload(chapter) / enqueueVolume(volumeId, chapters) пишут
   downloads со статусом queued.
2. processQueue берёт первый queued, качает последовательно:
   fetch(url + '?_cors=1') → fallback mirror → проверка navigator.storage.estimate
   (резерв 50 МБ) → чтение потока → запись в OPFS
   navigator.storage.getDirectory().getFileHandle(chapter.id, {create:true}).
3. Успех → downloaded; ошибка → error (частичный файл может остаться).
4. htmlAudio._load при наличии id сначала ищет OPFS-файл, затем legacy
   audio-cache, и только потом грузит URL.
5. Удаление: cancelDownload/deleteDownload → abort, удалить OPFS/кэш, удалить
   запись downloads; метаданные главы остаются в Dexie.

Ограничения:

- OPFS не везде доступен (Safari/Firefox — частично); fallback на запись отсутствует.
- Нет докачки/возобновления; сетевой обрыв оставляет partial.
- Нет квоты на размер скачанного; storage estimate только перед стартом.
- Скачанные файлы не шифруются; на shared device доступны другому пользователю.

### 5.5. Service worker и кэши

src/service-worker.ts:

- precacheAndRoute(self.__WB_MANIFEST) — ассеты сборки.
- NavigationRoute → NetworkFirst (pages-cache, timeout 3s, status 200);
  fallback: точный кэш → / → офлайн-HTML.
- CacheFirst('audio-cache') для request.destination === 'audio' или URL
  *.mp3, с RangeRequestsPlugin (важно для iOS/Safari).
- install: skipWaiting + прогрев /; activate: clients.claim().

Следствия:

- HTML авторизованных страниц может попасть в pages-cache (и после afterNavigate);
  на общем устройстве/другом аккаунте это риск утечки/устаревшего UI.
- audio-cache растёт без ограничений; OPFS и CacheStorage дублируют аудио.
- SW регистрируется вручную в +layout.svelte, хотя serviceWorker.register:false
  в SvelteKit — это осознанно.

### 5.6. Кэш авторизации

- auth-storage.ts хранит SessionData (включая session.token) и linked accounts
  в localStorage; TTL проверяется по expiresAt.
- useSession() — гибрид: initial из кэша, live-подписка на better-auth atom,
  сохраняет/чистит кэш; при 401/403 — очистка; при сетевой ошибке — кэш.
- useAccounts() — list/link/unlink/delete с offline-кэшем.
- Риски: XSS → кража токена; кэш общий для всех аккаунтов до выхода; better-auth
  cookie httpOnly не отменяет копию токена в JS-доступном хранилище.

## 6. Плеер и аудио

### 6.1. Три слоя

1. **audioStore** (src/lib/audio-store.svelte.ts) — единственный источник
   состояния: currentTrack, queue, isPlaying/isLoading/isBuffering/isError,
   volume/mute/rate, repeat/shuffle, currentTime/duration/progress/buffered,
   sleep timer, undo seek, prefs (seekStep/autoAdvance).
2. **htmlAudio** (src/lib/html-audio.ts) — singleton-обёртка над
   HTMLAudioElement: load (OPFS/legacy/URL), play/pause, seek, volume/fade,
   rate, retry (до 3), live-detect, buffer events, cleanup.
3. **AudioProvider** (ui/audio/provider/audio-provider.svelte) — мост:
   подписывается на события audio, обновляет store, грузит трек по
   $effect при смене currentTrack, сохраняет прогресс в Dexie каждые 5с,
   помечает completed на ended, ведёт sleep timer, персистит состояние.

### 6.2. Поток воспроизведения

```text
Клик play на главе (VolumeChaptersTab)
  → tracks = chapters.map(Track)
  → audioStore.setQueueAndPlay(tracks, index)
      → setQueue (resolveMediaUrl)
      → loadAndPlayTrack (currentTrack, isPlaying=true)
  → AudioProvider $effect видит currentTrack
      → htmlAudio.load({url,id,startTime})   // OPFS → cache → URL
      → htmlAudio.play()
  → <audio> timeupdate (throttled 100ms)
      → audioStore.syncTime
      → Dexie progress (каждые 5с)
      → progressSync.recordProgress (батч 30с)
      → listeningTracker.tick (heartbeat 30с, активное время)
  → ended
      → Dexie progress isCompleted=true
      → progressSync.flush
      → repeat-one? → sleep end? → autoAdvance? next : pause
```

- setQueueAndPlay формирует очередь из всех глав тома; startTime у выбранной
  главы = сохранённый прогресс.
- GlobalPlayer показывается при queue.length > 0; на мобиле — mini-bar + drawer.
- Прогресс хранится в секундах; завершение определяется по событию ended
  (не по проценту).
- Seek: audioStore.seek обновляет state + htmlAudio.setCurrentTime; undo —
  если скачок >10с, 6 секунд доступна отмена.
- Sleep timer: минуты (5..120) или «в конце главы»; тик каждую секунду, пока
  sleepTimerEndsAt; end_of_track проверяется в handleEnded.

### 6.3. Что важно знать

- **Repeat/shuffle/queue-манипуляции** реализованы в store, но **не имеют UI**;
  repeat всегда 'none', если не пришёл из localStorage (например, после старой
  версии). addToQueue/removeFromQueue/moveInQueue — мёртвый API.
- **Space**-хоткей вешается каждым смонтированным AudioPlayer.Play; на странице
  их несколько → возможен двойной toggle.
- **repeat='one'** обрабатывается **до** sleep-timer-end, поэтому таймер «в конце
  главы» не остановит повтор.
- **Resume** из закладки/истории делается через setTimeout(seek,100); если метаданные
  не загрузились — seek теряется. Надёжнее Track.startTime.
- **partial OPFS** при ошибке не удаляется; плеер может проиграть обрезанный файл.
- **Двойной retry**: htmlAudio (load/error) и AudioProvider (handleError →
  retryPlayback) могут конкурировать.
- **localStorage write** на каждый timeupdate (в AudioProvider effect зависит от
  currentTime), включая весь queue — потенциальные лаги/квота.
- Нет navigator.mediaSession (локскрин/медиа-клавиши) и wake lock.
- Нет громкости в мобильном drawer (кнопка Volume скрыта hidden md:flex).

## 7. Авторизация и аккаунты

### 7.1. Конфигурация better-auth

src/lib/server/auth.ts:

- drizzleAdapter(db, {provider:'pg'}); emailAndPassword.enabled=false.
- baseURL: если задан BETTER_AUTH_ALLOWED_HOSTS — объект
  {allowedHosts, fallback}, иначе undefined (better-auth выводит из запроса).
- user.additionalFields: telegramAvatar, telegramOidcUsername, discordAvatar,
  discordUsername, role (default user).
- Discord: mapProfileToUser пишет аватар/username, overrideUserInfoOnSignIn:true.
- Account linking: enabled, allowUnlinkingAll:false, allowDifferentEmails:true,
  trusted providers discord, telegram-oidc.
- Session create hook: если URL содержит /callback/{provider}, обновляет user.image
  на аватар провайдера (если отличается).
- Telegram plugin: loginWidget:false, oidc.enabled:true, scopes openid profile;
  mapOIDCProfileToUser returns telegramAvatar, telegramOidcUsername, id
  (Telegram ID), email {id}@telegram.oidc.
- sveltekitCookies(getRequestEvent) — cookie-адаптер.

### 7.2. Поток входа

```text
/auth (кнопка)
  → authClient.signIn.social({provider, callbackURL: from})
  → POST /api/auth/sign-in/social
  → redirect на provider
  → /api/auth/callback/{provider}
  → better-auth создаёт/линкует user+account+session
  → session cookie + redirect на callbackURL
  → hooks.server на следующем запросе: locals.user/session
  → useSession() в браузере подхватывает сессию и кэширует
```

- Провайдеры: telegram-oidc, discord; UI-метаданные — client/providers.ts.
- Ошибки OAuth: /auth?error=... → модалка; параметры чистятся из URL.
- from берётся из query и **не санитизируется** (open redirect risk, AUDIT P1-05);
  callbackURL уходит в better-auth.
- После удаления аккаунта: POST /api/user/delete → session.signOut() → /.

### 7.3. Роли и админ-доступ

```text
/admin/+layout.server.ts: нет user → redirect /auth?from=/admin
                           user → { user, isAdmin: role==='admin', isDev }
/admin overview/analytics: if role!=='admin' → { notAdmin:true, пустые данные }
/admin/{books,volumes,chapters,illustrations}: requireAdmin(locals) → throw 401/403
```

Несогласованность: overview/analytics рисуют карточку «Доступ ограничен» в layout,
а CRUD-страницы бросают ошибку и рендерят дефолтную страницу ошибки. Плюс редирект
использует redirect=, а /auth читает from= (AUDIT P1-08).

### 7.4. Аккаунты и удаление

- useAccounts().load() → authClient.listAccounts(); offline — кэш; 401/403 —
  очистка кэша сессии/аккаунтов.
- link(providerId, callbackURL) → authClient.$fetch('/link-social', {body:{provider,callbackURL}});
  ожидает {data:{url}} → window.location.href.
- unlink(providerId) → authClient.unlinkAccount({providerId, accountId}); запрет
  отвязки последнего способа (клиент + allowUnlinkingAll:false).
- deleteAccount() → POST /api/user/delete; сервер удаляет user (каскады);
  cookie не чистится на сервере, клиент делает signOut.
- /profile показывает провайдерские аватары/username; «Последний вход» — эвристика
  по совпадению user.image с аватаром провайдера.

## 8. Аналитика прослушивания

### 8.1. Клиент

listeningTracker.svelte.ts:

- tick(chapterId, bookId?, volumeId?) вызывается из AudioProvider на
  timeupdate, только если isPlaying && !audio.paused.
- Накапливает accumulatedMs (delta ≤2000 мс, чтобы не учитывать throttling);
  каждые 30с отправляет heartbeat (max 300с на пакет).
- flush() — при pause, смене трека, visibilitychange=hidden, beforeunload
  (если ≥2с).
- Offline/failed → syncQueue action LISTEN_SESSION; flushOfflineQueue шлёт
  массив {sessions:[...]} и удаляет принятые.
- Успех также trackEvent('audio_listen', ...) в Umami.

### 8.2. Сервер

POST /api/analytics/listen:

- Принимает одиночный объект или {sessions}.
- Валидирует каждую: chapterId непустой, listenedSeconds целое 1..300,
  startedAt парсится (иначе now).
- Для каждой: проверяет главу в БД (с join volume), подставляет bookId/volumeId,
  вставляет listening_sessions, делает upsert daily_listening_stats
  по buildDailyStatId(dateUTC, bookId, chapterId, userId).
- userId = locals.user?.id ?? locals.session?.userId ?? null — гости пишутся с NULL.
- **Вся пачка отклоняется (400), если хотя бы одна сессия невалидна** — плохо для
  offline-очереди (poison pill).
- Нет rate limit, нет ограничения на startedAt (можно слать будущее/прошлое),
  нет капчи/подписи; аналитику можно накрутить.
- daily_listening_stats.id — до 128 символов; формула может переполнить.

### 8.3. Админ-аналитика

/admin/analytics (+page.server.ts):

- Суммы sum(total_seconds), sum(sessions_count), count(DISTINCT user_id).
- Последние 30 дат, top-5 книг/глав, последние 10 сессий (join user/book/chapter).
- Umami-статус: PUBLIC_UMAMI_WEBSITE_ID/private UMAMI_WEBSITE_ID (последний
  не описан в .env.example) + host.
- daily_listening_stats не чистится при удалении пользователя? FK cascade — чистится.
- Часовой пояс — UTC, UI показывает локальное время для сессий.

## 9. Админка (CMS)

### 9.1. Устройство

- SSR-страницы с load (Drizzle) и actions (create/update/delete).
- requireAdmin в каждом load/action (кроме overview/analytics, где soft-check).
- Формы multipart/form-data, файлы читаются в память (request.formData()),
  затем uploadImage/uploadAudio.
- Создание/редактирование: ?edit=id; таблица с пагинацией; нативный confirm().
- Ошибки — fail(status,{error}); введённые значения не сохраняются.

### 9.2. R2 pipeline

uploadImage(buffer,{folder,filenamePrefix}):

1. sharp читает metadata (width/height).
2. Конвертирует в WebP (quality 85, effort 4).
3. Считает dominant color (sharp.stats) → 6-hex.
4. Уменьшает до 32×32, blurhash.encode(...,4,3).
5. Если R2 настроен — PutObjectCommand; иначе пишет в static/uploads/{folder}.
6. Возвращает {url,key,blurhash,themeColor,width,height} (width/height не используются).

uploadAudio — без конвертации, расширение из имени файла, content-type из браузера.

deleteFromStorage(keyOrUrl) — есть, но **не вызывается** из admin CRUD. При
удалении/замене обложки/аудио старый объект остаётся в R2 (утечка). Локальный
fallback для production не работает: adapter-node не раздаёт файлы, записанные в
static/uploads после сборки.

### 9.3. Ограничения

- Нет проверки размера/типа файла (кроме accept в input); любой файл читается
  в память.
- Нет транскодинга/нормализации аудио; длительность вводится вручную.
- Нет уникальности (bookId, volumeNumber) и (volumeId, chapterNumber).
- Нельзя очистить coverUrl/themeColor (пустая строка → null → поле не
  обновляется; старые значения остаются).
- Для illustrations нет пагинации; при отсутствии фильтра загружаются последние 100
  (без индикации), редактирование за пределами 100 через ?edit= не найдёт запись.
- Нет управления пользователями/ролями (только счётчик и dev self-promote).

## 10. UI, роутинг, темы, PWA, SEO

### 10.1. Роутинг

- SvelteKit file-based; группы не используются.
- /books — редирект; /books/:bookId — universal layout + sync; /books/:bookId/:volumeId
  — страница тома.
- /admin — вложенный layout; остальные — плоские страницы.
- Нет +error.svelte; дефолтная ошибка SvelteKit.

### 10.2. Темизация

- Tailwind v4; токены в src/routes/layout.css (oklch), @theme inline; тёмная
  тема — .dark + @custom-variant dark.
- mode-watcher (ModeWatcher) ставит класс; переключатель — ThemeSwitchButton.
- Радиусы/цвета — токены; некоторые компоненты используют hex (brand colors, support).
- View Transitions: page-content + global-audio-player; reduced-motion отключает.

### 10.3. PWA

- vite.config.ts: SvelteKitPWA({strategies:'injectManifest', srcDir:'src', filename:'service-worker.ts'}).
- Manifest: name/short_name HEDGEHOG.INC, standalone, theme white, start /,
  screenshots (wide/narrow), icons (64/192/512/maskable).
- serviceWorker.register:false в SvelteKit; ручная регистрация в layout.
- Offline fallback HTML в SW; precache ассетов.

### 10.4. SEO/OG

- OpenGraphMeta строит meta из props + page.url; og.ts — чистые функции.
- На SSR данных нет → bookQuery/volumeQuery пусты → заголовок «Книга | Тома»/
  «Аудиокнига | Hedgehog X», описание-заглушка, картинка /logo.webp.
- После гидратации meta обновляется клиентски; соцсети/поисковики этого не увидят.
- <html lang="en"> в app.html, контент русский.
- favicon — дефолтный Svelte SVG из src/lib/assets/favicon.svg.
- robots.txt разрешает всё (включая /admin, /auth), sitemap/canonical нет.

## 11. Ошибки, логирование, наблюдаемость

- createLogger(tag): в dev — debug; в prod browser — warn (override LOG_LEVEL),
  на сервере — info; в SW — console. Нет отправки в внешний сервис.
- Клиентские catch'и часто глотают ошибки (catch {}, .catch(()=>{})), особенно
  в плеере/синке — диагностика сложна.
- hooks.server.ts не оборачивает getSession в try/catch; ошибка БД → 500.
- Нет handleError хука, Sentry/OpenTelemetry, health-check эндпоинта.
- Админ-аналитика — единственная «панель наблюдаемости» (и то про прослушивания).
- Better-auth логирует предупреждения (base URL, rate limit, OIDC creds) в консоль.

## 12. Конфигурация, сборка, деплой

- **Сборка**: Vite → SvelteKit → adapter-node → build/; PWA генерирует SW.
- **Dev**: vite dev + Postgres; .env подхватывается Vite (в main checkout).
- **Docker**: compose.yaml (db, traefik, db-init, umami) + compose.dev.yml
  (ports, dbgate, certs, dynamic) + compose.test.yml (test-db + playwright).
- **Production**: multi-stage `Dockerfile` + `app`-сервис в `compose.prod.yml`;
  runtime-only deps; entrypoint применяет миграции, `/health` проверяет БД;
  Traefik-роутер на `${APP_HOST}`/`${APP_HOST_RU}`, non-root, graceful shutdown. Подробности —
  OPERATIONS §5.1.
- **Миграции**: db:migrate — рабочий способ (0000–0008); db:push — dev-shortcut,
  может удалять колонки. Перед reset/migrate — pg_dump.
- **R2**: без кредов — локальный fallback (dev only).
- **Traefik dev**: dynamic/dev.yaml ссылается на /certs/*.pem, которых нет в
  свежем клоне (mkcert нужен вручную).

## 13. Тестирование и проверка

- Unit — node:test + tsx; 173 тестов; включают policy P0-01, но не покрывают
  downloadManager/audioStore/API.
- E2E — Playwright; 8 файлов; 42 теста; включая `sync-data-safety` (9),
  `bookmark-sync` (offline → online flush) и `session-isolation` (5).
- pnpm check — 0 ошибок; pnpm build — зелёный; pnpm lint — зелёный.
- pnpm test:e2e требует BETTER_AUTH_SECRET; тесты внешних OAuth-редиректов
  ходят в реальный интернет и флапают.
- Нет CI-конфигурации (нет .github/), нет pre-commit hook'ов, нет проверки миграций.
- r2.test.ts имеет побочные эффекты (пишет в static/uploads/R2).

## 14. Решения и компромиссы (и где они расходятся с реализацией)

| Решение                         | Замысел                                | Фактическое состояние                                                         |
| ------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| Offline-first                   | страницы читают Dexie, сервер — истина | P0-01 исправлен (401/owner/guard); каталог всё ещё не гидрируется             |
| ETag/304 для книги              | экономия трафика                       | сервер готов, клиент не шлёт If-None-Match                                    |
| Универсальная syncQueue         | журнал всех мутаций                    | owner на элементе; все consumer'ы фильтруют по текущему владельцу             |
| Session isolation               | одна активная локальная сессия         | logout/expiry/switch очищают данные; guest import только с consent            |
| R2 + fallback                   | медиа в R2, локально без кредов        | fallback не работает в prod; старые объекты не удаляются                      |
| better-auth + linking           | Telegram/Discord, связывание           | safe redirect; token не кэшируется; OAuth redirects проверены                 |
| Админка SSR                     | простота, form actions                 | нет очистки полей/файлов, нет unique-констрейнтов, роли только dev            |
| Плеер с queue                   | полноценный плеер                      | queue/repeat/shuffle без UI; дублирующий Space; sleep/repeat конфликт         |
| Публичная аналитика             | гость тоже слушает                     | нет rate limit; пачка отклоняется целиком; id может переполниться             |
| «Единый словарь строк»          | i18n-заготовка                         | половина UI хардкодит русский, словарь частично не используется               |
| «Индексы на FK, enum/check»     | дисциплина схемы                       | индексов на контентные FK нет; status/theme — свободный текст                 |
| «Миграции обязаны накатываться» | воспроизводимость                      | ✅ 0000–0008 проходят на чистой БД; 0005 no-op, 0006 catch-up; generate no-op |
| «SSR/SEO»                       | OG для соцсетей                        | книги/тома SSR + OG; unknown → 404                                            |

Исторический ARCHITECTURE.md (коммит fd70f92, не в текущем дереве) описывал
Boosty-вход, rate-limit, route-titles.ts, page-object e2e и +error.svelte —
этих элементов в dev нет. Не считай его актуальным; он полезен только как история
замысла.

## 15. Рецепты изменений

### Добавить поле контента (пример: books.subtitle)

1. schema.ts — колонка + (при необходимости) relations.
2. `pnpm db:generate` → проверь SQL/snapshot → `pnpm db:migrate`. Не используй
   db:push как основной путь и не правь применённые миграции задним числом.
3. api/books/[bookId]/+server.ts — поле попадёт автоматически через select.
4. mappers.ts + OfflineBook — добавить поле.
5. admin/books/+page.server.ts — create/update; +page.svelte — input.
6. Проверить seed (если поле обязательное) и тесты.

### Добавить новый тип мутации

1. SyncItem.action + payload.
2. Клиентский сервис: Dexie + syncQueue.
3. Consumer: где и когда flush, retry, удаление.
4. Сервер: POST /api/user/sync (валидация, идемпотентность) или новый endpoint.
5. Защита от потери: `hydrate('all')` только после проверки 401/owner/queue;
   пустой массив без `allowEmptyPurge` ничего не удаляет.
6. Тест (unit для логики, e2e для UI).

### Добавить страницу

1. src/routes/<path>/+page.svelte (+ +page.ts при params).
2. Если данные серверные — +page.server.ts + locals.user/admin.
3. Если Dexie — useDexie + пустое/loading состояние.
4. Мета: <svelte:head><title> или OpenGraphMeta.
5. Проверить SSR (страница не должна падать без window).

## 16. Что читать дальше

- Точные файлы/таблицы/маршруты — [PROJECT_MAP.md](PROJECT_MAP.md).
- Дефекты и приоритеты — [AUDIT.md](AUDIT.md).
- Запуск/деплой — [OPERATIONS.md](OPERATIONS.md).
- Термины — [DOMAIN.md](DOMAIN.md).
