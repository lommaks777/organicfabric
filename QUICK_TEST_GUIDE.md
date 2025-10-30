# 🚀 Быстрая инструкция для теста

## ✅ Статус готовности

**Код готов:** ✅  
**Настройки Google Drive:** ✅  
**Настройки WordPress:** ✅  
**База данных:** ❌ Требуется запуск

---

## 📋 Что сделать для теста (4 шага):

### 1️⃣ Запустить PostgreSQL и создать БД

**Вариант А - Локальный PostgreSQL:**
```bash
brew services start postgresql
createdb organicfabric
npm run db:migrate
npm run db:generate
```

**Вариант B - Docker (если нет PostgreSQL):**
```bash
docker run --name organicfabric-db \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=organicfabric \
  -p 5432:5432 \
  -d postgres:15

npm run db:migrate
npm run db:generate
```

### 2️⃣ Запустить сервер
```bash
npm run dev
```

Должны увидеть:
```
Application starting...
Server is running on http://localhost:3000
Cron endpoint: http://localhost:3000/api/cron/poll-drive
```

### 3️⃣ Подготовить тестовый файл в Google Drive

1. Перейдите в папку Google Drive с ID: `1Wxmu44uttsduNRkNbIkPvKpwFlr-vi3B`
2. Создайте пустой Google Doc (любое имя, например "Test Document")
3. Убедитесь, что service account `id-978@zeta-courage-470701-e4.iam.gserviceaccount.com` имеет доступ к папке

### 4️⃣ Запустить тест

**Откройте в браузере:**
```
http://localhost:3000/api/cron/poll-drive
```

**Или используйте curl:**
```bash
curl http://localhost:3000/api/cron/poll-drive
```

---

## ✅ Что проверить после теста:

### 1. **Консоль сервера** - должны увидеть логи:
```
Found new file to process: Test Document
Created and claimed Job ID: ...
Created WordPress draft. Post ID: ...
Job ... completed successfully
```

### 2. **База данных** - откройте Prisma Studio:
```bash
npx prisma studio
```
Должна быть запись в таблице `Job` со статусом `DONE`

### 3. **WordPress** - проверьте черновики:
Откройте: https://shmmoscow.ru/wp-admin/edit.php?post_status=draft

Должен появиться новый пост с названием `[AUTO] Test Document`

### 4. **Google Drive** - файл переименован:
Файл должен теперь называться `Test Document-done`

---

## ❓ Если что-то не работает:

### Ошибка БД (Can't reach database):
```bash
# Проверьте статус PostgreSQL
brew services list | grep postgresql

# Или для Docker
docker ps | grep organicfabric-db
```

### Ошибка Google Drive (Authentication):
Убедитесь, что service account имеет доступ к папке:
1. Откройте папку в Google Drive
2. Нажмите "Share" / "Поделиться"
3. Добавьте email: `id-978@zeta-courage-470701-e4.iam.gserviceaccount.com`
4. Дайте права "Editor" / "Редактор"

### Ошибка WordPress (401/403):
Проверьте, что в `.env` правильные данные:
- `WP_API_URL="https://shmmoscow.ru"`
- `WP_USERNAME="master"`
- `WP_APP_PASSWORD="ikXu K3R2 EuyI fHjd 9GK2 7Kpo"`

---

## 🎯 Ожидаемый результат теста:

✅ HTTP ответ 200 с JSON:
```json
{
  "success": true,
  "message": "Processed file: Test Document",
  "jobId": "..."
}
```

✅ Файл в Drive переименован на `Test Document-done`  
✅ Черновик создан в WordPress  
✅ Запись в БД создана со статусом DONE  

---

**Система готова к тесту на 95%!** Осталось только запустить PostgreSQL.
