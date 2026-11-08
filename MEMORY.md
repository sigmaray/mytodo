# Project Memory

## 2026-11-08 — Уточнить правила читаемости и сопровождения

- В `AGENTS.md` добавлены правила организации frontend по feature-модулям, ограничения на ответственность `App.tsx` и Hono-обработчиков, требования к скриптам lint/format и порог eager JS chunk в 500 KiB с lazy-loading для тяжёлых маршрутов.
- Исходный код приложения не менялся: эта работа задаёт обязательные правила для будущих изменений.
- Проверка: `git diff --check`.

## 2026-11-08 — Исправить пять находок технического аудита

- Запрещены циклические перемещения задач в memory/PostgreSQL репозиториях; конкурентные переносы одного пользователя сериализуются advisory lock-ом.
- Комментарии добавляются атомарно под блокировкой задачи. Удаление проекта и секции транзакционное.
- Tools → Migrate включает `0007` и `0008`; `0007` стала идемпотентной. `0008` исправляет старые невалидные ссылки и добавляет составные FK и индексы для same-user целостности.
- Добавлены backend- и PostgreSQL E2E-регрессии. Обновлён аудит `docs/technical-audit-2026-11-08.md` со статусами исправлений.
- Проверки: `pnpm test` (105 тестов), `pnpm build`, `pnpm test:e2e` (33 теста), `drizzle-kit check` и `git diff --check` прошли. Изменения реализованы без классов; оставлен известный Vite chunk-size advisory.

## 2026-11-08 — Технический аудит проекта

- Создан `docs/technical-audit-2026-11-08.md` с приоритетными дефектами и рисками, оценками качества, планом исправлений и ограничениями аудита.
- Основные находки: API допускает циклическое перемещение задач; параллельные обновления комментариев могут терять записи; Tools → Migrate не включает миграцию `0007`.
- Проверки: `pnpm test` (103 теста) и `pnpm build` прошли. E2E и актуальные проверки уязвимостей зависимостей не запускались. Исходный код не менялся.

## 2026-11-08 — Add attachment indicators, removal, and library page

- Task rows now show a paperclip when any comment has attachments. The feature-gated Attachments sidebar page lists files across tasks with image previews, direct file links, task links that open task details, sizes, and upload times (comment creation time).
- Task detail dialogs show a remove button beside each attachment. Removing a file preserves a comment with text; removing the last file from an attachment-only comment deletes that comment. Backend task patch cleanup removes unreferenced files from storage.
- Added unit coverage for task indicators, the attachment library, and both deletion cases; extended E2E to verify the library and remove a pasted attachment. Verification: all 98 unit/integration tests pass, full build passes, focused E2E passes, and `git diff --check` passes.

## 2026-11-08 — Keep comment attachments visible while editing

- The comment edit branch showed only the textarea and actions. It now also renders the comment's existing attachments, including image previews, so they remain accessible while changing the body.
- Extended the attachment-only comment test to enter edit mode and assert that the image and download link remain visible. Frontend tests pass (59 tests), frontend build passes, and `git diff --check` passes.

## 2026-11-08 — Fix 400 when editing comments with attachments

- Investigated task `fdvdfvfd` in the dev PostgreSQL database; its comments include an attachment. PATCH validation rejected unchanged attachment metadata because it compared `JSON.stringify` output, which is sensitive to property order after PostgreSQL JSONB/Zod parsing. Replaced it with explicit value comparisons for attachment ID, name, MIME type, and size, preserving the forged-metadata rejection.
- Added backend coverage for editing a comment with metadata in PostgreSQL-style key order, rejecting altered size, and deleting the comment. Verification: all unit/integration tests pass (95 total), full build passes, and `git diff --check` passes.

## 2026-11-08 — Save pasted files as comments immediately in task details

- In an existing task's edit dialog, pasted clipboard files now immediately call `api.createComment` with the task ID, current comment draft text, and pasted files. Multiple quick pastes are serialized; success clears the matching text draft, invalidates task data, and shows the attachment toast. On failure the files remain in the composer draft and an error toast appears. Add task still stages pasted files because its task ID does not exist yet.
- Added component coverage for paste outside the dialog and browser E2E coverage confirming an attachment-only comment is persisted immediately. Full unit/integration tests (94) and frontend build pass; focused E2E passes; `git diff --check` passes.

## 2026-11-08 — Capture pasted attachments when task dialog lacks focus

- The task-details and Add task dialogs handled paste only within their own DOM subtree, so copied files were ignored when focus remained on the trigger or another outside element. Added a document-level capture listener while either dialog is open; it processes clipboard files once, prevents browser paste, updates the relevant draft list, and shows the immediate attachment toast. The listener is enabled only when attachments are enabled.
- Updated the task-details paste test to dispatch `paste` on `document.body`, outside the dialog. Verification: frontend tests pass (59 tests), frontend build passes, and `git diff --check` passes.

## 2026-11-08 — Show upload success toasts for attachments

- Replaced Sonner with React-Toastify after the notification remained invisible in the user's app. The bottom-right container is portaled to `document.body`. When files are selected or pasted into either task dialog, the UI immediately shows `Файл «имя» прикреплён` for five seconds, once per accepted file. This is a draft attachment confirmation, before submission to the backend.
- Verification: frontend tests pass (59 tests), all unit/integration tests passed (94 total before this follow-up), frontend build passes with the existing large-chunk advisory, and the focused attachment E2E passes including a visible-toast assertion. `git diff --check` passes.

## 2026-11-08 — Verify comment editing and deletion after migration

- Added edit and delete steps to the database-backed comment E2E scenario. This exercises the `task_comments` delete/reinsert path introduced with migration `0007`.
- Verification: focused E2E passes through creating two comments, editing one, and deleting the other. The test did not reproduce a failure in the current migrated database.

## 2026-11-08 — Capture clipboard files throughout both task dialogs

- Moved paste handling from the comment textareas to `onPasteCapture` on the Add task and task details dialog roots. Clipboard files are now attached regardless of which field is focused, and the browser's default text paste is prevented when file items are found.
- Verification: frontend tests pass (59 tests), including pasting while task title/description has focus; frontend build and `git diff --check` pass.

## 2026-11-08 — Handle pasted clipboard images in both task dialogs

- Clipboard paste now reads file items from `clipboardData.items` and falls back to `clipboardData.files`, covering browsers that expose copied images only as clipboard items. Wired this into the creation dialog's initial comment and the existing task comment composer; file picker selections also clear the native input after capture.
- Verification: frontend tests pass (59 tests), frontend build passes, and `git diff --check` passes.

## 2026-11-08 — Hide empty comment bodies and clear file picker state

- Render `.comment-markdown` only when the comment body contains non-whitespace text, so attachment-only comments have no empty gray bar. Reset the native file input immediately after reading its files; draft chips remain until submit, then disappear with the cleared draft state.
- Verification: frontend tests pass (57 tests), frontend build passes, and `git diff --check` passes.

## 2026-11-08 — Style the comment composer as a Bootstrap card

- Wrapped the Add comment input, attachment controls, and submit button in a Bootstrap `.card border rounded p-3 mt-3` container so the composer reads as a separate block.
- Verification: frontend tests pass (56 tests), including an assertion that the composer uses Bootstrap card/border/padding classes; `git diff --check` passes.

## 2026-11-08 — Left-align rendered comment text

- The broad `.task-comment > div` flex rule had applied right justification to `.comment-markdown` as well as the action buttons. Scoped the right-aligned flex layout to `.task-comment-actions` and explicitly left-aligned the Markdown block.
- Verification: the focused E2E scenario passes with a computed `text-align: left` assertion; `git diff --check` passes.

## 2026-11-08 — Allow attachment-only comments

- Enabled comment submission with empty text when at least one attachment is selected. Kept submit disabled for an empty draft with no files, and enforced the same rule in multipart comment uploads and task comment patches. Initial task comments can also consist of attachments alone.
- Verification: `pnpm test` passes (91 tests), `pnpm build` passes, and the focused attachment E2E passes.

## 2026-11-08 — Implement comment attachments and Markdown display

- Added the `MYTODO_ATTACHMENTS_DIR` gate, private local file writes with server-generated UUID names, limits (10 files, 10 MB each, 25 MB total), authenticated downloads and verified raster-image previews, attachment cleanup when comments/tasks/accounts are deleted, and task ownership checks. Migration `0007_task_comments` moves legacy JSONB comments into `task_comments`, which stores per-comment attachment metadata. Added attachment drafts, paste/file selection, initial task comments, image thumbnails, safe inline Markdown and text-file previews, and Compose storage volumes/configuration docs.
- Verification: `pnpm test` passes (91 tests), `pnpm build` passes, both production Compose configs validate, and `git diff --check` passes. Attachment upload/preview/download and existing multi-comment E2E scenarios pass after migration. A full E2E run before the migration/proxy fixes had 17 passed and 13 failed (mostly existing UI/data-state timeouts); it was not rerun in full after the focused fixes.

## 2026-11-08 — Specify attachment storage and feature gate

- Updated `docs/comments-and-attachments-plan.md`: attachments are enabled only when `MYTODO_ATTACHMENTS_DIR` is set; without it, attachment UI/API operations are unavailable while plain comments remain usable. Specified `/var/lib/mytodo/attachments` in the backend container, the `mytodo_attachments` persistent volume (or administrator-selected host bind mount), DB metadata containing relative generated keys, and backup/configuration requirements.
- Verification: documentation-only change; tests were not run.

## 2026-11-08 — Strengthen Dates filter regression coverage

- Reworked the frontend Dates filter test to create four tasks through the Add task UI against a stateful immutable mock API: overdue, today, upcoming, and undated. It asserts stored dates and exact visibility for All/Overdue/Today/Upcoming, plus that the subtabs disappear in Calendar mode.
- Verification: `pnpm test` passes (88 tests), `pnpm build` passes with the existing chunk-size advisory, and `git diff --check` passes. The focused E2E Dates test was attempted but the accumulated default E2E database left task loading unresolved and the test timed out; no E2E changes were retained.

