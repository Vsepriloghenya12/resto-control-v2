# Resto Control v2 — запись 021

## Fullstack backend

Проект переведён из чистой frontend/PWA-версии в fullstack-версию для Railway.

### Архитектура
- один Railway-сервис;
- Node.js backend отдаёт `dist` и API;
- frontend собирается через Vite;
- API живёт под `/api/*`;
- авторизация через httpOnly cookie `rc_session`;
- при наличии `DATABASE_URL` используется PostgreSQL;
- без `DATABASE_URL` используется локальный JSON-файл `server/data/db.json` для разработки.

### Реализованные базовые API
- `POST /api/auth/register-restaurant`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/health`
- `GET /api/dashboard/summary`
- `GET /api/service-owner/overview`
- CRUD API для сотрудников, задач, чек-листов, залов, столов, броней, оплат, тех. заявок, базы знаний, гостей, ТТК, инвентаризации.

### Мобильные API
- `GET /api/mobile/overview`
- `GET /api/mobile/hall-plan`

### Push-заготовка
- `POST /api/push-subscriptions` сохраняет подписку сотрудника.
- Для отправки настоящих push-уведомлений следующим шагом нужны VAPID-ключи и отправитель уведомлений.

### Seed-логины
- владелец сервиса: `admin@resto.local` / `admin123`
- владелец ресторана: `owner@resto.local` / `owner123`
- сотрудник: `employee@resto.local` / `employee123`

### Важные правила
- должность «Кладовщик» запрещена;
- используется должность «Клининг»;
- чек-листы не хранятся как документы компании;
- фотоотчёты не отдельный раздел, а часть задачи или пункта чек-листа.
