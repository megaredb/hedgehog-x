# DOMAIN.md — предметная область, глоссарий и инварианты

Документ фиксирует **смысл** сущностей и правила. Технические детали —
[ARCHITECTURE.md](ARCHITECTURE.md) и [PROJECT_MAP.md](PROJECT_MAP.md).

## 1. Глоссарий

### Контент

| Термин                             | Смысл                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Book / книга**                   | Серия; верхний уровень каталога.                                                                                   |
| **Volume / том**                   | Часть книги; содержит главы и иллюстрации.                                                                         |
| **Chapter / глава**                | Единица аудио: URL, длительность, Telegram-пост, флаг `published`. Неопубликованная глава не видна публично.       |
| **Illustration / иллюстрация**     | Картинка тома; может быть привязана к главам с таймингом.                                                          |
| **Chapter illustration timing**    | `chapter_illustrations`: глава + иллюстрация + `show_at_seconds`; иллюстрация показывается во время прослушивания. |
| **Audio version / версия озвучки** | Альтернативная озвучка главы; `versionId`, URL, длительность, диапазон глав.                                       |
| **Broadcast / трансляция**         | Эфир на основе главы: расписание, live, запись/replay, чат, иллюстрации, просмотры.                                |
| **Track / трек**                   | Элемент очереди плеера; для трансляции содержит `broadcastId/broadcastLive`.                                       |
| **Catalog / каталог**              | `/books`: SSR-список книг с клиентским фильтром.                                                                   |
| **Showcase / витрина**             | Главная: карусель книг с изображением/видео.                                                                       |

### Пользователь, подписка, активность

| Термин                         | Смысл                                                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Guest / гость**              | Без входа; слушает/скачивает/имеет локальные закладки; лайки и трансляции требуют входа.                                                                        |
| **User / пользователь**        | Запись `user`; `role = user/admin/author`.                                                                                                                      |
| **Author / автор**             | Привилегированная роль: доступ к контенту/админке, но не к управлению ролями; исключается из статистики; при назначении предыдущий автор сбрасывается в `user`. |
| **Session / сессия**           | better-auth cookie + локальный кэш без токена.                                                                                                                  |
| **Subscription / подписка**    | Доступ к закрытому сообществу и трансляциям; ручная, lifetime, Boosty-источник.                                                                                 |
| **Subscription source**        | Telegram-группа или Discord-роль, подтверждающая Boosty-подписку.                                                                                               |
| **Manual grant**               | Ручная выдача дней/суммы админом.                                                                                                                               |
| **Lifetime**                   | Бессрочная подписка.                                                                                                                                            |
| **Block / Revoke**             | Блокировка (удаляет сессии) / отзыв с заморозкой остатка.                                                                                                       |
| **Price notice**               | Уведомление о смене цены дня; можно закрыть.                                                                                                                    |
| **Donation ledger**            | Неизменяемый журнал ручных донатов; `idempotency_key`.                                                                                                          |
| **Listening progress**         | Позиция главы/версии; GREATEST, sticky completed.                                                                                                               |
| **Listening session**          | Heartbeat: секунды и время начала.                                                                                                                              |
| **Daily stats**                | Агрегат по UTC-дате, книге, главе, версии, пользователю.                                                                                                        |
| **Like**                       | Лайк тома/главы с версией; счётчик — сумма.                                                                                                                     |
| **Bookmark**                   | Точка/диапазон в главе + заметка.                                                                                                                               |
| **Broadcast listener/view**    | Присутствие в live (`broadcast_listeners`) и просмотр (`broadcast_views`).                                                                                      |
| **Broadcast progress**         | Live/replay позиция пользователя в трансляции.                                                                                                                  |
| **Broadcast message/reaction** | Чат эфира и эмодзи-реакции.                                                                                                                                     |
| **Sync queue / owner**         | Локальные мутации и их владелец.                                                                                                                                |

### Сайт, плеер, инфраструктура