## 2026-11-08 — Plan adding tasks from calendar days

- Used `aiignore/prompts/next/09.2026-11-08.improve-calendar.md` as the request source and created `docs/calendar-day-task-creation-plan.md` in Russian. The plan recommends opening the existing task creation form from a calendar cell with that local date preselected, with an explicit add button, while preserving task opening and drag-and-drop.
- Verification: documentation-only change; tests were not run.

## 2026-11-08 — Add date filters to the Dates list view

- Implemented `All`, `Overdue`, `Today`, and `Upcoming` filter tabs on `/dates` while List is selected. Filters compare task dates with the user's local calendar date; Calendar mode remains unchanged. Added an empty state for a filter with no matches and a responsive segmented-control style.
- Added frontend regression coverage for all four filters and confirmed the tabs are hidden in Calendar mode.
- Verification: focused `App.test.tsx` passed (55 tests); full `pnpm test` passed (88 total); `pnpm build` passed (Vite reports the existing large-chunk advisory); full `pnpm test:e2e` ran 28 tests with 18 passed and 10 unrelated existing timeouts/failures. Calendar E2E passed; `git diff --check` passes.

## 2026-11-08 — Document comparison with Todoist

- Added `docs/comparison-with-todoist.md` in Russian, comparing the implemented mytodo features with Todoist's current official feature set. Covered self-hosting, account model, hierarchy, dates, labels, views, collaboration, and data management; linked official Todoist documentation.
- Noted that README's priorities claim is stale relative to the current schema/API and flagged it for synchronization.
- Verification: checked repository schema/API and frontend routes; `git diff --check` passes. Tests were not run for this documentation-only change.

## 2026-11-08 — Verify user deletion removes persisted data

- Added an E2E regression scenario that creates a managed user, persists a session, hierarchical projects, a project section, nested and Inbox tasks with labels/comments, deletes the account through `/admin/users`, then queries the database to assert zero remaining rows in `users`, `sessions`, `projects`, `sections`, and `tasks`. It also verifies the deleted session is rejected and cleans up on failure.
- Verification: new E2E passes both in isolation and in the full run; `pnpm test` passes (87 tests). Full `pnpm test:e2e` reports 18 passed and 10 existing UI/E2E failures (including the pre-existing account-navigation test); `git diff --check` passes.

## 2026-11-08 — Fix production users CLI executable path

- Production user tasks and the README now invoke `./node_modules/.bin/tsx` relative to the API container's `/app/apps/backend` working directory. The prior `../../node_modules` path pointed to the root workspace, where `tsx` is not installed.
- Verification: confirmed the backend-local tsx executable exists in the workspace, dry-ran all primary production user commands, and `git diff --check` passes.

## 2026-11-08 — Point primary production tasks at .env and docker-compose.yml

- Changed `prod:docker` lifecycle and user-management commands to use `.env` with `docker-compose.yml`; updated descriptions and shared-PostgreSQL README instructions accordingly. `prod:docker:external-infra:*` remains on its existing `.env.production` configuration.
- Verification: dry-runs resolve the primary task commands and `git diff --check` passes. `.env` is not present in this workspace and must be created from `deploy.env.example` before use.

## 2026-11-08 — Simplify standalone production Task names

- Renamed the standalone stack tasks by removing `with-infra`: the stack now uses `prod:docker` plus `down`, `ps`, `logs`, and `users:*` variants. Shared-infrastructure task names are unchanged.
- Verification: renamed tasks appear in Task listing, dry-run successfully, and `git diff --check` passes.

## 2026-11-08 — Add production user-management Task commands

- Added production `users:list`, `users:create`, `users:update`, and `users:delete` tasks for both shared-infrastructure and self-contained Compose stacks.
- Verification: Task lists all eight tasks, dry-run invocations resolve for every operation, and `git diff --check` passes.

## 2026-11-08 — Remove MYTODO_DATABASE_URL configuration

- Replaced the URL setting with `MYTODO_DB_*` connection fields. Added a pure backend helper that safely builds a PostgreSQL URL, and wired server, Drizzle, CLI, Compose, Taskfile, deployment examples, and the local production env file to the fields.
- Verification: Compose configs validate for dev, test, shared-infra, and standalone stacks; Task migration dry-run resolves; no `MYTODO_DATABASE_URL` remains outside this historical memory; `pnpm build` and `git diff --check` pass. Unit/E2E tests were not run.

## 2026-11-08 — Consolidate database environment variables

- Removed the duplicate `MYTODO_POSTGRES_*` configuration group. Compose now maps the shared `MYTODO_DB_USER`, `MYTODO_DB_PASSWORD`, and `MYTODO_DB_NAME` variables to the PostgreSQL container's required `POSTGRES_*` names; Taskfile uses the same variables.
- Kept `MYTODO_DATABASE_URL` for application connections, since its host and URL encoding differ by runtime context.
- Verification: dev, test, and standalone Compose configs validate; no `MYTODO_POSTGRES_*` references remain; `git diff --check` passes.

## 2026-11-08 — Prefix project configuration variables with MYTODO_

- Renamed variables in `.env.example`, the local `.env.production`, and deployment examples to `MYTODO_*`; updated Compose interpolation, Caddy domain substitution, Taskfile database variables, and README examples accordingly. Standard container-level variables such as `DATABASE_URL`, `PORT`, and `POSTGRES_USER` remain mapped inside services.
- Verification: dev, test, shared-infra, and standalone Compose configs validate; Task database migration dry-run resolves `MYTODO_DATABASE_URL`; no unprefixed project config keys remain in env files; `git diff --check` passes.

## 2026-11-08 — Adjust mytodo logo mark typography

- Set `.brand-mark` font size to 13px.
- Verification: confirmed only the brand mark style changed and `git diff --check` passes.

## 2026-11-08 — Rename user-facing application to mytodo

- Updated the browser title, sidebar and sign-in branding, README title, and exported Markdown/JSON filenames to `mytodo`.
- Verification: searched the affected frontend/docs for old branding and ran `git diff --check`; tests were not run.

## 2026-11-08 — Remove machine-specific infra paths from docs

- Replaced local infrastructure paths in README, deployment env comments, and the production Compose comment with environment-neutral guidance.
- Verification: repository search finds no remaining `~/r/sandbox/infra` references and `git diff --check` passes.

## 2026-11-08 — Make README English-only

- Removed the duplicated Russian README section and added its user account setup and CLI instructions to the English development documentation.
- Verification: no Cyrillic characters remain in README and `git diff --check` passes.

## 2026-11-08 — Add Task commands for shared-infrastructure production stack

- Added `prod:docker:external-infra` with `down`, `ps`, and `logs` variants targeting `docker-compose.yml` and `.env.production`.
- Verification: Task lists the new commands, each dry-run resolves, and `git diff --check` passes.

## 2026-11-08 — Clarify standalone production Task names

- Renamed the production Docker tasks to `prod:docker:with-infra` and its `down`, `ps`, and `logs` variants.
- Verification: all renamed tasks appear in `task --list-all`, each dry-run resolves, and `git diff --check` passes.

## 2026-11-08 — Add Task commands for the standalone production stack

- Added `prod:docker`, `prod:docker:down`, `prod:docker:ps`, and `prod:docker:logs`, all targeting `.env.production` and `docker-compose.with-infra.yml`. The down command preserves named volumes.
- Verification: Task lists all four commands, dry-runs each command successfully, and `git diff --check` passes.

## 2026-11-08 — Add self-contained production Compose stack

- Added `docker-compose.with-infra.yml` with the production API/web images, private PostgreSQL, and Caddy HTTPS proxy, with persistent database and certificate volumes.
- Added a configurable Caddy site and preserved the forwarded HTTPS protocol through Nginx so production cookies remain secure. Documented setup and startup in README.
- Verification: Docker Compose config validation and `git diff --check` pass; application test suites were not run (deployment configuration only).

## 2026-11-01 — Add and launch a production Docker Compose stack

- Added a multi-stage root Dockerfile, production Nginx frontend/API proxy, and production `docker-compose.yml` joining the external `infra` network; documented deployment and bootstrap steps.
- The requested infra PostgreSQL was not running and its `.env` was absent. Initialized it with a protected generated password on loopback port 5433 (5432 is occupied by the dev database), created the dedicated `todoist_clone` database, and wrote local ignored production credentials.
- Built and launched `todoist-api` and `todoist-web`; migrations completed and both containers report healthy. Web serves on `127.0.0.1:18082`; a public HTTPS route through Caddy remains pending a production hostname because the infra reverse proxy is not currently configured or running.
- Verification: Docker Compose config validation, production image builds, container health checks, frontend HTTP 200, API `/auth/status`, and `git diff --check` pass.

## 2026-11-01 — Make Ctrl+K layout independent and add advanced Markdown exports

- Search now recognizes the physical `KeyK` code with Ctrl/Cmd, including non-English keyboard layouts.
- Added a domain renderer for advanced Markdown that includes scope descriptions, task descriptions, due dates, labels, and timestamped comments. Added preview/copy for Inbox and project scopes and download/preview/copy on `/export`.
- Added unit, frontend, and E2E coverage for Russian-layout Ctrl+K and advanced Markdown content/actions.
- Verification: `pnpm test` passes (87 tests), `pnpm build` passes, full Playwright E2E passes (27 tests) on a fresh isolated database, and `git diff --check` passes.

## 2026-11-01 — Move user CRUD to the admin page and add self-service account updates

- Moved administrator user creation, editing, role changes, and deletion from `/settings` to `/admin/users`; the route and sidebar link require an administrator session.
- Added an authenticated `PATCH /auth/account` endpoint and a Settings form for changing the current user's username and password. Usernames are normalized to lowercase and uniqueness conflicts return HTTP 409; changing a password revokes that user's sessions.
- Added backend and frontend regression coverage plus E2E coverage for the separate admin page and account section in Settings.
- Verification: `pnpm test` passes (86 tests), `pnpm build` and `git diff --check` pass, and full Playwright E2E passes (27 tests) on a fresh isolated database.

