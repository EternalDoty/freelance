# UI/UX Design Specification - B2C Freelance Platform

## Дизайн-система

### Цветовая палитра

**Основные цвета:**
- **Primary**: #3B82F6 (Blue-500) - основной цвет бренда
- **Secondary**: #10B981 (Emerald-500) - успех, завершенные задачи
- **Accent**: #F59E0B (Amber-500) - предупреждения, ожидание
- **Danger**: #EF4444 (Red-500) - ошибки, блокировки
- **Neutral**: #6B7280 (Gray-500) - нейтральный текст

**Фоновые цвета:**
- **Background**: #FFFFFF (White) - основной фон
- **Surface**: #F9FAFB (Gray-50) - карточки, панели
- **Border**: #E5E7EB (Gray-200) - границы
- **Hover**: #F3F4F6 (Gray-100) - состояние наведения

**Темная тема:**
- **Background**: #111827 (Gray-900)
- **Surface**: #1F2937 (Gray-800)
- **Border**: #374151 (Gray-700)
- **Text**: #F9FAFB (Gray-50)

### Типографика

**Шрифты:**
- **Primary**: Inter (основной шрифт)
- **Monospace**: JetBrains Mono (код, технические данные)

**Размеры:**
- **H1**: 32px / 2rem (заголовки страниц)
- **H2**: 24px / 1.5rem (заголовки секций)
- **H3**: 20px / 1.25rem (заголовки карточек)
- **Body**: 16px / 1rem (основной текст)
- **Small**: 14px / 0.875rem (вторичный текст)
- **Caption**: 12px / 0.75rem (подписи, метки)

**Веса:**
- **Light**: 300
- **Regular**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700

### Компоненты

#### Кнопки

**Primary Button:**
```css
background: #3B82F6;
color: #FFFFFF;
padding: 12px 24px;
border-radius: 8px;
font-weight: 500;
```

**Secondary Button:**
```css
background: transparent;
color: #3B82F6;
border: 1px solid #3B82F6;
padding: 12px 24px;
border-radius: 8px;
```

**Danger Button:**
```css
background: #EF4444;
color: #FFFFFF;
padding: 12px 24px;
border-radius: 8px;
```

#### Карточки

**Task Card:**
```css
background: #FFFFFF;
border: 1px solid #E5E7EB;
border-radius: 12px;
padding: 24px;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
```

**Profile Card:**
```css
background: #FFFFFF;
border: 1px solid #E5E7EB;
border-radius: 16px;
padding: 32px;
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
```

#### Формы

**Input Field:**
```css
border: 1px solid #D1D5DB;
border-radius: 8px;
padding: 12px 16px;
font-size: 16px;
transition: border-color 0.2s;
```

**Input Focus:**
```css
border-color: #3B82F6;
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
```

## Макеты страниц

### 1. Главная страница (Лента задач)

**Header:**
- Логотип платформы (слева)
- Поиск задач (центр)
- Уведомления, профиль, AI Support (справа)

**Фильтры:**
- Категории (Web Development, Design, Marketing, etc.)
- Бюджет (слайдер)
- Сроки (радио-кнопки)
- Сортировка (по дате, бюджету, рейтингу)

**Лента задач:**
- Карточки задач в сетке 1-3 колонки
- Каждая карточка содержит:
  - Заголовок задачи
  - Описание (обрезанное)
  - Бюджет
  - Срок выполнения
  - Рейтинг заказчика
  - Количество предложений
  - Теги навыков

**Pagination:**
- Номера страниц
- Кнопки "Предыдущая"/"Следующая"
- Показ общего количества

### 2. Страница задачи

**Заголовок:**
- Название задачи
- Бюджет (крупно)
- Срок выполнения
- Статус (открыта/в работе/завершена)

**Описание:**
- Полное описание задачи
- Требования
- Навыки
- Файлы (если есть)

**Информация о заказчике:**
- Аватар
- Имя пользователя
- Рейтинг
- Количество завершенных задач
- Верификация

**Предложения:**
- Список предложений от исполнителей
- Каждое предложение содержит:
  - Аватар исполнителя
  - Имя и рейтинг
  - Предложенную цену
  - Срок выполнения
  - Сообщение
  - Кнопка "Принять"

