# Resto Control v2

Fullstack PWA для Railway: сервер Node.js отдаёт готовый frontend из `dist/` и API.

## Деплой на Railway

В репозиторий нужно пушить содержимое этой папки целиком, включая `dist/` и runtime `node_modules/`. В этой сборке Railway не запускает `npm install` и не собирает frontend, чтобы не зависеть от нестабильной установки npm на Railway.

Переменные Railway:

```env
DATABASE_URL=...
NODE_ENV=production
SERVICE_OWNER_EMAIL=admin@resto-control.ru
SERVICE_OWNER_PASSWORD=...
SERVICE_OWNER_NAME=Владелец сервиса
```

## Проверка локально

```bash
npm run check
npm run start
```

Сайт откроется на порту из `PORT` или на `4173`.