## 2026-11-01 — Add task selection button styling and shortcuts

- Styled Select tasks with Bootstrap's outlined secondary button and a list/check icon. The S physical key toggles selection regardless of keyboard layout, ignores text inputs and modifier shortcuts, and Escape exits selection mode.
- Added UI and E2E coverage for the S key in Russian layout, Escape, Bootstrap styling, and the button icon.
- Verification: `pnpm test` passes (84 tests), `pnpm build`, full Playwright E2E (26 tests on a fresh isolated database), and `git diff --check` pass.

## 2026-11-01 — Keep task titles aligned in selection mode

- Fixed horizontal movement of task titles when entering selection mode: hidden task actions and completion checkboxes retain their grid space, and the selection marker is positioned outside the content flow.
- Added a Playwright assertion that compares the title's horizontal coordinate before and after enabling selection mode.
- Verification: `pnpm test` passes (83 tests), `pnpm build`, full Playwright E2E (25 tests), and `git diff --check` pass.

## 2026-11-01 — Improve task selection interactions

- In selection mode, clicking any task row, including a child task, now toggles its top-level parent and the full subtree. The whole row is the target. Completion checkboxes and per-task action buttons are hidden while selecting.
- Added frontend coverage for child-to-root selection and updated E2E coverage to verify action controls are hidden during group drag.
- Verification: `pnpm test` passes (83 tests), `pnpm build`, full Playwright E2E (25 tests on an isolated database), and `git diff --check` pass.

## 2026-11-01 — Add task selection mode and bulk actions

- Added a selection mode for Inbox and project task lists. Only top-level tasks can be toggled; selecting one marks its entire nested tree. Selection clears when leaving task views or changing scope.
- Added top and bottom action bars, confirmation based bulk deletion, a destination picker for Inbox/projects/sections, and drag-and-drop of the selected group to Inbox, a project, a section, or another task's scope. Group moves call the existing move API for selected roots, preserving the parent-child links.
- Verification: `pnpm test` passes (83 tests), `pnpm build` and `git diff --check` pass. Full Playwright suite passes (25 tests) on a fresh isolated database. Runs against the shared, accumulated E2E database had 8 unrelated timeouts; rerunning fresh was green.

## 2026-11-01 — Add right-click task actions

- Added a right-click context menu to task rows in Inbox and project views with Open, Quick edit, Add subtask, and Delete. The menu uses the existing task handlers, closes on outside click or Escape, and stays within the viewport.
- Added frontend coverage for the menu and Quick edit, plus a Playwright scenario confirming it appears in Inbox and projects and opens task details.
- Verification: `pnpm test` passes (80 tests), `pnpm build` and `git diff --check` pass. Full E2E ran 24 tests: the new context-menu test passed; 16 passed overall and 8 unrelated existing scenarios failed or timed out (date picker interaction, project/section flows, and mobile/sidebar checks).

## 2026-10-30 — Allow passwords of any nonzero length

- Removed minimum and maximum password-length checks from login, user creation, password updates, and account forms. Password inputs remain required for account creation; empty API/CLI password values are rejected, while omitted update passwords leave the existing password unchanged.
- Updated Russian CLI examples and frontend validation copy. Added backend coverage for one-character passwords on account creation, login, and password reset, plus rejection of empty passwords; updated the Settings UI test to create a user with a one-character password.
- Verification: `pnpm test` passes (79 tests), `pnpm build` passes, full Playwright E2E passes (23 tests) on a fresh database, and `git diff --check` passes.

## 2026-10-30 — Fix Supertest startup and run the complete suite

- Backend tests now start their HTTP servers explicitly, wait for the `listening` event, and close servers after each test. Data-route tests log in as a test administrator; the no-password regression test still exercises unauthenticated access directly.
- Playwright webServer now checks the public auth-status route and configures a known administrator password in the isolated E2E database. Added a shared authenticated-page fixture and updated API-backed E2E setup plus stale mobile/date assertions.
- Verification: `pnpm test` passes (78 tests), `pnpm build` passes, `git diff --check` passes, and full Playwright E2E passes (23 tests) against a fresh database.

## 2026-10-27 — Require administrator password before API access

- Removed anonymous API access when the database has no password-protected users. Protected requests now return HTTP 503 until the administrator password is configured; `/auth/status` reports password mode so the UI shows sign-in.
- Removed the unauthenticated bootstrap exception for database tools; tools now require an authenticated administrator session.
- Added a backend regression test for the empty-password state. Backend build and `git diff --check` pass. Backend tests remain blocked by the existing Supertest null server address issue (all 18 tests fail before reaching their assertions).

## 2026-10-26 — Production readiness assessment

- Reviewed the current repository, auth/session flow, API middleware, database tools, example configuration, and Docker setup for production readiness; no application code changed.
- Conclusion: suitable for local/personal MVP use after setup, but not ready to expose directly to the internet. Key blockers include anonymous access until a password is configured, no login throttling, destructive SQL/database tools enabled in every mode except exact `production`, development-only deployment assets, and no documented production migration/backup/restore/monitoring workflow.
- Verification: static review only; tests were not run for this assessment. Existing user change `D .aws` was left untouched.

## 2026-10-25 — Clarify task due date display

- Task rows, task details, and archived task entries now show a calendar icon with the due date; today is labeled `today`, upcoming dates are black, and past dates are red.
- Added frontend assertions for overdue, today, upcoming dates, and the calendar icon.
- Verification: frontend tests pass (48), `pnpm build` and `git diff --check` pass.

## 2026-10-25 — Show title edit affordance in task details

- Added a visible edit icon beside the task title in the task details dialog; clicking the title still enters edit mode.
- Added a frontend assertion for the icon.
- Verification: frontend tests pass (48), `pnpm build` and `git diff --check` pass.

## 2026-10-25 — Group task edit shortcuts in one row

- Moved the mobile Subtasks shortcut into the task details shortcut row beside Labels and Date, with Comments following. All shortcuts use leading plus icons and wrap only when the row runs out of space.
- Updated UI coverage for ordering, icons, and the subtask reveal interaction.
- Verification: frontend tests pass (48), `pnpm build` and `git diff --check` pass.

## 2026-10-25 — Keep Add task shortcuts on one row when they fit

- Set the Description, Date, and Labels shortcut buttons to intrinsic width without flex growth. The row still wraps when the dialog is too narrow.
- Verification: frontend tests pass (48), `pnpm build` and `git diff --check` pass.

## 2026-10-25 — Simplify optional task field buttons

- In Add task and task edit dialogs, optional field shortcuts now use concise labels (Description, Date, Labels, Comments) with a leading plus icon.
- Updated mobile shortcut spacing and frontend assertions.
- Verification: frontend tests pass (48), `pnpm build` and `git diff --check` pass.

## 2026-10-25 — Restrict the Tools page to administrators

- The sidebar now shows the Tools link only when auth status identifies the current user as an administrator. Direct `/tools` navigation redirects non-administrators to the task page.
- Added frontend coverage for hiding the link from a regular user.
- Verification: frontend tests pass (48), backend tests pass (17), `pnpm build` and `git diff --check` pass. The first parallel `pnpm test` invocation exited in the backend with no test output; the standalone backend run passed.

## 2026-10-25 — Add user management commands to Taskfile

- Added `dev:docker:users:list`, `create`, `update`, and `delete` Taskfile commands. They invoke the backend CLI with the configured `DATABASE_URL`; create/update options are passed through Task variables.
- Updated README account-management examples to use the `dev:docker` task prefix.
- Verification: `task --list-all`, dry-runs of all four tasks, and `git diff --check` pass.

## 2026-10-25 — Add Docker PostgreSQL dump and restore tasks

- Added `task db:dump` to save a timestamped custom-format PostgreSQL archive from the dev Compose database; `DB_DUMP_FILE` can override the output path.
- Added `task db:restore` to restore a specified archive (or the default dump path) with `pg_restore`; it replaces existing database objects.
- Verification: Taskfile parsing/listing checked; application tests not run because this is Taskfile-only infrastructure work.

## 2026-10-25 — Add multi-user accounts and isolated task data

- Added a `users` table and migration that transfers the old settings-based account, preferences, sessions, and all existing tasks/projects/sections to that user; the obsolete singleton settings table is removed after migration.
- Each API request resolves its session to a user and scopes task, project, and section repository operations to that user. User preferences and Inbox descriptions are also per-user.
- Added administrator-only user creation, updates, password resets, role changes, and deletion in Settings and the `users` backend CLI. Prevents removing/demoting the last administrator. For an installation with no old password, set the migrated admin password with the CLI before managing users.
- Added backend isolation/auth/role tests, Settings UI tests, and updated E2E expectations for date dialog labels. Playwright defaults to one worker because its tests share a database and honors `DATABASE_URL` in the Docker test environment.
- Verification: `pnpm test` passes (76 unit/integration tests), `pnpm build` passes, full E2E passes (23 tests), and `git diff --check` passes. Restored the dev Docker stack after the Docker test task removed its containers/volumes during cleanup.

## 2026-09-24 — Prompt 011 (projects edit/delete, drag reorder, indent/outdent)

Baseline before this session:
- Drag & drop is native HTML5 (no @dnd-kit, no Tailwind — plain CSS), drop onto a task makes it a subtask; no sibling reordering (`beforeId`/`afterId` always null).
- Projects: model + GET/POST API + sidebar create UI only; no edit/delete.
- Sections: fully working for Inbox only (create/edit/delete); schema supports projectId but UI never uses it.
- Task editing: inline form with title + "Move to" placement select.
- No keyboard shortcuts; no MEMORY.md.
- E2E drag helpers synthesize DragEvents in page (`e2e/tasks.spec.ts`); jsdom tests synthesize them via fireEvent.