**Действия:**
- Кнопка "Подать предложение" (для исполнителей)
- Кнопка "Редактировать" (для заказчика)
- Кнопка "Закрыть задачу" (для заказчика)

### 3. Профиль пользователя

**Header профиля:**
- Аватар (большой)
- Имя пользователя
- Рейтинг (звезды)
- Верификация (галочка)
- Кнопка "Редактировать профиль"

**Статистика:**
- Общий рейтинг
- Количество завершенных задач
- Общий заработок
- Время на платформе

**Портфолио:**
- Галерея работ
- Описание проектов
- Отзывы клиентов

**Навыки:**
- Теги навыков
- Уровень экспертизы
- Сертификаты

**История:**
- Завершенные задачи
- Отзывы
- Рейтинги

### 4. Панель escrow

**Активные транзакции:**
- Список текущих escrow
- Статус каждой транзакции
- Сумма и комиссия
- Прогресс выполнения

**История:**
- Завершенные транзакции
- Фильтры по статусу
- Экспорт данных

**Действия:**
- Кнопка "Выплатить" (для заказчика)
- Кнопка "Запросить выплату" (для исполнителя)
- Кнопка "Создать спор" (для обеих сторон)

### 5. AI Support

**Чат-интерфейс:**
- Окно чата с AI
- Поле ввода сообщения
- Кнопка отправки
- Индикатор печати AI

**Контекст:**
- Информация о текущей задаче
- История сообщений
- Быстрые ответы

**Эскалация:**
- Кнопка "Связаться с оператором"
- Форма для детального описания проблемы
- Прикрепление файлов

### 6. Система апелляций

**Форма апелляции:**
- Тип апелляции (рейтинг/транзакция/блокировка)
- Причина апелляции
- Доказательства (файлы, скриншоты)
- Дополнительные комментарии

**Статус апелляции:**
- Текущий статус
- Комментарии модератора
- Дата рассмотрения
- Решение

### 7. Панель модератора

**Дашборд:**
- Статистика платформы
- Активные споры
- Новые апелляции
- Заблокированные пользователи

**Модерация:**
- Список задач на модерацию
- Детали споров
- Инструменты для принятия решений
- История действий

## Интерактивные состояния

### Состояния кнопок

**Default:**
```css
background: #3B82F6;
color: #FFFFFF;
```

**Hover:**
```css
background: #2563EB;
transform: translateY(-1px);
box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
```

**Active:**
```css
background: #1D4ED8;
transform: translateY(0);
```

**Disabled:**
```css
background: #9CA3AF;
color: #6B7280;
cursor: not-allowed;
```

### Состояния карточек

**Default:**
```css
background: #FFFFFF;
border: 1px solid #E5E7EB;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
```

**Hover:**
```css
border-color: #3B82F6;
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
transform: translateY(-2px);
```

**Selected:**
```css
border-color: #3B82F6;
background: #EFF6FF;
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
```

### Состояния форм

**Input Default:**
```css
border: 1px solid #D1D5DB;
background: #FFFFFF;
```

**Input Focus:**
```css
border-color: #3B82F6;
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
```

**Input Error:**
```css
border-color: #EF4444;
box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
```

**Input Success:**
```css
border-color: #10B981;
box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
```

## Адаптивность

### Мобильные устройства (320px - 768px)

**Навигация:**
- Гамбургер-меню
- Скрытые фильтры
- Упрощенный поиск

**Карточки:**
- Одна колонка
- Уменьшенные отступы
- Крупные кнопки

**Формы:**
- Полная ширина полей
- Увеличенные области касания
- Упрощенная валидация

### Планшеты (768px - 1024px)

**Сетка:**
- Две колонки для карточек
- Боковая панель для фильтров
- Адаптивные изображения

### Десктоп (1024px+)

**Полная функциональность:**
- Три колонки для карточек
- Расширенные фильтры
- Боковые панели
- Hover-эффекты

## Анимации и переходы

### Микроанимации

**Загрузка:**
```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading {
  animation: spin 1s linear infinite;
}
```

