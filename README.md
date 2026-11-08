# Todoist Clone

Self-hosted Todoist-style task manager MVP. The project is a pnpm monorepo with a pure functional domain package, a Hono backend, and a React/Vite frontend.

## English

### What Is Included

- Infinite task nesting with `parentId`.
- Task priorities from P1 to P4.
- Boolean completion status.
- Lexical ordering field for future drag-and-drop reordering.
- Domain logic extracted into pure functions in `packages/domain`.
- Backend API in `apps/backend`.
- Frontend SPA in `apps/frontend`.
- Unit, integration, UI, and E2E test setup.

### Project Structure

```text
packages/domain   Pure types and task helpers
apps/backend      Hono API, Drizzle schema, backend tests
apps/frontend     React + Vite app, TanStack Query, UI tests
e2e               Playwright tests
```

### Requirements

- Node.js 22+
- pnpm 11+
- PostgreSQL 14+
- Task, optional but recommended: https://taskfile.dev

### Setup

```bash
pnpm install
cp .env.example .env
```

The backend uses this default database URL when one is not provided:

```bash
postgres://todoist:todoist@localhost:5432/todoist
```

### Development

```bash
task backend
task frontend
task dev:docker
```

Or with pnpm directly:

```bash
pnpm dev:backend
pnpm dev:frontend
```

The development and test environments expose database tools at:

```text
http://127.0.0.1:5173/tools/
```

The tools page is disabled in production mode.

### Production Docker Compose with shared PostgreSQL

The production stack joins the `infra` Docker network and uses the shared PostgreSQL instance from `~/r/sandbox/infra`. Before starting it, create a dedicated database and set the percent-encoded PostgreSQL URL in `.env.production`:

```bash
~/r/sandbox/infra/postgres/scripts/create-database.sh todoist
cp deploy.env.example .env.production
# Edit DATABASE_URL in .env.production
docker compose --env-file .env.production up -d --build
```

The API applies Drizzle migrations before starting. Set the initial administrator password once:

```bash
docker compose --env-file .env.production exec todoist-api \
  ../../node_modules/.bin/tsx src/users-cli.ts update admin --password='your-strong-password'
```

The web container listens on loopback port `18082` by default and joins `infra` so the shared Caddy proxy can reach it. Add a site block for your public hostname to `~/r/sandbox/infra/reverse-proxy/Caddyfile`:

```caddyfile
todoist.example.com {
    reverse_proxy todoist-web:80
}
```

Point the hostname to the server and reload the existing reverse-proxy Compose stack to enable HTTPS. Do not expose the API container directly; production session cookies require HTTPS.

### Tests

```bash
task test
task test:unit
task test:docker
task test:docker:app
pnpm test:e2e
```

### Database Tasks

The Taskfile supports these variables:

```bash
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=todoist
DB_PASSWORD=todoist
DB_NAME=todoist
DATABASE_URL=postgres://todoist:todoist@127.0.0.1:5432/todoist
```

Create the database:

```bash
task db:create
```

Drop all tables in the database:

```bash
task db:drop-tables
```

Run Drizzle migrations:

```bash
task db:migrate
```

## Русский

### Что Уже Есть

- Бесконечная вложенность задач через `parentId`.
- Приоритеты задач от P1 до P4.
- Булев статус выполнения.
- Поле лексической сортировки для будущего drag-and-drop.
- Доменная логика вынесена в чистые функции в `packages/domain`.
- Backend API в `apps/backend`.
- Frontend SPA в `apps/frontend`.
- Настроены unit, integration, UI и E2E тесты.

### Структура Проекта

```text
packages/domain   Чистые типы и функции для задач
apps/backend      Hono API, Drizzle schema, backend-тесты
apps/frontend     React + Vite, TanStack Query, UI-тесты
e2e               Playwright-тесты
```

### Требования

- Node.js 22+
- pnpm 11+
- PostgreSQL 14+
- Task, опционально, но удобно: https://taskfile.dev

### Установка

```bash
pnpm install
cp .env.example .env
```

Если `DATABASE_URL` не задан, backend использует адрес по умолчанию:

```bash
postgres://todoist:todoist@localhost:5432/todoist
```

### Разработка

```bash
task backend
task frontend
task dev:docker
```

В development и test окружениях доступны инструменты базы данных:

```text
http://127.0.0.1:5173/tools/
```

В production режиме страница инструментов отключена.

### Пользователи

При миграции существующий аккаунт и его данные переносятся пользователю `admin` (если раньше в настройках было задано имя, сохраняется оно). Для первой настройки пароля администратора выполните:

```bash
task dev:docker:users:list
task dev:docker:users:update USERNAME=legacy-admin PASSWORD='пароль'
```

После этого войдите в приложение под администратором. В разделе Settings администраторы могут создавать, изменять и удалять аккаунты; каждый пользователь видит только свои задачи, проекты и секции. В системе должен оставаться хотя бы один администратор.

Управление аккаунтами также доступно через CLI:

```bash
task dev:docker:users:create USERNAME=sam PASSWORD='пароль'
task dev:docker:users:create USERNAME=admin2 PASSWORD='пароль' ADMIN=true
task dev:docker:users:update USERNAME=sam NAME=samuel PASSWORD='новый-пароль' ADMIN=false
task dev:docker:users:delete USERNAME=sam
task dev:docker:users:list
```

CLI использует `DATABASE_URL` или PostgreSQL по умолчанию `postgres://todoist:todoist@127.0.0.1:5432/todoist`.

Или напрямую через pnpm:

```bash
pnpm dev:backend
pnpm dev:frontend
```

### Тесты

```bash
task test
task test:unit
task test:docker
task test:docker:app
pnpm test:e2e
```

### Команды Для Базы Данных

Taskfile поддерживает эти переменные:

```bash
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=todoist
DB_PASSWORD=todoist
DB_NAME=todoist
DATABASE_URL=postgres://todoist:todoist@127.0.0.1:5432/todoist
```

Создать базу данных:

```bash
task db:create
```

Удалить все таблицы в базе:

```bash
task db:drop-tables
```

Запустить Drizzle-миграции:

```bash
task db:migrate
```
