# Resto Control v2

Fullstack PWA для Railway: сервер Node.js отдаёт готовый frontend из `dist/` и API.

## Что важно

- Для Railway в архиве уже есть собранный frontend в `dist/`.
- Сервер запускается командой `npm run start`.
- Для дальнейшей локальной разработки восстановлены dev-скрипты: `npm run dev`, `npm run build`, `npm run preview`.
- Railway по-прежнему не пересобирает frontend на деплое: он проверяет сервер и наличие `dist/index.html`.

## Деплой на Railway

В репозиторий нужно пушить содержимое этой папки целиком, включая `dist/`.

Переменные Railway:

```env
DATABASE_URL=...
NODE_ENV=production
SERVICE_OWNER_EMAIL=admin@resto-control.ru
SERVICE_OWNER_PASSWORD=...
SERVICE_OWNER_NAME=Владелец сервиса
```

## Проверка локально без пересборки frontend

```bash
npm install --omit=dev
npm run check
npm run start
```

Сайт откроется на порту из `PORT` или на `4173`.

## Локальная разработка frontend

```bash
npm install
npm run dev
```

После правок frontend перед передачей/деплоем нужно обновить `dist`:

```bash
npm run build
```
