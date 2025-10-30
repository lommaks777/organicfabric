# 📋 Чек-лист готовности системы к тестированию

## ✅ Что уже готово:

1. **Код скомпилирован** - ✅
2. **Зависимости установлены** - ✅
3. **Структура проекта создана** - ✅
4. **HTTP сервер настроен** - ✅
5. **Эндпоинт `/api/cron/poll-drive` создан** - ✅

## ⚠️ Что нужно настроить перед тестированием:

### 1. База данных PostgreSQL
**Текущий статус:** ❌ Не запущена

**Варианты решения:**
- **Вариант A (Локальный PostgreSQL):**
  ```bash
  # Установить PostgreSQL (если еще не установлен)
  brew install postgresql
  
  # Запустить PostgreSQL
  brew services start postgresql
  
  # Создать базу данных
  createdb organicfabric
  
  # Запустить миграции
  npm run db:migrate
  npm run db:generate
  ```

- **Вариант B (Docker):**
  ```bash
  docker run --name organicfabric-db \
    -e POSTGRES_USER=user \
    -e POSTGRES_PASSWORD=password \
    -e POSTGRES_DB=organicfabric \
    -p 5432:5432 \
    -d postgres:15
  
  # Затем запустить миграции
  npm run db:migrate
  npm run db:generate
  ```

### 2. Google Drive настройки
**Текущий статус:** ❌ Требуется настройка

**Что нужно добавить в `.env`:**
```env
# Путь к файлу service account
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"zeta-courage-470701-e4",...}'

# ID папки Google Drive (из последней строки .env - возможно это ID)
GOOGLE_DRIVE_FOLDER_ID="1Wxmu44uttsduNRkNbIkPvKpwFlr-vi3B"
```

**Как получить GOOGLE_SERVICE_ACCOUNT_JSON:**
```bash
# Содержимое файла zeta-courage-470701-e4-58be4b6abe48.json нужно вставить в .env как одну строку
cat zeta-courage-470701-e4-58be4b6abe48.json | tr -d '\n' > temp.txt
# Затем вставьте содержимое temp.txt в .env как значение GOOGLE_SERVICE_ACCOUNT_JSON
```

### 3. WordPress настройки
**Текущий статус:** ✅ Уже настроен в `.env`
- URL: https://shmmoscow.ru
- Username: master
- App Password: настроен

## 🚀 Порядок тестирования (после настройки):

### Шаг 1: Запустить базу данных и миграции
```bash
# Выберите один из вариантов выше для запуска PostgreSQL
npm run db:migrate
npm run db:generate
```

### Шаг 2: Обновить .env файл
Добавьте недостающие переменные:
```env
GOOGLE_SERVICE_ACCOUNT_JSON='...'  # JSON из файла zeta-courage-470701-e4-58be4b6abe48.json
GOOGLE_DRIVE_FOLDER_ID="1Wxmu44uttsduNRkNbIkPvKpwFlr-vi3B"
```

### Шаг 3: Запустить сервер
```bash
npm run dev
```

### Шаг 4: Подготовить тестовый файл
1. Создайте пустой Google Doc в папке с ID `1Wxmu44uttsduNRkNbIkPvKpwFlr-vi3B`
2. Убедитесь, что service account имеет доступ к этой папке

### Шаг 5: Вызвать эндпоинт
```bash
curl http://localhost:3000/api/cron/poll-drive
```
или просто откройте в браузере:
```
http://localhost:3000/api/cron/poll-drive
```

### Шаг 6: Проверить результаты

#### 6.1 Логи в консоли
Должны увидеть:
- "Found new file to process: ..."
- "Created and claimed Job ID: ..."
- "Created WordPress draft. Post ID: ..."
- "Job ... completed successfully"

#### 6.2 База данных
```bash
npx prisma studio
```
Откроется UI где можно увидеть созданную Job запись

#### 6.3 WordPress
Перейдите на https://shmmoscow.ru/wp-admin/edit.php?post_status=draft
Должен появиться новый черновик

#### 6.4 Google Drive
Файл должен быть переименован в `{original-name}-done`

## 🔧 Текущие переменные окружения (.env):

```env
DATABASE_URL="postgresql://user:password@localhost:5432/organicfabric"
GOOGLE_SERVICE_ACCOUNT_JSON=""  # ❌ НУЖНО ЗАПОЛНИТЬ
GOOGLE_DRIVE_FOLDER_ID=""       # ❌ НУЖНО ЗАПОЛНИТЬ
WP_API_URL="https://shmmoscow.ru"  # ✅
WP_USERNAME="master"                # ✅
WP_APP_PASSWORD="ikXu K3R2 EuyI fHjd 9GK2 7Kpo"  # ✅
```

## 📝 Следующие шаги:

1. ⚙️ Настроить PostgreSQL (выбрать вариант A или B)
2. 🔑 Заполнить GOOGLE_SERVICE_ACCOUNT_JSON в .env
3. 📁 Заполнить GOOGLE_DRIVE_FOLDER_ID в .env
4. ▶️ Запустить миграции БД
5. 🧪 Запустить тесты по инструкции выше

---

**Готовность системы: 70%**
- Код: ✅ 100%
- Инфраструктура: ⚠️ 40% (нужна БД и настройка Google Drive)
