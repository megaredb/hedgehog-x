# Lighthouse: все публичные страницы

Проверка: Lighthouse **13.6.0**, мобильный профиль по умолчанию, запуск по
`http://127.0.0.1:4174` (production-образ через `server.js`).

## Итог

- **Accessibility: 100** на всех проверенных страницах.
- **Best Practices: 100** на всех.
- **SEO: 100** на всех.
- **Agentic Browsing: 100** на всех.
- **Performance: 100** на статических страницах; на страницах с данными и
  медиа — **78–88** из-за задержки R2-прокси и стоимости клиентской
  гидратации в мобильном throttling.

## Матрица

| Страница                         | Perf | A11y |  BP | SEO | Agentic |
| -------------------------------- | ---: | ---: | --: | --: | ------: |
| `/`                              |   79 |  100 | 100 | 100 |     100 |
| `/books`                         |   80 |  100 | 100 | 100 |     100 |
| `/books/overlord`                |   78 |  100 | 100 | 100 |     100 |
| `/books/overlord/overlord_vol_1` |   81 |  100 | 100 | 100 |     100 |
| `/about`                         |  100 |  100 | 100 | 100 |     100 |
| `/auth`                          |  100 |  100 | 100 | 100 |     100 |
| `/community`                     |  100 |  100 | 100 | 100 |     100 |
| `/support`                       |  100 |  100 | 100 | 100 |     100 |
| `/bookmarks`                     |   88 |  100 | 100 | 100 |     100 |
| `/history`                       |   88 |  100 | 100 | 100 |     100 |
| `/downloads`                     |  100 |  100 | 100 | 100 |     100 |
| `/profile`                       |   86 |  100 | 100 | 100 |     100 |
| `/settings`                      |   99 |  100 | 100 | 100 |     100 |

## Почему performance не 100 на data-страницах

1. Обложки могут отдаваться через `/api/media` → R2 (или напрямую с CDN-зеркала; режим задаётся в админке); мобильный Lighthouse throttling
   делает LCP-ресурс ощутимо медленнее, чем локальную статику.
2. Страницы с Dexie/плеером требуют клиентской гидратации; TTI/interactive
   проседает на мобильном CPU.
3. На главной — видео-фон и showcase-анимации; видео теперь opt-in, но JS
   остаётся тяжёлым.
4. На volume-странице Telegram-виджет теперь загружается только по кнопке,
   поэтому third-party cookies из initial load убраны.

## Что уже сделано для производительности

- `server.js`: gzip compression + immutable cache headers.
- LCP-обложки: `fetchpriority=high`, eager, preload.
- R2 media proxy: диск-кэш изображений в `MEDIA_CACHE_DIR` (по умолчанию
  `/tmp/hedgehog-media`). В админке «Сайт → Настройки → Сеть и зеркала»
  можно выключить проксирование и отдавать файлы напрямую с CDN-зеркала.
- Главная: видео-фон выключен по умолчанию.
- Долгие списки: показ томов порциями по 12.
- Telegram-комментарии: lazy-load по действию.
- Убраны лишние transition/scale с LCP-изображений.

## Как повторить

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
pnpm dlx lighthouse@13.6.0 http://127.0.0.1:4174/books \
  --only-categories=performance,accessibility,best-practices,seo,agentic-browsing \
  --output=json --output-path=/tmp/lighthouse-books.json \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" --quiet
```
