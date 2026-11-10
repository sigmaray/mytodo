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
- Task: https://taskfile.dev (used by the commands below)

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

To run the application and PostgreSQL locally with Docker Compose:

```bash
task dev:docker
```

The app is then available at `http://localhost:5173` and the API at `http://localhost:3000`. This command stays in the foreground; press Ctrl+C to stop it.

Application launch commands do not drop or reset database data. The development Docker stack runs migrations as part of its startup; for standalone local backend/frontend development, run `task db:migrate` when the schema needs updating.

```bash
task dev:docker
```

For a local setup with PostgreSQL already running, start the backend and frontend in separate terminals:

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

The `dev:docker:users:*` commands use the `MYTODO_DB_*` settings, which default to the local development database at `127.0.0.1:5432`. Run them while the development database is available.

To save or restore a custom-format development database dump:

```bash
task dev:docker:db:dump
task dev:docker:db:restore DUMP_FILE=dumps/todoist-2026-01-01_120000.dump
```

The dump command creates a timestamped file under `dumps/` by default. Restore replaces matching database objects; choose a dump carefully.

### Production Docker Compose with shared PostgreSQL

The production stack joins the `infra` Docker network and uses PostgreSQL and Caddy from your shared infrastructure. Before starting it, create a dedicated database using your infrastructure's database provisioning method, then configure `.env` with `MYTODO_DB_HOST`, `MYTODO_DB_PORT`, `MYTODO_DB_USER`, `MYTODO_DB_PASSWORD`, `MYTODO_DB_NAME`, and `MYTODO_HTTP_PORT`. Enter the database password as-is; the backend encodes it when building the connection string:

```bash
cp deploy.env.example .env
# Edit the MYTODO_DB_* settings in .env
task prod:docker:db:setup
task prod:docker:up
```

`prod:docker:db:setup` creates the database if it is missing and applies pending migrations. The database account needs permission to create a database when it does not exist. The normal `task prod:docker` command preserves existing data. Use `task prod:docker:db:drop-tables` only when you intentionally want to erase all tables and data.

The API applies Drizzle migrations before starting. Set `MYTODO_ATTACHMENTS_ENABLED=true` to show attachment controls and enable attachment API routes; it defaults to `false`. When enabled, `MYTODO_ATTACHMENTS_DIR` must point to a writable directory inside the API container, normally `/var/lib/mytodo/attachments`. Compose bind-mounts the host directory from `MYTODO_ATTACHMENTS_VOLUME` there. The default is `./v-attachments` in the project directory; set `MYTODO_ATTACHMENTS_VOLUME` to another host directory to override it. On Linux, make sure the host directory is writable by the API's `node` user (UID 1000). Back up this directory together with the database. If upgrading from a previous version that used the named `mytodo_attachments` volume, copy its files into the configured host directory before starting the new Compose configuration; keep the old volume until the new installation is verified. Set the initial administrator password once:

Project archiving is disabled by default. Set `MYTODO_PROJECT_ARCHIVING_ENABLED=true` to show project archive controls and the Archived projects page, and enable the archive API operation.

```bash
task prod:docker:users:update USERNAME=admin PASSWORD='your-strong-password'
```

The web container listens on loopback port `18082` by default and joins `infra` so the shared Caddy proxy can reach it. Add a site block for your public hostname to the Caddyfile used by your shared reverse proxy:

```caddyfile
todoist.example.com {
    reverse_proxy todoist-web:80
}
```

Point the hostname to the server and reload the existing reverse-proxy Compose stack to enable HTTPS. Do not expose the API container directly; production session cookies require HTTPS.

### Self-contained production Docker Compose

To run without a shared infrastructure stack, use `docker-compose.with-infra.yml`. It includes its own PostgreSQL database and Caddy HTTPS proxy. Create `.env` with a strong alphanumeric database password and a public hostname whose DNS points to this server. You can start from `.env.example` and edit it for production:

```dotenv
MYTODO_DB_USER=todoist
MYTODO_DB_PASSWORD=replace-with-a-strong-alphanumeric-password
MYTODO_DB_NAME=todoist
MYTODO_ATTACHMENTS_ENABLED=true
MYTODO_ATTACHMENTS_DIR=/var/lib/mytodo/attachments
MYTODO_ATTACHMENTS_VOLUME=./v-attachments
MYTODO_PROJECT_ARCHIVING_ENABLED=false
MYTODO_DOMAIN=todoist.example.com
```

Add `MYTODO_POSTGRES_VOLUME=./v-postgres` to `.env` to override the default PostgreSQL data directory. The default is `./v-postgres`.

Start the full stack and initialize the administrator password:

```bash
task prod:docker:with-infra:db:setup
task prod:docker:with-infra:up
task prod:docker:with-infra:users:update USERNAME=admin PASSWORD='your-strong-password'
```

The database setup task starts the bundled PostgreSQL if needed and applies pending migrations. The normal launch command preserves existing database data. Stop the stack with `task prod:docker:with-infra:down`. Use `task prod:docker:with-infra:db:drop-tables` only when you intentionally want to erase all tables and data. `task prod:docker:with-infra` remains an alias for `up`.

Manage accounts in this deployment with:

```bash
task prod:docker:with-infra:users:list
task prod:docker:with-infra:users:create USERNAME=sam PASSWORD='password'
task prod:docker:with-infra:users:update USERNAME=sam NAME=samuel PASSWORD='new-password' ADMIN=false
task prod:docker:with-infra:users:delete USERNAME=sam
```

Caddy obtains and renews the HTTPS certificate automatically. Ports 80 and 443 must be reachable from the internet; set `MYTODO_HTTP_PORT` or `MYTODO_HTTPS_PORT` to use different host ports (defaults: 80 and 443). PostgreSQL data is stored in the host directory configured by `MYTODO_POSTGRES_VOLUME` (default `./v-postgres`); Caddy certificates use named Docker volumes; attachments are stored in the host directory configured by `MYTODO_ATTACHMENTS_VOLUME` (default `./v-attachments`). Back up both host directories and the Caddy volumes. If upgrading an installation that used the previous named `postgres-data` volume, copy its contents into the configured host directory before starting this Compose configuration so the existing database is retained.

### Tests

```bash
task test:unit
task test
task dev:docker:test
task test:prod:lxd:test
```

`task test:unit` runs the domain, backend, and frontend unit/integration tests. `task test` runs those tests followed by Playwright E2E. `task dev:docker:test` runs the Docker test stack and removes its containers and volumes when finished. `task test:prod:lxd:test` creates an Ubuntu LXD container, installs Git, Docker, Task, and Task Bash completion, clones `https://github.com/sigmaray/mytodo` into the container, tests the self-contained production stack, and removes the container afterward. To leave the stack running for browser access, use `task prod:lxd:up`; it prints the URL and cleanup command and by default sets the `admin` account password to `admin`. Change this password as soon as possible. Set `LXD_CREATE_DEFAULT_ADMIN=false` to skip this setup. `task prod:lxd:down` stops the stack and removes its container. The setup script defaults to `LXD_REMOVE_CONTAINER=false` and `LXD_BROWSER_MODE=true`; the temporary test task sets removal to true. In browser mode, the LXD setup disables Secure cookies because it serves plain HTTP on the private container IP; use this mode only on a trusted local network. Production Compose defaults `MYTODO_COOKIE_SECURE` to `true`. LXD tasks require an initialized daemon with nesting support and internet access, and do not copy the host `.env`. Set `LXD_IMAGE` or `LXD_CONTAINER_NAME` to override the image or container name. To run only E2E tests against your configured local test environment, use `pnpm test:e2e`.

Playwright runs the backend with `MYTODO_ENABLE_PLAYWRIGHT_API=true`. This enables authenticated test endpoints for clearing all data, clearing an individual allowlisted table (`tasks`, `task_comments`, `sections`, or `projects`), and creating tasks, projects, sections, comments, and attachments. They are unavailable in production, and startup fails if the flag is enabled there. E2E helpers in `e2e/api.ts` use these endpoints to prepare state so UI tests can focus on the behavior they verify.

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
task dev:docker:db:create
```

`db:create` uses the host connection in `MYTODO_DB_*`; `dev:docker:db:create` creates or checks the database in the development Compose PostgreSQL.

Drop the entire database:

```bash
task db:drop
task dev:docker:db:drop
task prod:docker:db:drop
task prod:docker:with-infra:db:drop
```

These commands permanently delete the selected database and all its data. Use the production variants only when you intentionally want to erase the production database.

Drop all tables in the database:

```bash
task db:drop-tables
```

Run Drizzle migrations:

```bash
task db:migrate
task dev:docker:db:migrate
```

Use `db:migrate` for a PostgreSQL instance reachable from the host using `MYTODO_DB_*`; use `dev:docker:db:migrate` for the PostgreSQL service in the development Compose stack.

`db:drop-tables` permanently removes every table and its data while keeping the database itself. `db:drop` removes the database entirely. Neither is part of routine startup. Production database tasks are scoped by deployment mode: `task prod:docker:db:*` uses shared external PostgreSQL, while `task prod:docker:with-infra:db:*` uses the bundled PostgreSQL. Each mode has separate `create`, `drop`, `drop-tables`, and `migrate` tasks, plus a `setup` task that creates the database if needed and applies migrations without dropping data.
