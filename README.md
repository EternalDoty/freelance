# B2C Freelance Platform

Закрытая платформа фриланса с GitHub OAuth, escrow, AI Support, системой рейтингов, блокировок и апелляций.

## Технологический стек

- **Backend**: Node.js + Express
- **Frontend**: React + TypeScript
- **База данных**: PostgreSQL
- **Кэш**: Redis
- **Стили**: Tailwind CSS
- **Аутентификация**: GitHub OAuth
- **Платежи**: Электронные кошельки для escrow

## Структура проекта

```
project/
├── backend/                 # Backend API (Node.js + Express)
├── frontend/               # Frontend SPA (React + TypeScript)
├── database/               # SQL схемы и миграции
├── docs/                   # Документация
├── docker/                 # Docker конфигурации
├── tests/                  # Тесты
└── deployment/             # CI/CD и деплой конфигурации
```

## Текущие функции платформы

- **Аутентификация и доступ**: JWT + GitHub OAuth (`/api/auth`)
- **Профили пользователей**: данные аккаунта и управление профилем (`/api/users`)
- **Задачи и отклики**: публикация задач и отправка предложений (`/api/tasks`, `/api/proposals`)
- **Escrow-сделки**: резервирование, удержание и вывод средств (`/api/escrow`)
- **Рейтинги**: оценка и репутация участников (`/api/ratings`)
- **Апелляции**: подача и разбор спорных кейсов (`/api/appeals`)
- **AI Support**: тикеты с AI-триажем и эскалацией оператору (`/api/support`)
- **Уведомления**: служебные события и персональные оповещения (`/api/notifications`)
- **Админ-модуль**: модерация и операционный контроль (`/api/admin`)
- **Каталог возможностей API**: новый системный endpoint для просмотра доступных модулей (`/api/features`)

## Ubuntu: локальный запуск + Cloudflared Tunnel

1. Установите зависимости на Ubuntu (один раз):
   ```bash
   sudo apt update
   sudo apt install -y docker.io docker-compose-plugin curl
   # Node.js 18+ и npm должны быть установлены
   # cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   ```

2. Запуск backend + frontend + туннелей:
   ```bash
   ./deployment/scripts/start-ubuntu-cloudflared.sh
   ```

   Скрипт автоматически:
   - поднимет PostgreSQL и Redis,
   - запустит backend и frontend,
   - создаст публичные Cloudflared URL для сайта и API,
   - подставит backend tunnel URL в `frontend/.env.local`.

3. Остановка:
   ```bash
   ./deployment/scripts/stop-ubuntu-cloudflared.sh
   ```

## Локальный тестовый запуск на Windows

### 1) Поднять весь проект одной командой (PowerShell)
```powershell
./start-project.ps1
```

Скрипт поднимает полный стек через Docker Compose и при необходимости создает `deployment/.env`.

### 2) Легковесный dev-режим (backend + frontend + PostgreSQL + Redis)
Подготовка:
```powershell
./deployment/scripts/local-test-run.ps1 -PrepareOnly
```

Запуск:
```powershell
./deployment/scripts/local-test-run.ps1
```

Остановка:
```powershell
./deployment/scripts/local-test-stop.ps1
```

Если PowerShell блокирует запуск скриптов, выполните:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Запуск всего проекта одной командой

```bash
./start-project.sh
```

Скрипт поднимет **весь стек** (PostgreSQL, Redis, backend, frontend, nginx, monitoring) через `deployment/docker-compose.yml`.

Если файла `deployment/.env` нет, он будет создан автоматически с локальными значениями по умолчанию.

Остановка всего проекта:
```bash
docker compose --env-file deployment/.env -f deployment/docker-compose.yml down
```

## Локальный тестовый запуск

1. Подготовка окружения (поднимет PostgreSQL и Redis, создаст недостающие `.env` файлы):
   ```bash
   ./deployment/scripts/local-test-run.sh --prepare-only
   ```
2. Полный запуск backend + frontend:
   ```bash
   ./deployment/scripts/local-test-run.sh
   ```
3. Остановка локального стенда:
   ```bash
   ./deployment/scripts/local-test-stop.sh
   ```

После запуска доступны:
- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000`
- Swagger: `http://localhost:3000/api-docs`

## Этапы разработки

1. ✅ Аналитика и постановка задачи
2. ⏳ UI/UX-дизайн
3. ⏳ Backend разработка
4. ⏳ Frontend разработка
5. ⏳ AI Support и рейтинги
6. ⏳ Тестирование и безопасность
7. ⏳ Альфа-запуск и деплой

## Комиссии

- 1% для сумм < 10,000₽
- 0.8% для сумм > 10,000₽
- 0.5% для сумм > 50,000₽

Возможность редактирования комиссии в реальном времени.