Decisions for this session:
- Drop zones on a task row use thirds: top 35% = insert before, middle = make subtask, bottom 35% = insert after; a red insertion line indicates before/after (Todoist-style).
- Indent/outdent is keyboard-driven like Todoist: Ctrl/Cmd+ArrowRight makes the task a subtask of the sibling above; Ctrl/Cmd+ArrowLeft outdents it below its parent. Business logic lives in `/packages/domain` as pure functions (`computeDropPlacement`, `computeIndentPlacement`, `computeOutdentPlacement`).
- Deleting a project cascades: its sections and all their tasks (with descendants) are deleted.
- `moveTask` API contract now always sends `beforeId`/`afterId`.

Completed in this session:
- Finished prompt 011 end-to-end: project edit/delete UI, task edit UI polish, Todoist-like drag zones, sibling reorder, keyboard indent/outdent, and moved "Export all ZIP" into the left sidebar.
- Wired frontend API to the backend project/task contracts (`updateProject`, `deleteProject`, `updateTask`, `beforeId`/`afterId` moves).
- Added/updated domain, backend, frontend unit tests and Playwright E2E coverage for project CRUD, reorder, indent/outdent, exports, and existing task/section flows.
- Set Playwright `outputDir` to `/tmp/todoist-clone-playwright-results` by default because the repo-local `test-results` directory is owned by `nobody`; `PLAYWRIGHT_OUTPUT_DIR` can override it.
- Current verification: `pnpm test` passes and `pnpm test:e2e` passes.

## 2026-09-24 — Prompt 012 (Bootstrap UI, tools sidebar, drag polish)

What changed:
- Treated `aiignore/prompts/12.md` as prompt 012 because `aiignore/prompts/012.md` is absent.
- Added Bootstrap styling support and moved the app CSS into `apps/frontend/src/App.module.css`; Bootstrap CSS is vendored under `apps/frontend/src/vendor/` so Vite/Playwright can resolve it consistently in this workspace.
- Updated the main UI shell with a Bootstrap-friendly card layout, a shared left sidebar style, a `/tools` link when tools are enabled, and the same sidebar layout on `/tools`.
- Improved drag feedback: project/section/inbox drop targets highlight while hovering, task drag insertion lines include a red marker circle, task rows update insertion state on dragover, and dragging a nested task left can outdent it.
- Avoided Bootstrap `.modal` naming collisions by renaming the markdown preview classes.

Verification:
- `pnpm test` passes.
- `pnpm test:e2e` passes when run with elevated local binding permissions; plain sandboxed runs can fail because Playwright's dev servers need to listen on `127.0.0.1:3000` and `127.0.0.1:5173`.

## 2026-09-24 — Prompt quality review

- Reviewed prompts in `aiignore/prompts/` for clarity, sequencing, testability, and alignment with `AGENTS.md`.
- No product/code behavior was changed.
- Current verification: tests not run because this was an analysis-only review.

## 2026-09-24 — Functional style and library review

- Reviewed current domain, frontend, backend, and dependency setup for functional-programming fit and possible library additions.
- Conclusion: current FP style is mostly pragmatic TypeScript; biggest simplification opportunities are module boundaries and feature libraries rather than adding a heavy FP library.
- No product/code behavior was changed.
- Current verification: tests not run because this was an analysis-only review.

## 2026-09-24 — Immutable data structures library discussion

- Reviewed lightweight options for immutable/persistent data handling in TypeScript.
- Conclusion: prefer no full persistent-collection library for now; consider `immer` only for deeply nested UI/cache updates, or `remeda` for collection helper ergonomics.
- No product/code behavior was changed.
- Current verification: tests not run because this was an analysis-only discussion.

## 2026-09-24 — Freeze helper discussion

- Reviewed `freezeTask`, `freezeProject`, and `freezeSection` helpers in backend repositories.
- Conclusion: these wrappers are technically valid but not worth the ceremony; inline `Object.freeze({...})`, typed factory helpers with meaningful names, or relying on TypeScript `Readonly` at boundaries would be clearer.
- No product/code behavior was changed.
- Current verification: tests not run because this was an analysis-only discussion.

## 2026-09-24 — Prompt 013 (libraries, freeze cleanup, dev-docker reload)

What changed:
- Updated `AGENTS.md` with the immutability guidance from prompt 013: prefer TypeScript `Readonly` types, use runtime `Object.freeze()` only at useful boundaries, and avoid ceremonial freeze wrappers.
- Removed `freezeTask`/`freezeProject`/`freezeSection` wrappers from backend repositories and inlined freezing at creation/mapping boundaries.
- Added requested frontend libraries: `@dnd-kit/*`, `jszip`, `clsx`, `lucide-react`, and `@floating-ui/react`.
- Used those libraries in the app: DnD context/sensors wrap the task app, ZIP export uses `jszip`, class composition uses `clsx`, buttons use lucide icons, and the markdown preview modal uses Floating UI overlay/focus management.
- Kept Bootstrap loading reliable through the vendored CSS import added in prompt 012.
- Added Docker dev polling env vars (`CHOKIDAR_USEPOLLING`, `WATCHPACK_POLLING`, `VITE_USE_POLLING`) so `task dev:docker` sees bind-mounted source changes more reliably without manual restarts.

Verification:
- `pnpm test` passes.
- `pnpm --filter @todoist-clone/frontend build` passes.
- `pnpm test:e2e` passes against the refreshed dev-docker stack. The first E2E attempt reused an old container dev server with stale dependencies; after `docker compose --env-file .env.example -f docker-compose.dev.yml down` and `up -d --wait`, the suite passed.

## 2026-09-25 — React/CSS/Bootstrap review prompt

- Added `aiignore/prompts/tasks/review-react-css-bootstrap.md` with a focused review prompt for React component size, moderate modularity, CSS organization, and Bootstrap-first styling.
- No product code was changed.
- Current verification: tests not run because this was a documentation/prompt-only change.

## 2026-09-25 — Code quality, modularity, functionality, and AGENTS.md analysis

- Added `aiignore/prompts/tasks/code-quality-analysis.md` with a review of code quality, modularity, functionality quality, test coverage, and `AGENTS.md`.
- Rated the project at 74% overall and identified the main risks: oversized `App.tsx`, fragile drag-and-drop, weak backend move validation, duplicated repository logic, and stale `AGENTS.md` stack notes.
- No product code was changed.
- Current verification: tests not run because this was an analysis/documentation-only change.

## 2026-10-22 — Fix dev Docker page styling

- Found that `App.module.css` contained global stylesheet rules but was imported as a CSS Module without using its generated class exports; Vite omitted the app rules from the generated stylesheet.
- Renamed it to `App.css` and imported it as ordinary global CSS from `App.tsx`.
- Verification: frontend production build passes and output CSS includes `.shell`, `.app-layout`, and `.task-row`. Existing Docker dev stack is running and should hot reload the fix; no unit/E2E tests run for this CSS import correction.

## 2026-10-22 — Add full Markdown export and preview

- Added sidebar actions below “Export all ZIP”: “Export all markdown” downloads a combined `todoist-clone.md`, and “Preview all markdown” opens the shared preview dialog with every Inbox, section, and project document.
- Added a frontend test for the all-tasks preview flow.
- Verification: frontend tests pass (22 tests) and frontend production build passes.

## 2026-10-22 — Focus task title on edit

- Added autofocus to the task edit Title input so it receives focus when the user opens Edit.
- Extended the task edit UI test to assert focus.
- Verification: frontend tests pass (22 tests) and frontend production build passes.

## 2026-10-22 — Focus subtask title on add

- Added autofocus to the new subtask input when the user opens the Add subtask form.
- Extended the subtask creation UI test to assert focus.
- Verification: frontend tests pass (22 tests) and frontend production build passes.

## 2026-10-22 — Close Markdown preview with Escape

- Added Escape key handling to the Markdown preview dialog so it closes from anywhere inside the focused dialog.
- Extended the preview UI test to assert the dialog closes on Escape.
- Verification: frontend tests pass (22 tests) and frontend production build passes.

## 2026-10-22 — Correct the Todoist Clone spelling

- Corrected the project name across user-facing app labels, page title, README, package/workspace names, imports, Docker commands, Playwright settings, export filenames, and existing memory/prompts.
- Updated pnpm workspace links and lockfile; `pnpm test` passes (40 unit tests) and `pnpm build` passes.
- E2E attempt was blocked because the already running Docker dev backend occupies port 3000; its `/tasks` health URL reset the connection, and Playwright could not start a second backend on that port. No Docker services were stopped.

## 2026-10-22 — Restyle the app to match the Todoist reference

- Reworked the app shell and CSS toward the provided Todoist screenshot: narrow warm sidebar, active navigation treatment, centered white task column, compact section/task rows, circular completion controls, and quieter hover actions.
- Retained the existing project, export, editing, and task behavior.
- Verification: all unit tests pass (40 tests) and `pnpm build` passes. No E2E rerun; the existing Docker dev process had occupied port 3000 in the previous E2E attempt.

## 2026-10-22 — Refine Tools UI, type size, workspace width, and priorities

- Applied the shared Todoist-inspired shell to Tools and restyled its controls, query editor, and result pane.
- Set the app base text to Bootstrap's 16px default and raised small UI labels/buttons to that scale.
- Widened the centered workspace to 820px on desktop, with fluid width on mobile.
- Removed task priority labels from the task list UI while keeping priority data and Markdown export behavior intact; added a UI assertion.
- Verification: all unit tests pass (40 tests) and `pnpm build` passes.

## 2026-10-22 — Polish Markdown preview and Tools buttons

- Restyled all sidebar export actions as Todoist-like navigation rows and added matching file/preview icons.
- Replaced green Tools buttons with neutral Todoist-style controls, red hover states for destructive actions, and a red primary Run query button.
- Verification: frontend tests pass (22 tests) and frontend production build passes.

## 2026-10-22 — Align Markdown export buttons with ZIP export

- Prevented the longer Markdown export labels from wrapping, and set all sidebar export rows to the same compact height and text size as the ZIP action.
- Verification: frontend tests pass (22 tests) and frontend production build passes.

## 2026-10-22 — Make Markdown export icons visible

- Switched the Markdown download symbol to a clearer download icon and fixed sidebar export SVG dimensions, flex shrinking, and Todoist-red contrast.
- Verification: frontend tests pass (22 tests) and frontend production build passes.

