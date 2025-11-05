# Railway Deployment Guide

## Подготовка к деплою

### 1. Создайте проект на Railway

1. Перейдите на [railway.app](https://railway.app)
2. Залогиньтесь через GitHub
3. Нажмите "New Project"
4. Выберите "Deploy from GitHub repo"
5. Выберите репозиторий `organicfabric`

### 2. Добавьте PostgreSQL

1. В проекте Railway нажмите "+ New"
2. Выберите "Database" → "PostgreSQL"
3. Railway автоматически создаст базу данных
4. Переменная `DATABASE_URL` будет автоматически добавлена

### 3. Настройте переменные окружения

В Railway добавьте следующие переменные:

```
NODE_ENV=production
PORT=3000

# OpenAI
OPENAI_API_KEY=your_openai_key

# Google Drive
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# WordPress
WORDPRESS_URL=https://your-site.com
WORDPRESS_USERNAME=your_username
WORDPRESS_PASSWORD=your_app_password

# Vertex AI (опционально)
VERTEX_PROJECT_ID=your_project_id
VERTEX_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
IMAGE_COUNT=3

# Database (автоматически создается Railway)
DATABASE_URL=postgresql://...
```

### 4. Настройте Cron Job (опционально)

Для автоматической обработки файлов каждые 30 минут:

1. В Railway перейдите в настройки проекта
2. Добавьте новый сервис "Cron Job"
3. Настройте:
   - Schedule: `*/30 * * * *` (каждые 30 минут)
   - Command: `curl https://your-app.railway.app/api/cron/poll-drive`

Или используйте внешний cron сервис:
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)

### 5. Деплой

Railway автоматически:
1. Обнаружит `Dockerfile`
2. Соберет образ
3. Запустит миграции БД (`prisma migrate deploy`)
4. Запустит приложение

## Проверка деплоя

После деплоя проверьте:

1. **Health check**: `https://your-app.railway.app/`
2. **Cron endpoint**: `https://your-app.railway.app/api/cron/poll-drive`

## Мониторинг

Railway предоставляет:
- Логи в реальном времени
- Метрики использования CPU/памяти
- Автоматический рестарт при сбоях

## Обновление

После push в GitHub Railway автоматически:
1. Пересобирает образ
2. Запускает миграции
3. Перезапускает приложение

## Локальное тестирование Docker

```bash
# Сборка образа
docker build -t organicfabric .

# Запуск с .env файлом
docker run --env-file .env -p 3000:3000 organicfabric
```

## Troubleshooting

### Проблемы с миграциями
Если миграции не применяются:
```bash
railway run npx prisma migrate deploy
```

### Проверка логов
```bash
railway logs
```

### Подключение к БД
```bash
railway connect postgres
```
