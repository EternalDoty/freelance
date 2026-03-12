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