## 2026-10-22 — Widen navigation sidebar and compact project actions

- Doubled the desktop Navigation sidebar width from 190px to 380px.
- Removed visible Edit/Delete labels from project controls while retaining their aria-labels and icons; set fixed icon button sizing.
- Made project names truncate with an ellipsis when the available column is too narrow.
- Verification: frontend tests pass (22 tests) and frontend production build passes.

## 2026-10-22 — Add deletion preferences and cookie sessions

- Added persistent application settings for delete confirmations (enabled by default) and anonymous/password access, plus a settings page to edit them.
- Added scrypt password hashing, database-backed 30-day sessions, HttpOnly SameSite cookies, login/logout, and access middleware for protected API routes.
- Added auth/settings Vite proxies while preserving SPA navigation to `/settings`; protected auth tables from the development tools' clear/drop helpers.
- Added backend/frontend coverage and a browser check for the default settings.
- Verification: `pnpm test` (46 tests) and `pnpm build` pass. E2E: settings, task creation, and tools pass; the pre-existing project edit workflow test still fails because its Edit project button is absent from the rendered page after project creation.
- Current state: database migration applied locally; access remains anonymous until changed in Settings.

## 2026-10-22 — Add full Markdown copy, task details, table browsing, project menus, and archives

- Added a Copy all markdown action and a Tools table inspector with 10, 100, or all rows, newest-first where a timestamp/ID column is available.
- Extended tasks with persisted description, due date, labels, and comments; task titles open a detail dialog with editing, comment entry, and subtask add/delete. Existing inline edit controls remain.
- Added project duplicate/archive operations, moved project edit/delete into a menu, and added an Archived projects page with restore/delete.
- Added an idempotent schema migration and isolated E2E servers/database on ports 3100/5174 so E2E no longer uses the user's password-protected app database.
- Applied migration 0002 to the local app database without changing its access mode.
- Verification: `pnpm test` passes (48 unit tests), `pnpm build` passes, and `pnpm test:e2e` passes (6 browser tests).

## 2026-10-22 — Improve archive browsing, comments, add forms, and Tools UI

- Added a task tree viewer to each archived project entry, including descriptions, dates, labels, and nested subtasks.
- Added comment editing and deletion controls to task details; deletion follows the configured confirmation preference.
- Wrapped project and section creation forms in Bootstrap cards with padding and a light background for visible grouping.
- Reorganized Tools into card sections for table browsing, maintenance actions, SQL editing, and results; improved button hierarchy, status, and responsive layout.
- Verification: unit tests (48), build, and all 6 E2E tests pass. E2E covers archived task viewing/restoration and comment edit/delete.

## 2026-10-22 — Visually group task creation

- Wrapped the task creation form in a Bootstrap light card with border and padding, matching the project and section creation blocks.
- Applied to Inbox and project views through the shared task form.

## 2026-10-22 — Fix duplicate project menu and refresh cloned tasks

- Converted project menus to controlled open state and close them before dispatching menu actions.
- After a project is duplicated, invalidate/refetch projects, sections, and tasks so the copied tree appears immediately without a page reload.
- Extended Playwright coverage to create a project with a task and nested subtask, duplicate it, assert the menu closes, open the copy, and verify both tasks are immediately visible.
- Verification: all unit tests, build, and all 6 Playwright scenarios pass.

## 2026-10-22 — Add Dates and Labels views and polish Tools/task details

- Added `/dates` and `/labels` task views that filter the full nested task tree while retaining the shared task controls and task detail dialog.
- Displayed labels as clickable chips on task rows; clicking one opens the cross-project label filter. Added a Bootstrap chip based label editor with existing-label suggestions in task details.
- Expanded the Tools sidebar with the same navigation links, active projects, project creation, and Markdown/ZIP actions as the home sidebar; improved Tools spacing and task detail dialog buttons.
- Added frontend and Playwright coverage for date/label views and label navigation. Verification: `pnpm test`, `pnpm build`, and `pnpm test:e2e` pass (6 browser tests).

## 2026-10-22 — Add Todoist-style task search

- Added Search to the task and Tools sidebars, with a centered command palette that opens via click or Ctrl+K and closes with Escape.
- Search matches task titles, descriptions, and labels; task results open task details and label results open the cross-project Labels filter. Added navigation shortcuts when the query is empty.
- Added frontend and browser coverage for description search, label search results, and keyboard opening.

## 2026-10-22 — Fix Dates/Labels navigation, search layering, and list order

- Selecting Inbox or a project from Dates/Labels now switches back to the task view and updates the URL; task rows display any set due date.
- Portaled the search palette to `document.body` with a high stacking order so it overlays task rows/sidebar contexts.
- Project/section rename and archive cache updates now replace items in place, preserving lexical list order instead of moving updated entries to the end.
- Added Playwright coverage for cross-view navigation, search overlay layering, and project/section order before and after reload. Verification: `pnpm test`, `pnpm build`, and all 7 E2E tests pass.

## 2026-10-22 — Make task details autosave and show task location

- Removed the task-wide Save action. Title and description save on blur, date saves on change, and label add/remove saves immediately; the dialog shows save status.
- Added Inbox/project breadcrumbs, a parent task link for subtasks, and a Project or Inbox selector that moves the task immediately.
- Restyled the dialog fields and location trail to fit the app's Todoist-like UI. Added unit and Playwright coverage for autosave, parent/project navigation, and task relocation.
- Verification: `pnpm test` (30 frontend tests plus domain/backend suites), `pnpm build`, and all 7 Playwright tests pass.

## 2026-10-22 — Make task details edit on demand

- Reworked Task details into a wide two-column layout inspired by Todoist, with task content on the left and project/date/labels metadata on the right.
- Title and description now render as text until clicked; inline editors have Save/Cancel, Enter saves, and Escape cancels. Saves update the task query cache immediately.
- Dates render as text with Add date/Remove date actions; clicking the displayed date opens a date editor dialog. Label entry adds the label on Enter.
- Updated component and Playwright coverage for the new interactions. Verification: `pnpm test`, `pnpm build`, and all 7 Playwright E2E tests pass.

## 2026-10-22 — Fix navigation shortcuts and add date/calendar workflow

- Task details now reliably closes with Escape; task, project, and section inline editors cancel with Escape and save on Enter.
- Fixed route state when navigating from Dates/Labels back to Inbox or a project. Added calendar/list modes to Dates, navigation icons, and removed Markdown actions from Dates/Labels.
- Search now includes project and section matches. Settings has the full navigation sidebar.
- Added a top-of-sidebar Add task dialog with project, optional date/description/labels, plus Q and Russian-layout Й shortcuts.
- Added Playwright coverage for these workflows, including Escape/Enter behavior, project/section search, Dates navigation, calendar mode, settings navigation, and quick-add shortcuts. Verification: `pnpm test`, `pnpm build`, and full 8-test Playwright suite passed.

## 2026-10-22 — Refine task details header and date/project controls

- Changed brand marks to Todoist red; removed the separate task-location breadcrumb row and moved project/section/parent/task path into the modal header.
- Project location is now always a dropdown and saves immediately on selection. Date controls open the date picker directly, and native `showPicker()` is requested when the editor opens.
- Enter adds a subtask from its title field. Dates/Labels no longer mark Inbox active, and project/section edit inputs autofocus.
- Added/updated Playwright assertions for active navigation, modal header, project dropdown, subtask Enter, and project/section focus. Verification: `pnpm test`, `pnpm build`, and all 8 Playwright E2E tests pass.

## 2026-10-22 — Project/section create controls, date picker, and project sorting

- Replaced always-visible project/section forms with red add buttons that reveal focused Title editors; Escape cancels and Enter submits. Creating a project now selects it. Project navigation now keeps the URL in sync.
- Added persisted project drag sorting using lexical ordering and a `PATCH /projects/:id/order` route. Dates use a Todoist-style picker with quick choices and a month grid; Escape closes the picker while remaining in Task details.
- Task detail title/description Escape now exits only the active editor. Dates and Labels preserve all descendants under a matching task. Added frontend/backend unit tests and Playwright coverage for editor keys, create controls, and project sorting across reloads.
- Verification: `pnpm test`, `pnpm build`, and `NO_PROXY=127.0.0.1,localhost E2E_BACKEND_PORT=3105 E2E_FRONTEND_PORT=5179 pnpm test:e2e` all pass (8 E2E tests).

## 2026-10-22 — Restore the native task date picker

- Replaced the custom quick-choice calendar with the previous native `input[type=date]` dialog and `showPicker()` behavior for adding and changing task dates. Kept Save/Cancel and the Escape handling around Task details.
- Updated the date picker UI and Playwright assertions. `pnpm test` and `pnpm build` pass; focused task-details Playwright test passes.

## 2026-10-22 — Task date shortcuts and button styling

- Task detail dates now include the year. Added Today, Tomorrow, This weekend, and Next week actions to the native date dialog; choosing one saves and closes the dialog.
- Restyled the Subtasks area as a Bootstrap card and made Save/Add actions and the sidebar Add task button Todoist red.
- Verification: `pnpm test`, `pnpm build`, and the focused task-details Playwright test pass.

## 2026-10-22 — Auto-growing text fields and project sections

- Replaced task and subtask title editors plus task description/comment editors with controlled, auto-growing textareas. Enter still submits single-line title fields; Shift+Enter inserts a newline.
- Added project-scoped section creation, editing, deletion, task drop zones, and placement options; Markdown preview now includes project sections.
- Project drag source and target visuals now match task drag/drop opacity and highlight styles.
- Added Playwright checks for textarea growth and project section workflows. Verification: `pnpm test`, `pnpm build`, and all 8 Playwright tests pass.

## 2026-10-22 — Bulk task deletion, section Markdown, and scoped task creation