| Термин                                   | Смысл                                                            |
| ---------------------------------------- | ---------------------------------------------------------------- |
| **Site page**                            | Редактируемая страница about/support/community (`site_pages`).   |
| **Translator**                           | Переводчик с соцсетями; связь с user.                            |
| **Site settings**                        | `media` (proxy/direct) и `mirrors` (CDN-хосты).                  |
| **Mirror**                               | CDN-хост с ролью default/ru/none; auto выбирает RU на RU-домене. |
| **Media proxy**                          | `/api/media`: Range, кэш, allowlist; может 302 на direct.        |
| **OPFS**                                 | Хранилище скачанного аудио; безопасные имена версий.             |
| **Sleep timer / Undo seek / Clip range** | Таймер сна, отмена seek, диапазон закладки.                      |
| **R2**                                   | Cloudflare R2 для медиа.                                         |
| **Traefik / better-auth / Drizzle**      | Reverse proxy / auth / ORM.                                      |

## 2. Иерархия и идентификаторы

```text
Book 1─N Volume 1─N Chapter 1─N ChapterAudioVersion
                         └─N ChapterIllustration (timing)
Chapter 1─N Broadcast 1─N BroadcastMessage 1─N BroadcastReaction
User 1─1 Subscription, 1─N SubscriptionSource/Event/PriceNotice
User 1─N BroadcastProgress/Listener/View
```

| Сущность                        | ID/формат                                                      |
| ------------------------------- | -------------------------------------------------------------- |
| book                            | до 128; seed slug; админка slug/8 random                       |
| volume                          | `{bookId}_vol_{n}_{slug или 6random}`; seed `{bookId}_vol_{n}` |
| chapter                         | `{volumeId}_ch_{n}_{6random}`; seed `{volumeId}_c{n}`          |
| illustration                    | `ill_{volumeId}_{8random}`; seed `{volumeId}_ill_{n}`          |
| chapter_audio_version           | `{chapterId}:{versionId}`                                      |
| chapter_illustration            | UUID 36                                                        |
| broadcast                       | UUID 36                                                        |
| broadcast message/reaction/view | UUID 36; реакция PK(message,user,emoji)                        |
| bookmark                        | UUID 36                                                        |
| listening session               | UUID 36                                                        |
| daily stat                      | date + 4 FNV-хеша (42 символа)                                 |
| subscription                    | PK user_id                                                     |
| subscription source             | PK(user_id, provider)                                          |
| donation                        | UUID + unique idempotency_key                                  |
| site page                       | PK key `about/support/community`                               |
| translator                      | UUID 36                                                        |
| user                            | Telegram numeric string / Discord ID                           |
| local progress/like key         | `chapterId` для default, `chapterId::versionId` иначе          |
| local broadcast progress        | `broadcast-progress:<broadcastId>`                             |

Порядок — `volume_number`, `chapter_number`, `sort_order`, а не ID.
Уникальность: `UNIQUE(book_id, volume_number)`,
`UNIQUE(volume_id, chapter_number)`,
`UNIQUE(chapter_id, illustration_id)`.

## 3. Контент

1. **Иерархия.** Удаление книги каскадно удаляет тома, главы, иллюстрации,
   прогресс/лайки/закладки, сессии, статистику, главы иллюстраций и трансляции.
2. **Публикация.** `chapters.published` default false; публичные API/SSR
   отдают только true. Seed и старт эфира выставляют true. Неопубликованная
   глава скрыта, но существует.
3. **Обязательные поля.** `chapters.audio_url` и `duration_seconds` (double,
   ≥0). Длительность может быть 0.
4. **Статус.** `books/volumes.status` — ongoing/completed/hiatus/dropped
   (CHECK). Бейдж тома: «Завершен» для completed, иначе «Выходит».