**Появление:**
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}
```

**Успех:**
```css
@keyframes success {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.success {
  animation: success 0.5s ease-out;
}
```

### Переходы

**Общие:**
```css
transition: all 0.2s ease-in-out;
```

**Hover:**
```css
transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
```

**Focus:**
```css
transition: border-color 0.2s ease-out, box-shadow 0.2s ease-out;
```

## Доступность (Accessibility)

### Цветовой контраст

- **Обычный текст**: минимум 4.5:1
- **Крупный текст**: минимум 3:1
- **Интерактивные элементы**: минимум 3:1

### Навигация с клавиатуры

- **Tab**: переход между элементами
- **Enter/Space**: активация кнопок
- **Escape**: закрытие модальных окон
- **Стрелки**: навигация в списках

### Семантическая разметка

- **Заголовки**: правильная иерархия H1-H6
- **Списки**: ul/ol для навигации
- **Формы**: label для всех полей
- **Кнопки**: описательный текст

### ARIA-атрибуты

```html
<button aria-label="Закрыть модальное окно">
<nav aria-label="Основная навигация">
<div role="alert" aria-live="polite">
```

## Темная тема

### Цветовая схема

**Фон:**
- **Background**: #111827 (Gray-900)
- **Surface**: #1F2937 (Gray-800)
- **Border**: #374151 (Gray-700)

**Текст:**
- **Primary**: #F9FAFB (Gray-50)
- **Secondary**: #D1D5DB (Gray-300)
- **Muted**: #9CA3AF (Gray-400)

**Акценты:**
- **Primary**: #3B82F6 (Blue-500)
- **Success**: #10B981 (Emerald-500)
- **Warning**: #F59E0B (Amber-500)
- **Danger**: #EF4444 (Red-500)

### Переключение темы

**Кнопка переключения:**
- Иконка солнца/луны
- Плавный переход
- Сохранение в localStorage
- Системная тема по умолчанию

## Компоненты React

### Структура компонентов

```
src/components/
├── common/
│   ├── Button/
│   ├── Input/
│   ├── Card/
│   ├── Modal/
│   └── Loading/
├── layout/
│   ├── Header/
│   ├── Sidebar/
│   └── Footer/
├── tasks/
│   ├── TaskCard/
│   ├── TaskList/
│   ├── TaskFilters/
│   └── TaskForm/
├── profile/
│   ├── ProfileCard/
│   ├── ProfileStats/
│   └── ProfileEdit/
├── escrow/
│   ├── EscrowCard/
│   ├── EscrowList/
│   └── EscrowActions/
├── support/
│   ├── ChatInterface/
│   ├── TicketForm/
│   └── TicketList/
└── appeals/
    ├── AppealForm/
    ├── AppealList/
    └── AppealStatus/
```

### Примеры компонентов

**Button Component:**
```tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  variant,
  size,
  disabled,
  loading,
  children,
  onClick
}) => {
  // Implementation
};
```

**TaskCard Component:**
```tsx
interface TaskCardProps {
  task: {
    id: number;
    title: string;
    description: string;
    budget: number;
    deadline: string;
    customer: User;
    proposalsCount: number;
  };
  onView: (id: number) => void;
  onPropose: (id: number) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onView,
  onPropose
}) => {
  // Implementation
};
```

## Иконки и иллюстрации

### Иконки

**Набор иконок:**
- **Heroicons** (основной набор)
- **Lucide React** (дополнительные иконки)
- **Custom icons** (специфичные для платформы)

**Размеры:**
- **Small**: 16px
- **Medium**: 20px
- **Large**: 24px
- **XLarge**: 32px

### Иллюстрации

**Пустые состояния:**
- Нет задач
- Нет предложений
- Нет уведомлений
- Ошибка загрузки

**Onboarding:**
- Добро пожаловать
- Первые шаги
- Создание профиля
- Первая задача

## Производительность

### Оптимизация изображений

- **WebP формат** для современных браузеров
- **Lazy loading** для изображений
- **Responsive images** с разными размерами
- **Compression** без потери качества

### Анимации

- **CSS transforms** вместо изменения layout
- **will-change** для анимируемых элементов
- **requestAnimationFrame** для сложных анимаций
- **Reduced motion** для пользователей с ограничениями

### Загрузка

- **Skeleton screens** во время загрузки
- **Progressive loading** для больших списков
- **Virtual scrolling** для длинных списков
- **Code splitting** для уменьшения bundle size