- Added confirmation protected “Delete all tasks” to Inbox and project views; deletes each top-level task with its descendants across the whole scope, including sections.
- Rebuilt Markdown documents around one `#` title and `##` headings for section/scope content. ZIP notes now include their sections, and the single-file export is one unified document.
- Added Add task controls to Inbox, project roots, and each section. The dialog defaults to that scope and its location dropdown now includes Inbox, projects, and sections.
- Added domain and Playwright coverage for heading levels, scoped task placement, and bulk deletion. Verification: `pnpm test`, `pnpm build`, and all 9 Playwright tests pass.

## 2026-10-22 — Task actions and embedded date picker

- Task row action buttons now remain visible without hover.
- Added a shared embedded calendar panel to the Change date and Add task dialogs. Quick dates update the selected value without closing the dialog; Save date / Set date applies it. Escape cancels the date picker while keeping the parent task dialog open.
- Added Playwright coverage for visible task actions, embedded date selection, quick-date persistence, and Add task date selection. Verification: `pnpm test`, `pnpm build`, and all 9 Playwright tests pass.

## 2026-10-22 — Remove priorities and add section/calendar drag and drop

- Removed task priority from shared domain types, API validation and payloads, repositories, database schema, Tools seeding, and Markdown output. Added a migration to drop the persisted column and included it in Tools migrations.
- Added persisted lexical reordering for sections, matching project ordering. Project and section drag targets now show a red insertion line and circle.
- Tasks in Dates calendar can now be dragged onto another day; the task date is saved and the calendar refreshes.
- Added backend order tests and Playwright coverage for section reordering and moving a dated task to another calendar day. Verification: `pnpm test`, `pnpm build`, and all 9 E2E tests pass.

## 2026-10-22 — Scope descriptions, date highlights, and menu dismissal

- Added editable and deletable descriptions for Inbox and projects, including backend persistence and a database migration. Add section controls now render last in Inbox and project boards.
- Date picker marks today and its selected date with distinct red styling. Project menus close on Escape and outside clicks.
- Dragging projects clears all active drop and dragging states so no project remains highlighted after drop.
- Added unit, backend, and Playwright coverage for descriptions, menu dismissal, date highlights, and project drag cleanup. Verification: `pnpm test`, `pnpm build`, and all 10 Playwright tests pass.
- Follow-up: corrected CSS specificity so the Task details dialog's shared button rules no longer hide date state colors. Today now has a pale red fill and border; the selected date has a solid red fill and visible ring. Playwright asserts the computed colors. Full unit, build, and 10-test E2E suites pass.
- Follow-up: increased today's color contrast after user feedback and verified the actual Task details date dialog; the previous computed color was gray because dialog styles overrode the earlier date rules. Full unit, build, and 10-test E2E suites pass.

## 2026-10-22 — Consolidated Markdown and JSON exports

- Moved bulk Markdown actions from the sidebars to `/export` and removed ZIP export. Added Export navigation to the task app, Tools, Settings, and archived-project navigation.
- Added JSON download, clipboard copy, and preview. The JSON document includes Inbox and project descriptions, all projects (including archived), sections, flat tasks and the nested task tree, dates, labels, task descriptions, timestamps, and comments.
- Added unit and Playwright checks for JSON content, downloads, clipboard copy, preview, and removing bulk export buttons from Tools/Settings navigation. Verification: `pnpm test`, `pnpm build`, and all 10 Playwright tests pass.

## 2026-10-22 — Scoped Markdown and JSON export dialog

- Replaced Inbox/project header Markdown buttons with one Export action and a dialog for Markdown/JSON previews and clipboard copies. Scope JSON includes the selected Inbox or project, descriptions, sections, full task data/tree, dates, labels, and comments.
- Updated frontend and Playwright checks for scoped export actions and content. Verification: `pnpm test`, `pnpm build`, and all 10 Playwright tests pass.

## 2026-10-22 — Refine scoped Export dialog

- Restyled the Inbox/project Export action as a spaced primary button and rebuilt its dialog to match `/export` Markdown/JSON cards.
- Preview dialogs now layer over the options dialog; closing a preview returns to the options. Added unit and Playwright assertions. Verification: `pnpm test`, `pnpm build`, and all 10 Playwright tests pass.

## 2026-10-22 — Task details location picker includes sections

- Extended the Task details location dropdown to list Inbox, projects, and project sections, labeled as `Project / Section`. Selecting an option moves the task to the matching project and section.
- Updated frontend and Playwright checks for moving a task into a project section. Verification: `pnpm test`, `pnpm build`, and all 10 Playwright tests pass.

## 2026-10-22 — Sort Task details location choices

- Sorted the Inbox, project, and project-section options in the Task details dropdown by their displayed names, case-insensitively. Added unit and Playwright assertions for alphabetical ordering.
- Verification: `pnpm test` and `pnpm build` pass; the Task details Playwright flow passes. The full E2E suite ran 9/10; the unrelated bulk JSON clipboard assertion timed out against the accumulated E2E database contents.

## 2026-10-22 — Independent descriptions for duplicated projects

- Project duplication now opens the newly created project, preventing edits from accidentally targeting the source project. Added UI and backend tests that edit the copy's description and assert the source remains unchanged.
- Rechecked clone integrity: sections and tasks receive new IDs, task section and parent references are remapped, and copied tasks remain visible in the new project. Verification: `pnpm test`, `pnpm build`, and the focused project-duplication Playwright test pass.

## 2026-10-22 — Add nested projects and drag between hierarchy levels

- Added nullable project `parentId`, the `0005_project_hierarchy` migration, subproject creation, and a project-parent API with cycle and missing-parent checks.
- Sidebar projects render as an indented tree. A project's menu can add a subproject; dropping onto a row nests the dragged project, while dropping above/below moves it to the target's parent level. Deleting a project promotes its immediate children to its parent level.
- Added backend hierarchy coverage and Playwright coverage for creating, nesting, and outdenting projects.
- Verification: `pnpm test` (62 unit tests) and `pnpm build` pass; focused Playwright subproject workflow passes. Full Playwright run: 10/11 pass; the existing broad project/sections/tasks scenario exceeded its 30-second limit under the parallel full run, while the new hierarchy scenario passed.

## 2026-10-22 — Nested projects and drag placement

- Added persisted `parentId` hierarchy, subproject creation in project menus, nested sidebar indentation, and drag targets for moving projects inside another project or back to a shallower level. Parent cycles are rejected; project ordering is scoped to siblings.
- Added schema migration plus backend, frontend, and Playwright coverage for creation, nesting, unnesting, cycle rejection, and sibling order. Verification: `pnpm test`, `pnpm build`, and the subproject drag Playwright test pass.

## 2026-10-22 — Stabilize project drag-and-drop

- Native HTML5 drag events expose the project MIME type during `dragover`, but browsers protect `getData()` until `drop`; project hover now uses the active drag state when the payload is unavailable. This fixes real mouse drags that previously never reached the drop handler.
- Aligned sidebar tree sorting with server lexical ordering, prevented drops that would create a project cycle, preserved drop feedback while the pointer crosses row children, and sequenced move/reorder mutations with refresh on errors.
- Added Playwright checks for real mouse dragging, before/after sibling reordering with reload persistence, nesting/outdenting, stable hover feedback, and cycle prevention. The four focused drag scenarios pass. `pnpm test` (62 tests) and `pnpm build` pass. Full E2E on an isolated database passed 14/14 serially. The earlier run on the accumulated E2E DB timed out in three unrelated flows because of the large shared test dataset.

## 2026-10-22 — Save task description and comments with Ctrl+Enter

- Task description and new comment fields now save on Ctrl+Enter; regular Enter continues inserting a newline.
- Added a Russian hint below both fields explaining the shortcut.
- Verification: not run.

## 2026-10-22 — Use English shortcut hints

- Changed the task description and add-comment Ctrl+Enter hints to English.
- Ensured the description hint appears directly below its text field.
- Verification: not run.

## 2026-10-22 — Improve mobile usability

- Replaced the cramped mobile sidebar behavior with a horizontally scrollable sticky navigation strip that keeps Inbox, views, and projects reachable.
- Made the task workspace full width on phones, enlarged task completion/action touch targets, and improved narrow-screen wrapping.
- Made task details use the full mobile viewport with safe-area padding, larger controls, and a compact breadcrumb header.
- Verification: not run.

## 2026-10-22 — Add mobile hamburger navigation

- Added a hamburger control for small screens that opens a full-height left navigation drawer with a backdrop and close button.
- Restored project navigation and project creation controls inside the mobile drawer; desktop navigation remains in its existing layout.
- Verification: not run.

## 2026-10-22 — Close mobile navigation after scope selection

- The mobile sidebar now closes after selecting Inbox or a project.
- Verification: not run.

## 2026-10-22 — Add hamburger navigation to secondary pages

- Added the mobile sidebar toggle, backdrop, and close control to Tools, Settings, and Archived projects pages.
- Verification: not run.

## 2026-10-22 — Use React Router for client-side navigation

- Added `react-router-dom` and wrapped the application in `BrowserRouter`.
- Converted navigation links between Tasks, Tools, Settings, Archived projects, Dates, Labels, and Export to router links, and routed project selection through `useNavigate`.
- Route rendering now follows React Router location updates; back/forward navigation remains supported without full document reloads.
- Verification: frontend production build passes. Tests not run.

## 2026-10-22 — Preserve sidebar scroll across route changes

- Shared the latest sidebar scroll position across Tasks, Tools, Settings, and Archived projects navigation mounts.
- Restores the stored position when each route's sidebar mounts, avoiding the jump to the top after navigation.
- Verification: frontend production build passes.

## 2026-10-22 — Normalize project labels and archived navigation

- Removed the inconsistent `#` prefix from project names in Tools and Settings sidebars.
- Expanded the Archived projects sidebar to include search, Add task, all navigation destinations, active projects, and Add project, matching the other app areas.
- Verification: frontend production build passes.

## 2026-10-22 — Prevent task action labels overlapping on phones

- Hid the visible text labels for Edit, Subtask, and Delete on mobile while retaining their accessible names and icons.
- Reserved fixed touch targets for action icons and kept the task title in a flexible, wrapping column.
- Verification: frontend production build passes.