5. **Цвет.** `theme_color` — 6 hex или NULL (CHECK).
6. **Иллюстрации.** `sort_order` целый; у `(volume_id, sort_order)` уникальности
   нет. Для главы — уникальная пара (chapter, illustration) и `show_at_seconds`.
   Иллюстрация с таймингом скрыта, пока не прослушана связанная глава; без
   тайминга считается томной и не блокируется.
7. **Telegram.** `telegram_post_url` — полная ссылка или `channel/123`;
   парсер приводит к `channel/123`.
8. **Версии.** `default` — базовая озвучка (не строка таблицы); `old` — preset.
   `audioPromote` запрещает делать основной объединённую версию.
9. **Витрина.** `home_image_url`, `video_url`, `sort_order` — отдельно от
   обложки; порядок главной/каталога.
10. **Seed.** 2 книги/4 тома/10 глав (`published:true`)/4 иллюстрации; все
    главы на `/audio/sample.mp3` 1123 с.

## 4. Трансляции

- **Состояния:** scheduled (нет startedAt), live (startedAt + duration),
  ended (endedAt без publish), published (endedAt + publishedAt).
- **Запуск:** `startBroadcast` ставит startedAt и публикует главу.
- **Конец:** `endBroadcast` ставит endedAt; если `saveRecording &&
publishAfterEnd` — publishedAt; иначе запись недоступна; без
  `saveRecording` чат удаляется.
- **Доступ:** список публичный (live/published); деталь/аудио/чат — вход +
  активная подписка или admin/author. Гость видит CTA.
- **Live:** та же глава; позиция = `now - startedAt`, синхронизация по
  `serverNow`; replay — с серверного прогресса; live всегда с края.
- **Чат:** только live/replay с `chat_enabled`; 500 символов, 5 сообщений/10 с,
  ссылки только Telegram/Boosty/Discord/сайт; reply, теги иллюстраций, 4
  реакции (👍/❤️/🔥/😂), нельзя реагировать на своё; страница 30.
- **Иллюстрации:** по `show_at_seconds` из `chapter_illustrations`;
  `broadcast_illustrations` — legacy, не читается.
- **Presence:** heartbeat 10 с, активное окно 30 с; views уникальны по
  broadcast/user/kind; удаление — status 404 → плеер очищается.
- **Прогресс:** `broadcast_progress` PK(user,broadcast), GREATEST + OR completed;
  локально — отдельный ключ, не смешивается с главой.

## 5. Пользовательские данные и подписка

1. **Прогресс.** PK(user, chapter, version); сервер принимает 0..86 400;
   GREATEST; completed sticky.
2. **Лайки.** PK(user, volume) / (user, chapter, version); like — DO NOTHING;
   unlike — delete.
3. **Закладки.** UUID; timestamp 0..86 400; end > start; note ≤500; владелец.
4. **Гость.** Сервер 401; данные только в Dexie; аналитика с NULL.
5. **Guest→account.** Новый аккаунт — авто; существующий — consent; отказ
   удаляет локальные данные/очередь; смена аккаунта очищает.
6. **Сессия прослушивания.** 1..300 с; startedAt −30 дней/+5 минут; проверка
   главы; book/volume подставляются.
7. **Дневная статистика.** UTC-дата; sessions_count +1; totalSeconds сумма;
   идемпотентный ID; user FK SET NULL (статистика сохраняется).
8. **Роль.** user/admin/author; author — `include_in_stats=false`.
9. **Подписка.**
   `active = !blocked && !revoked && (lifetime || manual_expires_at > now ||
telegram.active || discord.active)`.
   - Источники: Telegram-группа / Discord-роль; ошибка проверки не сбрасывает
     active.
   - Ручная: 7 ₽/день по умолчанию; floor(amount/price); продление от
     max(now, expiry); лимиты 36 500 дней/1 000 000 ₽.
   - Revoke/restore замораживает/возвращает остаток; block удаляет сессии.
   - Цена: `subscription_settings` после первого изменения; scope all
     пересчитывает остаток; lifetime не меняется; notices.
   - Донат: `donation_ledger` неизменяем, idempotency unique, user SET NULL.
