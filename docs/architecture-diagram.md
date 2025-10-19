# Архитектурная схема B2C Freelance Platform

## Общая архитектура системы

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Database      │
│   (React SPA)   │◄──►│   (Node.js)      │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub OAuth  │    │   Redis Cache   │    │   File Storage  │
│   (Auth)        │    │   (Sessions)    │    │   (Images/Docs) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   AI Support    │
                       │   (OpenAI API)  │
                       └─────────────────┘
```

## Компоненты системы

### 1. Frontend Layer (React SPA)
- **Task Feed** - лента задач с фильтрацией
- **Task Card** - карточка задачи с деталями
- **Profile Management** - управление профилем
- **Escrow Dashboard** - панель escrow транзакций
- **AI Support Chat** - чат с AI поддержкой
- **Appeal System** - система апелляций

### 2. Backend API Layer (Node.js + Express)
- **Auth Service** - аутентификация через GitHub OAuth
- **Task Service** - управление задачами и предложениями
- **Escrow Service** - управление escrow транзакциями
- **Rating Service** - система рейтингов и отзывов
- **AI Support Service** - интеграция с AI
- **Moderation Service** - модерация и блокировки
- **Notification Service** - уведомления

### 3. Database Layer (PostgreSQL)
- **Users** - пользователи и профили
- **Tasks** - задачи и предложения
- **Escrow Transactions** - escrow операции
- **Ratings** - рейтинги и отзывы
- **Appeals** - апелляции и споры
- **AI Support Tickets** - тикеты поддержки

### 4. External Services
- **GitHub OAuth** - аутентификация
- **Payment Gateways** - электронные кошельки
- **AI API** - OpenAI для поддержки
- **Email Service** - уведомления
- **File Storage** - хранение файлов

## Поток данных

### 1. Регистрация пользователя
```
GitHub OAuth → Backend → Database → JWT Token → Frontend
```

### 2. Создание задачи
```
Frontend → Backend API → Database → Cache → Notification
```

### 3. Escrow процесс
```
Task Creation → Escrow Init → Payment → Work → Release/Refund
```

### 4. AI Support
```
User Question → AI Service → Response/Operator Escalation
```

## Безопасность

### 1. Аутентификация
- JWT токены с коротким временем жизни
- GitHub OAuth для верификации
- Rate limiting для API

### 2. Защита данных
- HTTPS для всех соединений
- Валидация входных данных
- Защита от SQL injection
- CSRF защита

### 3. Мониторинг
- Sentry для ошибок
- Prometheus для метрик
- Логирование операций
- Алерты при инцидентах

## Масштабирование

### 1. Горизонтальное масштабирование
- Load balancer для API
- Multiple API instances
- Database replication
- Redis cluster

### 2. Кэширование
- Redis для сессий
- CDN для статики
- Database query cache
- API response cache

### 3. Мониторинг производительности
- Response time tracking
- Database query optimization
- Memory usage monitoring
- Error rate tracking