## 2026-10-22 — Keep task dates out of mobile action columns

- Grouped each task title and its due-date/label metadata as one mobile grid item while preserving the desktop grid layout.
- Dates and labels now flow beneath the title, leaving action icons in their fixed columns and preventing Delete from wrapping to another row.
- Verification: frontend production build passes.

## 2026-10-22 — Add touch drag handles for mobile tasks and projects

- Added mobile-only drag handles for task rows and sidebar projects, with touch-based drop placement/reordering and project nesting.
- Kept existing desktop HTML drag-and-drop behavior; no additional library was needed.
- Verification: frontend production build passes; `git diff --check` passes.

## 2026-10-22 — Show mobile drag destinations

- Updated touch drag handlers to track the element under the finger and set the same task/project drop state used by desktop drag feedback.
- Mobile task drops now show before/after/inside indicators while moving; project drops show the insertion line or nesting highlight.
- Verification: frontend production build passes; `git diff --check` passes.

## 2026-10-22 — Keep mobile project drag handles visible

- Overrode the desktop hover-only project button visibility rule so project drag handles stay visible in the mobile sidebar.
- Verification: frontend production build passes.

## 2026-10-22 — Make mobile project nesting drops reliable

- Mobile project drags now retain the last valid destination and nesting position during touch movement, then use that recorded target on release.
- Expanded the center drop zone so nesting a project is easier on the compact mobile project rows.
- Verification: frontend production build passes; `git diff --check` passes.

## 2026-10-22 — Fix and test mobile project nesting

- Mobile project drags now retain and use the hovered project destination through touch release, including when the release target cannot be resolved.
- Added a frontend integration test that simulates dragging one project into another, checks the nesting highlight, and asserts `moveProject` receives the target parent ID.
- Updated an outdated Description test to save with Ctrl+Enter.
- Verification: full `pnpm test` passes (63 tests), frontend production build passes, and `git diff --check` passes.

## 2026-10-22 — Fix touch pointer start for mobile project nesting

- Removed the `button === 0` gate from mobile pointer drag starts so touch events without a `button` value are not discarded.
- The frontend integration test now omits `button` and checks the drag starts, highlights the destination, and calls `moveProject` with the target parent.
- Added a Playwright Chromium mobile viewport test using CDP touch input; it confirms the destination highlight and verifies the server stores the target as `parentId`.
- Verification: `pnpm test` passes (63 tests), `pnpm build` passes, and the focused touch E2E passes. A full serial E2E run passed 13/15; two unrelated existing scenarios failed (section reorder and task drag helper).

## 2026-10-22 — Show nested project indentation in the mobile sidebar

- Removed two narrow-screen CSS rules that reset project row indentation with `!important`, so child projects visibly indent in the mobile drawer.
- Extended the mobile touch E2E to assert the nested project renders with an 18px inline start offset after the API confirms its parent.
- Verification: `pnpm test` (63 tests), `pnpm build`, `git diff --check`, and the focused mobile touch E2E all pass.

## 2026-10-23 — Unify sidebar navigation across app pages

- Replaced page-specific sidebars on Tools, Settings, and Archived Projects with the shared `AppSidebar`, which includes the same project tree, drag handles, and project actions as the task workspace.
- Shared sidebar closes immediately on navigation clicks and whenever the router location changes, including query-only project/inbox changes.
- Added frontend coverage for repeat mobile route selection and a Playwright mobile flow that checks drawer closure and consistent project drag handles across pages.
- Verification: `pnpm test` (64 tests) and `pnpm build` pass. The Playwright scenario was added but could not complete in this environment because the local browser run stalled after starting; the default E2E web-server startup also collided with port 3100 in use.

## 2026-10-23 — Stabilize project drag and shared mobile navigation

- Made project creation resilient to an in-flight project query so newly created projects appear immediately without a page reload.
- Stabilized mobile project nesting by measuring coordinates after touch emulation starts, scrolling the handle into view, and exercising a realistic sequence of touch moves.
- Expanded project drag coverage for before, after, nested, outdented, invalid descendant, mouse, touch, persistence, and highlight cleanup behavior.
- Improved section drag target tracking and replaced the flaky section reorder E2E gesture with a complete browser drag event sequence.
- Kept the same full sidebar on task, tools, settings, and archived pages; mobile navigation now closes synchronously after every route selection.
- Updated task drag helpers to target the actual task row, avoiding ambiguous nested content elements.
- Verification: `pnpm test` passes (64 tests), `pnpm build` passes, focused touch drag passes 5 consecutive runs, full Playwright passes (16 tests), and `git diff --check` passes.

## 2026-10-23 — Adapt Task details for small mobile screens

- Made the Task details dialog a true full-screen mobile view with a compact safe-area-aware header, one vertical scroll container, and no horizontal overflow.
- Reordered mobile content so project, date, and label metadata appears directly below the task title and description, before subtasks and comments.
- Added mobile spacing, wrapping, touch-sized controls, full-width comment/subtask actions, and a bottom-sheet presentation for the date picker.
- Raised the task dialog above mobile navigation controls and added extra handling for screens narrower than 380px.
- Added a Playwright test at a 360×640 viewport covering dialog bounds, wrapping, content order, overflow, metadata access, and comment controls.
- Verification: `pnpm test` passes (64 tests), `pnpm build` passes, full Playwright passes (17 tests), and `git diff --check` passes.

## 2026-10-23 — Adapt Add date for mobile screens

- Made the Add/Change date overlay viewport-fixed on phones so it is independent of the parent Task details or Add task dialog dimensions.
- Presented the picker as a safe-area-aware bottom sheet with a drag affordance, contained scrolling, and no horizontal overflow.
- Changed quick date choices to a touch-sized 2×2 grid and made the date input, month controls, calendar cells, and action buttons fit narrow screens.
- Applied the same quick-date styling to Add task and Task details date pickers.
- Added Playwright coverage at 320×568 for viewport bounds, overflow, quick-date layout, today highlighting, selection behavior, and returning to the Add task dialog.
- Verification: `pnpm test` passes (64 tests), `pnpm build` passes, full Playwright passes (18 tests), and `git diff --check` passes.

## 2026-10-23 — Show task descriptions and comment counts in lists

- Task rows now show a non-empty description directly below the title in Inbox, projects, sections, Dates, and Labels views.
- Long descriptions stay on one line and use a visual ellipsis while retaining the full text in the element title.
- Tasks with comments show a comment icon and accessible comment count alongside dates and labels.
- Added unit and Playwright coverage for description rendering, real overflow truncation, comment creation, and count updates.

## 2026-10-23 — Replace label inputs with a shared label picker

- Added one reusable label picker for Add task and Task details with removable chips, Enter-to-add, Backspace removal, Escape cancellation, comma-separated paste support, and filtered suggestions from existing labels.
- Label changes in Task details save immediately, with optimistic local state preventing rapid consecutive additions from overwriting one another.
- Added responsive Todoist-style picker visuals, keyboard-accessible suggestions, focus treatment, and compact chip controls.
- Added unit and Playwright coverage for custom labels, suggestions, removal, keyboard behavior, and Add task integration.
- Verification: `pnpm test` passes (66 tests), `pnpm build` passes, full Playwright passes (20 tests), and `git diff --check` passes.

## 2026-10-23 — Improve the Dates month calendar

- Rebuilt the Dates calendar as a stable six-week month grid with Monday-first weekday headings, adjacent-month days, weekend styling, task counts, project or Inbox context, and a prominent current-day marker.
- Added polished month navigation, a Today action, a direct month selector, and a monthly task summary.
- Made the calendar readable on narrow screens through a responsive toolbar and contained horizontal scrolling instead of compressing seven columns.
- Preserved task details opening and made task drag-and-drop between dates more reliable with a drag-state fallback when browser `DataTransfer` is incomplete.
- Added frontend coverage for the 42-cell calendar, weekday alignment, today state, month navigation, and task context, plus Playwright coverage for mobile layout and persisted date drag-and-drop.
- Verification: `pnpm test` passes (67 tests), `pnpm build` passes, full serial Playwright passes (21 tests), and `git diff --check` passes.

## 2026-10-23 — Keep calendar dates and tasks visible on mobile

- Removed the horizontally oversized mobile calendar that initially hid later weekdays, including the current day and its tasks.
- Fit all seven weekday columns into the mobile viewport while keeping task titles visible for up to two lines inside their date cells.
- Hid secondary project text and compacted counts, spacing, and typography only on small screens.
- Strengthened Playwright coverage to assert that the current date and its task card are physically inside the viewport width, with no horizontal calendar overflow, and that date drag-and-drop still works.
- Verification: `pnpm test` passes (67 tests), `pnpm build` passes, full serial Playwright passes (21 tests), and `git diff --check` passes.

## 2026-10-25 — Fix comment submission in Android browsers

- Comment submission no longer assumes `crypto.randomUUID()` exists. It falls back to a timestamp plus random suffix, covering Android browsers opened over a non-secure local network connection.
- Updated both the Add comment button and Ctrl+Enter path, and exercised button submission with the UUID API unavailable.
- Verification: frontend tests pass (39 tests), frontend production build passes, and `git diff --check` passes. Full `pnpm test` remains blocked by the backend test server fixture: Supertest receives a null server address in all 16 backend tests.

## 2026-10-25 — Simplify empty task details on mobile

- On phone and tablet widths (up to 900px), hide empty Labels, Comments, and Date sections in Task details and show compact Add labels, Add comments, and Add date actions instead.
- Add labels reveals the label editor and focuses its input; Add comments reveals the comment editor and focuses its textarea; Add date opens the date dialog and focuses its date input. Existing values keep their sections visible.
- Added Playwright coverage to the mobile Task details scenario for hidden empty sections, shortcuts, and focus behavior.
- Verification: frontend tests pass (39 tests), frontend production build passes, and `git diff --check` passes. `pnpm test` remains blocked by the existing backend Supertest null server address issue. `pnpm test:e2e` could not start the configured webServer.

## 2026-10-25 — Add removable mobile task detail sections