10. **Удаление аккаунта.** Удаляет user/сессии, обнуляет ссылки админа,
    обезличивает аналитику/донаты; активная Boosty-подписка может восстановиться
    после повторного входа.

## 6. Состояния

### Загрузка

```text
queued → downloading → downloaded
   └────────┴──────────→ error
```

Одна загрузка; partial удаляется; OPFS-имя кодируется; отмена/удаление чистят
OPFS/cache.

### Плеер

`idle → loading → playing ⇄ paused → ended`; error с retry до 3. Sleep
проверяется до repeat; ended → completed → sleep → repeat one → auto/next/pause.
Для broadcast: live/replay, отдельный прогресс.

### Синхронизация

`local mutation → Dexie → syncQueue → POST /api/user/sync`; owner-фильтр;
replace только same owner без pending. Broadcast progress — отдельный сервис.

### Подписка

`none → manual/boosty/both/lifetime → revoked/blocked → restore/unblock`.
Blocked удаляет сессии; revoked сохраняет остаток.

## 7. Бизнес-правила

1. Лайки — только авторизованным; гость видит модалку.
2. Прослушивание/скачивание/закладки — гостю локально.
3. История очищается на сервере (`/api/user/progress/clear`) и локально.
4. Completion modal — когда последняя глава тома завершилась в сессии; не
   повторяется для тома.
5. Комментарии глав — Telegram-виджет; чат трансляций — своя таблица.
6. Админка — admin/author; `setRole`/`setAuthor` только admin; контент,
   сайт, подписки, блокировки и цена — admin/author (`requireAdmin`).
7. Аудио публично, без подписанных URL/DRM.
8. Подписка не блокирует книги; только трансляции/чат/закрытое сообщество.
9. Umami опционален.
10. Каталог — sort_order/title; поиск клиентский.
11. Главная — sort_order/title; видео opt-in.
12. Том — главы по chapter_number (только published), иллюстрации по sort_order.
13. Версия — отдельные прогресс/лайки/закладки.
14. Сайт — about/support/community из БД; дефолты; sanitize URL; соцсети/
    разработчики/переводчики/реквизиты.
15. Медиа — proxy или direct; зеркала конфигурируемы; auto RU на RU-домене.
16. Feedback — 302 на сохранённый URL (http/https/tg).

## 8. Чего в проекте нет

- Нет встроенной оплаты/эквайринга: Boosty снаружи, приложение проверяет
  Telegram/Discord-результат.
- Нет плейлистов, рейтингов, просмотров глав.
- Нет таблицы комментариев глав (Telegram-виджет); чат есть только у трансляций.
- Нет отдельного API закладок/прогресса: всё через `POST /api/user/sync`
  (кроме clear).
- Нет транскодинга аудио.
- Нет полноценной i18n: строки русские, словарь частичный.
- Нет серверного поиска/пагинации каталога.
- Нет UI repeat/shuffle/queue и мобильной громкости.
- Нет push/background sync.
- Нет загрузки обложек в OPFS (только аудио).

## 9. Пограничные случаи

- `broadcast_illustrations` — legacy; данные перенесены в
  `chapter_illustrations` миграцией 0033.
- `chapters.published=false` скрывает главу из API/SSR, но она доступна
  админке и broadcast-админке.
- `broadcastKind` вычисляется лениво; `startedAt + duration` определяет live.
- Replay доступен только при `saveRecording && publishedAt`; иначе 404.
- `buildDailyStatId` 42 символа; nullable в UNIQUE не конфликтуют.
- Вставка закладки с чужим id → PK-конфликт sync → 500.
- `versionId` серверной версии `chapterId:versionId`; локальный ключ
  `chapterId::versionId`; broadcast — `broadcast-progress:<id>`.
- OPFS-имя версии кодируется; default сохраняет обратную совместимость.
