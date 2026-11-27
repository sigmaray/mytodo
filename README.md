# mytodo

**A calm, self-hosted home for your tasks and projects.** Capture what needs doing, break big plans into smaller steps, and keep the whole picture in view—on infrastructure you control.

## Plan your work your way

- **Keep tasks organized.** Sort work into projects and sections, then add subtasks as deeply as you need.
- **See what matters next.** Set due dates and priorities, then switch between your task list and calendar views.
- **Find things quickly.** Search tasks, descriptions, and labels, or group work with labels that fit your workflow.
- **Reorder and move with ease.** Drag tasks and sections to arrange your lists, or move tasks between projects and the Inbox.
- **Keep the details close.** Add descriptions and comments to tasks. Optional attachments let you keep related files alongside them.
- **Take your work with you.** Export your tasks as Markdown or JSON, with an advanced Markdown option for descriptions, dates, labels, and comments.
- **Share one installation across accounts.** An administrator manages accounts; each person gets a private workspace for their tasks, projects, and sections.

mytodo is a web app backed by PostgreSQL. Run it on your own machine or server, and access it in a browser. Attachments and project archiving can be enabled when you want them.

## Get started locally

### You’ll need

- Node.js 22 or newer
- pnpm 11 or newer
- PostgreSQL 14 or newer (or Docker Compose for a local database)
- [Task](https://taskfile.dev), used for the commands below

Install dependencies and create your local environment file:

```bash
pnpm install
cp .env.example .env
```

Start the app and its PostgreSQL database with Docker Compose:

```bash
task dev:docker
```

Open the app at `http://localhost:5173`. The API is available at `http://localhost:3000`. The command stays in the foreground; press Ctrl+C to stop the services. Starting the stack preserves database data and applies pending migrations.

If PostgreSQL is already running, start the app services in separate terminals instead:

```bash
pnpm dev:backend
pnpm dev:frontend
```

By default, the backend connects to `postgres://todoist:todoist@localhost:5432/todoist`. Configure the connection with `MYTODO_DB_HOST`, `MYTODO_DB_PORT`, `MYTODO_DB_USER`, `MYTODO_DB_PASSWORD`, and `MYTODO_DB_NAME` in `.env`. For a standalone local database, apply migrations with `task db:migrate` when the schema needs updating.

## Accounts and personal workspaces

An administrator can create, update, and delete accounts in Settings. Every account has its own tasks, projects, and sections, and the installation must always have at least one administrator.

For a fresh installation, set the initial administrator password after starting the stack:

```bash
task dev:docker:users:update USERNAME=admin PASSWORD='choose-a-strong-password'
```

You can also manage accounts from the command line:

```bash
task dev:docker:users:create USERNAME=sam PASSWORD='choose-a-password'
task dev:docker:users:create USERNAME=admin2 PASSWORD='choose-a-password' ADMIN=true
task dev:docker:users:update USERNAME=sam NAME=samuel PASSWORD='new-password' ADMIN=false
task dev:docker:users:delete USERNAME=sam
task dev:docker:users:list
```

These development commands use the `MYTODO_DB_*` settings and expect the local database to be available. When migrating an existing installation, its existing account and data are assigned to `admin`; a previously configured username is preserved. In that case, update that account’s password using its preserved username.

## Run a production installation

Choose the deployment that fits your server:

- **Use existing infrastructure:** `docker-compose.yml` connects to an existing PostgreSQL database and the shared `infra` Docker network. Configure `.env` from `deploy.env.example`.
- **Bring the supporting services:** `docker-compose.with-infra.yml` includes PostgreSQL and a Caddy HTTPS proxy.

### Existing PostgreSQL and shared proxy

Create a dedicated database using your infrastructure’s provisioning method, then configure `.env`:

```bash
cp deploy.env.example .env
```

Set `MYTODO_DB_HOST`, `MYTODO_DB_PORT`, `MYTODO_DB_USER`, `MYTODO_DB_PASSWORD`, `MYTODO_DB_NAME`, and `MYTODO_HTTP_PORT`. Enter the database password as-is; the backend encodes it when constructing the connection string. The database account needs permission to create the database if it does not exist.

```bash
task prod:docker:db:setup
task prod:docker:up
task prod:docker:users:update USERNAME=admin PASSWORD='choose-a-strong-password'
```

The web container listens on loopback port `18082` by default and joins `infra`. Point your shared Caddy proxy to it:

```caddyfile
todoist.example.com {
    reverse_proxy todoist-web:80
}
```

Point your domain to the server and reload the shared proxy. Keep the API container private; production session cookies require HTTPS.

### Self-contained stack with HTTPS

Create `.env` from `.env.example`, set a public hostname with DNS pointing to the server, and choose a strong alphanumeric database password:

```dotenv
MYTODO_DB_USER=todoist
MYTODO_DB_PASSWORD=replace-with-a-strong-alphanumeric-password
MYTODO_DB_NAME=todoist
MYTODO_DOMAIN=todoist.example.com
```

Start the stack and set the administrator password:

```bash
task prod:docker:with-infra:db:setup
task prod:docker:with-infra:up
task prod:docker:with-infra:users:update USERNAME=admin PASSWORD='choose-a-strong-password'
```

Caddy obtains and renews HTTPS certificates automatically. Ports 80 and 443 must be reachable from the internet. Override them with `MYTODO_HTTP_PORT` and `MYTODO_HTTPS_PORT` if needed. Stop the stack with `task prod:docker:with-infra:down`.

### Optional features and persistent data

Attachments are off by default. To enable them, add these settings to `.env`:

```dotenv
MYTODO_ATTACHMENTS_ENABLED=true
MYTODO_ATTACHMENTS_DIR=/var/lib/mytodo/attachments
MYTODO_ATTACHMENTS_VOLUME=./v-attachments
```

The host directory mounted at `MYTODO_ATTACHMENTS_VOLUME` must be writable by the API container’s `node` user (UID 1000 on Linux). Back it up along with PostgreSQL data.

Project archiving is also off by default. Enable it with `MYTODO_PROJECT_ARCHIVING_ENABLED=true` to show archive controls and the Archived projects page.

The self-contained stack stores PostgreSQL data in `./v-postgres` by default; override this with `MYTODO_POSTGRES_VOLUME`. Attachments use `./v-attachments` by default. Back up these directories and the Caddy certificate volumes. Normal start and stop commands preserve data. Database drop commands permanently delete it; use them only when you intend to erase the selected database or its tables.

## Development and maintenance

Run checks:

```bash
task test:unit
task test
pnpm lint
pnpm format:check
pnpm build
```

`task test:unit` runs domain, backend, and frontend unit and integration tests. `task test` also runs Playwright end-to-end tests. To run E2E tests against a configured local test environment only, use `pnpm test:e2e`.

Database commands use the `MYTODO_DB_*` connection settings. Useful commands include:

```bash
task db:create
task db:migrate
task db:drop-tables
task db:drop
```

`db:drop-tables` removes all tables and their data; `db:drop` removes the entire database. Development and production Docker deployments also provide scoped database commands. For example, `task dev:docker:db:dump` creates a timestamped custom-format dump under `dumps/`, and `task dev:docker:db:restore DUMP_FILE=dumps/your-dump.dump` restores it.

The development and test environments expose database tools at `http://127.0.0.1:5173/tools/`. This page is disabled in production.

## Project layout

```text
packages/domain   Shared task types and rules
apps/backend      Hono API, PostgreSQL schema, and backend tests
apps/frontend     React web app and UI tests
e2e               Playwright end-to-end tests
```