- Styled the mobile Labels, Comments, and Date sections as separate cards with an X control in each section heading.
- Closing a section clears its corresponding task data, hides the section, and restores its Add action; the Add action is hidden while its section is open.
- Added frontend coverage that verifies labels, comments, and dates are cleared and their Add actions return.
- Verification: frontend tests pass (42 tests), frontend production build passes, and `git diff --check` passes.

## 2026-10-25 — Restore desktop task details presentation

- Kept the optional-section cards and close controls scoped to tablet/mobile widths (900px and below).
- Restored the desktop Date remove button and prevented the new optional-section heading wrapper from inheriting the sidebar's generic flex layout.
- Verification: frontend tests pass (42 tests), frontend production build passes, and `git diff --check` passes.

## 2026-10-25 — Add the mobile Subtasks collapse flow

- On phone and tablet widths, hide the empty Subtasks card and show Add subtasks. Opening it reveals the card and focuses the new subtask field; the Add button disappears while the card is open.
- Added an X control to the mobile Subtasks header. It deletes all direct child tasks (including their server-side descendants), closes the card, and restores Add subtasks.
- Added frontend tests for reveal/focus and deleting existing child tasks, and extended the mobile Playwright scenario.
- Verification: frontend tests pass (44 tests), frontend production build passes, and `git diff --check` passes. Playwright not rerun because its configured webServer did not start in the preceding session.

## 2026-10-25 — Ensure mobile Add subtasks opens its card

- Made the open/hidden state explicit on the Subtasks card, forced the open card to display at phone/tablet widths, and scroll it into view after tapping Add subtasks.
- Extended the unit and Playwright checks to assert that the card becomes visible after the tap.
- Verification: frontend tests pass (44 tests), frontend production build passes, and `git diff --check` passes. Playwright not run because its configured webServer could not start in this environment.

## 2026-10-25 — Prevent mobile Subtasks card height clipping

- The open Subtasks card now has a non-shrinking natural height in the mobile vertical flex layout, preventing its overflow clipping from truncating content.
- Extended the mobile Playwright scenario to create a subtask and verify the card body fits inside the card.
- Verification: frontend tests pass (44 tests), frontend production build passes, and `git diff --check` passes. Playwright not run because its configured webServer could not start in this environment.

## 2026-10-25 — Confirm deletion from mobile detail section controls

- Mobile close controls for Labels, Comments, and Subtasks now always ask before deleting data already saved on the task. Cancel keeps the section and its data intact.
- Empty sections or unsaved drafts close without a confirmation; saved data is cleared only after confirmation.
- Added coverage for declined confirmations across all three sections.
- Verification: frontend tests pass (45 tests), frontend production build passes, and `git diff --check` passes.

## 2026-10-25 — Collapse optional fields in mobile Add task dialog

- Added mobile-only shortcuts for Description, Date, and Labels to the Add task dialog; all three fields stay collapsed until requested, and empty fields can be cleared/collapsed with an X control.
- Description and Labels focus their inputs when opened; Add date opens the date picker and focuses its date input. Desktop fields remain visible with their existing controls.
- Added frontend and Playwright coverage for the mobile open/focus flow.
- Verification: frontend tests pass (46 tests), frontend production build passes, and `git diff --check` passes. Playwright could not start its configured webServer.

## 2026-10-25 — Keep Add task shortcuts off desktop UI

- Scoped the Add task compact shortcuts and collapsed-field styles to touch devices with a coarse pointer, so a narrow desktop window no longer displays mobile Add description/date/labels buttons.
- Added E2E checks for desktop fields remaining visible and mobile touch shortcuts/focus behavior; unit tests continue to cover the interactions.
- Verification: frontend tests pass (46 tests), frontend production build passes, and `git diff --check` passes. E2E could not start because the configured Playwright webServer exited during startup.

## 2026-10-25 — Correct desktop visibility of Add task shortcuts

- Fixed CSS specificity: the generic Add task form rule for direct child divs had overridden the rule that hides the mobile shortcut row, leaving its buttons visible on desktop. The shortcut row now uses a selector strong enough to remain hidden on desktop and becomes visible only under the mobile touch media query.
- Desktop E2E coverage for this visibility is present; E2E execution remains blocked by Playwright webServer startup.
- Verification: frontend tests pass (46 tests), frontend production build passes, and `git diff --check` passes.

## 2026-10-25 — Keep quick add visible on mobile

- Added a fixed, bottom-right mobile quick-add button with a plus icon; it opens the task form using the current project or section placement.
- Added mobile E2E assertions for button visibility and viewport placement.
- Verification: frontend tests pass (46 tests), frontend production build passes, and `git diff --check` passes. E2E could not start because the configured Playwright webServer exited during startup.

## 2026-11-08 — Make attachment upload notifications visible

- Replaced Sonner with React-Toastify, imported its stylesheet, and portaled its bottom-right `ToastContainer` to `document.body` above the task dialog. Attachment confirmation notices appear immediately on paste or file selection, and stay visible for five seconds.
- Added frontend and E2E assertions that the toast is visible at attachment time. Frontend tests/build and the focused attachment E2E pass.

## 2026-11-08 — Keep Attachments page after opening a task

- Fixed task links in the Attachments library to open task details without navigating away from `/attachments`; closing the dialog now leaves the attachment list in place.
- Added frontend regression coverage for the route before and after opening and closing the task dialog.
- Verification: `pnpm test` (98 tests), `pnpm build`, focused attachment E2E (1 passed), and `git diff --check` pass.

## 2026-11-08 — Serve the Attachments SPA route in development

- Vite previously proxied `GET /attachments` to the API, so reloading the Attachments page returned an API 404. The proxy now bypasses HTML navigation requests and serves the SPA, while attachment API/file requests remain proxied.
- Added an E2E reload assertion on the Attachments page. Verification: all 98 unit/integration tests pass, production build passes, focused attachment E2E passes, and `git diff --check` passes.

## 2026-11-08 — Add an explicit attachments feature flag

- Added `MYTODO_ATTACHMENTS_ENABLED` (defaults to `false`) as the explicit gate for attachment UI and API. Enabling it requires a writable `MYTODO_ATTACHMENTS_DIR`; startup reports a clear error if the directory is missing or invalid. Dev Compose and E2E explicitly enable attachments, while production examples document opt-in behavior.
- Hid existing attachment previews and links in task dialogs when disabled; added frontend and backend regression coverage.
- Verification: all 100 unit/integration tests pass, production build passes, attachment E2E passes, and `git diff --check` passes.

## 2026-11-08 — Focus comment text when editing

- Set autofocus on the comment editor shown after clicking Edit. Added a frontend assertion that the editor owns focus and an E2E assertion for the same interaction.
- Verification: all 100 unit/integration tests pass, production build passes, focused comment E2E passes, and `git diff --check` passes.

## 2026-11-08 — Make project archiving opt-in

- Added `MYTODO_PROJECT_ARCHIVING_ENABLED`, defaulting to false in the backend and Compose. The feature status is published to the frontend; archive controls and the archived-project page are hidden when disabled, while existing archived projects remain visible. The archive API returns 503 when disabled.
- Added backend and frontend regression tests, an enabled-feature E2E check, and documented the environment setting.
- Verification: all 102 unit/integration tests pass, production build passes, focused E2E passes, and `git diff --check` passes. The unrelated full mobile sidebar E2E scenario failed while reopening navigation after its Dates route step.

## 2026-11-08 — Remove Initial comment from Add task

- Removed the Initial comment textarea from task creation and removed its draft state. New tasks still upload selected or pasted files as an attachment-only comment.
- Added a component assertion that the field is absent and retained the paste-upload regression check; the Playwright task creation helper also asserts the field is absent.
- Verification: all 102 unit/integration tests pass, production build passes, task creation E2E passes, and `git diff --check` passes.

## 2026-11-08 — Add an API for Playwright E2E setup

- Added an authenticated `/api/playwright/reset` endpoint gated by `MYTODO_ENABLE_PLAYWRIGHT_API`; backend startup rejects enabling it in production or without a database URL. Playwright enables it only in its development server config, and the fixture resets the isolated test database before each case.
- Added functional API helpers in `e2e/api.ts` for projects, sections, tasks, task updates, archiving, and reset. Replaced repeated UI setup for projects/tasks while keeping dedicated UI creation coverage. Documented this setup in README.
- Fixed the mobile comment form width selector and made E2E checks robust for multiline Markdown comments and the form's actual layout.
- Verification: `pnpm test` (103 tests), `pnpm build`, and full `pnpm test:e2e` (31 tests) pass; `git diff --check` passes.

## 2026-11-08 — Expand the Playwright data API and reduce setup navigation

- Added authenticated, dev-only endpoints for allowlisted table cleanup (`tasks`, `task_comments`, `sections`, `projects`) and entity creation (task, project, section, comment, attachment). Attachment setup writes a generated file key and metadata; table cleanup removes owned attachment files. Added an E2E scenario covering creation and selective cleanup.
- The Playwright fixture now authenticates and resets through API requests before opening the SPA. Added batch setup helpers that create multiple tasks/projects before a single page reload, and batched mobile drag fixture setup.
- Documented endpoint capabilities. Verification: `pnpm test` (103 tests), `pnpm build`, full `pnpm test:e2e` (32 tests), E2E TypeScript check, and `git diff --check` pass.
# 2026-11-08 — Split frontend screens and add code quality tools

- Extracted Tools, Settings, Admin Users, Archived Projects, and Login screens from `App.tsx` into lazy-loaded page modules. Moved repeated query keys, date helpers, and quick-add keyboard behavior into shared modules; extracted comment Markdown and attachment preview UI into a component.
- Added Biome scripts and configuration for the new shared/page modules. Added a Vite vendor chunk so production JS chunks remain below the 500 KiB warning threshold.
- Verification: `pnpm lint`, `pnpm format:check`, `pnpm test` (104 tests), and `pnpm build` pass. `pnpm test:e2e` started and passed its first three scenarios, but its runner did not complete in the available process window; a retry was blocked by occupied configured web-server URLs.
