# mytodo

Self-hosted task manager MVP. The project is a pnpm monorepo with a pure functional domain package, a Hono backend, and a React/Vite frontend.

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

The backend reads `MYTODO_DB_HOST`, `MYTODO_DB_PORT`, `MYTODO_DB_USER`, `MYTODO_DB_PASSWORD`, and `MYTODO_DB_NAME`. If omitted, it defaults to this local connection:

```bash
postgres://todoist:todoist@localhost:5432/todoist
```

### Development

To run the entire application locally, including PostgreSQL, with Docker:

```bash
task dev:docker
```

The app is then available at `http://localhost:5173` and the API at `http://localhost:3000`.

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

### Users

During migration, the existing account and its data are assigned to the `admin` user. If the account previously had a username configured, that username is preserved. To set the initial administrator password, run:

```bash
task dev:docker:users:list
task dev:docker:users:update USERNAME=legacy-admin PASSWORD='password'
```

Then sign in as the administrator. Administrators can create, update, and delete accounts in Settings. Each user can access only their own tasks, projects, and sections, and at least one administrator must remain.

Accounts can also be managed through the CLI:

```bash
task dev:docker:users:create USERNAME=sam PASSWORD='password'
task dev:docker:users:create USERNAME=admin2 PASSWORD='password' ADMIN=true
task dev:docker:users:update USERNAME=sam NAME=samuel PASSWORD='new-password' ADMIN=false
task dev:docker:users:delete USERNAME=sam
task dev:docker:users:list
```

The Taskfile user commands use the `MYTODO_DB_*` settings, which default to the local development database.

### Production Docker Compose with shared PostgreSQL

The production stack joins the `infra` Docker network and uses PostgreSQL and Caddy from your shared infrastructure. Before starting it, create a dedicated database using your infrastructure's database provisioning method, then set `MYTODO_DB_HOST`, `MYTODO_DB_PORT`, `MYTODO_DB_USER`, `MYTODO_DB_PASSWORD`, and `MYTODO_DB_NAME` in `.env.production`. Enter the database password as-is; the backend encodes it when building the connection string:

```bash
cp deploy.env.example .env.production
# Edit the MYTODO_DB_* settings in .env.production
docker compose --env-file .env.production up -d --build
```

The API applies Drizzle migrations before starting. Set the initial administrator password once:

```bash
docker compose --env-file .env.production exec todoist-api \
  ../../node_modules/.bin/tsx src/users-cli.ts update admin --password='your-strong-password'
```

The web container listens on loopback port `18082` by default and joins `infra` so the shared Caddy proxy can reach it. Add a site block for your public hostname to the Caddyfile used by your shared reverse proxy:

```caddyfile
todoist.example.com {
    reverse_proxy todoist-web:80
}
```

Point the hostname to the server and reload the existing reverse-proxy Compose stack to enable HTTPS. Do not expose the API container directly; production session cookies require HTTPS.

### Self-contained production Docker Compose

To run without a shared infrastructure stack, use `docker-compose.with-infra.yml`. It includes its own PostgreSQL database and Caddy HTTPS proxy. Create `.env.production` with a strong alphanumeric database password and a public hostname whose DNS points to this server:

```dotenv
MYTODO_DB_USER=todoist
MYTODO_DB_PASSWORD=replace-with-a-strong-alphanumeric-password
MYTODO_DB_NAME=todoist
MYTODO_DOMAIN=todoist.example.com
```

Start the full stack and initialize the administrator password:

```bash
docker compose --env-file .env.production -f docker-compose.with-infra.yml up -d --build
docker compose --env-file .env.production -f docker-compose.with-infra.yml exec todoist-api \
  ../../node_modules/.bin/tsx src/users-cli.ts update admin --password='your-strong-password'
```

Caddy obtains and renews the HTTPS certificate automatically. Ports 80 and 443 must be reachable from the internet. PostgreSQL data and Caddy certificates are stored in named Docker volumes. Back up the `postgres-data` volume regularly.

### Tests

```bash
task test
task test:unit
task test:docker
task test:docker:app
pnpm test:e2e
```

### Database Tasks

The Taskfile database commands accept these `MYTODO_`-prefixed variables:

```bash
MYTODO_DB_HOST=127.0.0.1
MYTODO_DB_PORT=5432
MYTODO_DB_USER=todoist
MYTODO_DB_PASSWORD=todoist
MYTODO_DB_NAME=todoist
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
