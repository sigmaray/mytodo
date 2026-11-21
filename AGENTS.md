# AI Agent System Prompt & Architecture Rules

## Project Overview
Self-hosted Todoist clone (MVP). A fast, hierarchical task manager with drag-and-drop capabilities. Each installation is managed by an administrator and can contain multiple user accounts, with task data kept per user.

## Code Paradigm
- **NO CLASSES, NO OOP, NO `this` keyword.** This is a hard rule.
- Prefer pure functions when they make behavior easier to test and understand.
- Choose straightforward patterns suited to each layer and its frameworks; avoid imposing a single programming paradigm across the whole application.
- Use discriminated unions where they clarify domain states, and handle their variants explicitly.

## Tech Stack
- **Architecture:** Monorepo (pnpm workspaces).
  - `/packages/domain` - Shared types, business logic, pure functions.
  - `/apps/frontend` - React SPA.
  - `/apps/backend` - Node.js API.
- **Frontend:** React, Vite, TanStack Query (for server state & Optimistic UI), @dnd-kit (for tree drag-and-drop), Bootstrap CSS.
- **Backend:** Hono (functional routing), Drizzle ORM (functional SQL builder, no Active Record), Zod (validation).
- **Database:** PostgreSQL.
- **Testing:** 
  - Domain & Backend API: Vitest + Supertest. No class mocking.
  - Frontend UI: Vitest + React Testing Library (for basic component functionality).
  - E2E: Playwright.

## MVP Scope Constraints
- **Do NOT implement:** Recurring tasks, smart date NLP parsing, collaboration features, activity logs.
- **DO implement:** User accounts with administrator-managed accounts and per-user task data, infinite nesting (Adjacency List `parentId`), task priorities (P1-P4), boolean completion status, drag-and-drop reordering.
- **Sorting Mechanism:** Use Lexical Sorting (Fractional Indexing) for drag-and-drop to avoid mass database updates. Save as `lexicalOrder` string field.

## Code Style
- Extract business logic (like tree building and lexical sorting) into pure functions inside `/packages/domain` so they can be unit-tested without DB or Framework context.
- UI state management relies heavily on React Query's `onMutate` for Optimistic Updates.
- Frontend basic functionality (rendering, state updates, event dispatching) MUST be verified via Unit Tests before moving to E2E.
- E2E tests in Playwright must use functional helpers (closures), not Page Object Model classes. E2E testing is a mandatory part of the MVP.
- Organize frontend code by feature and responsibility. Keep `App.tsx` focused on application setup, route composition, and shared providers; put feature pages, substantial dialogs, reusable UI, hooks, API calls, and feature-specific helpers in focused modules. Do not keep expanding a central component with unrelated workflows. Extract a module when it owns a distinct UI flow or when a change would otherwise add substantial conditional/state logic to an existing component.
- Keep Hono route handlers as HTTP adapters: parse and validate input, enforce authentication/authorization, call a focused repository or functional service, and map the result to an HTTP response. Put multi-step business workflows and file-system operations in focused functional modules so they can be tested independently of routing.
- Use descriptive names and keep functions and modules focused on one responsibility. Prefer explicit data flow and small pure helpers over deeply nested handlers or broad components.
- Maintain the project's current comprehensive code comments. Add and update concise comments in English for exported and important internal functions, types, interfaces, type fields, function parameters, configuration fields, and test helpers so their purpose and contracts remain documented. Add comments to meaningful branches and expressions inside functions, including straightforward operations when a nearby explanation helps identify their intent or role in the flow. Document validation rules, assumptions, constraints, side effects, and decisions where they appear. Do not add a comment immediately before a `test(` or `it(` block when its test title already describes the scenario; put explanations for non-obvious setup on the setup code or helper instead. Keep comments synchronized with behavior when code changes; do not remove existing comments merely because the code appears self-explanatory. Avoid comments that are stale, contradictory, or unrelated to the code they describe.
- Every declared function (including local functions and named function expressions) and every data structure (including types, interfaces, and structured object declarations) MUST have a JSDoc comment in standard `/** ... */` format immediately before its declaration. Inline arrow-function callbacks passed directly as arguments do not need their own JSDoc; this includes callbacks such as array `map` handlers and test callbacks passed to `test` or `it`. Describe each documented function's purpose and relevant parameters/return value. For a data structure, describe its purpose and every field in that structure's JSDoc using `@property` tags; do not put field descriptions in separate comments inside the declaration. Use tags such as `@param`, `@returns`, and `@property` to document the contract. Keep the JSDoc concise, in English, and synchronized with the implementation.
- Do not add separate `@callback` JSDoc typedef blocks for TypeScript callback types. TypeScript already declares the callback signature; describe a callback-valued data field's purpose in its `@property` text without duplicating the signature.

  Examples:

  ```ts
  /** User account data returned by the API.
   * @property {string} id - Stable account identifier.
   * @property {string} name - Display name shown in the interface.
   */
  type UserAccount = {
    id: string;
    name: string;
  };

  /** Finds an account by its stable identifier.
   * @param accounts Accounts available to the current user.
   * @param id Identifier to look up.
   * @returns The matching account, or `undefined` when it does not exist.
   */
  const findAccount = (accounts: Array<UserAccount>, id: string): UserAccount | undefined => {
    for (const account of accounts) {
      if (account.id === id) return account;
    }
    return undefined;
  };
  ```

- Provide root-level `pnpm lint` and `pnpm format:check` scripts and run them for code changes. If either check is not configured, configure it as part of the next non-documentation code change; do not leave formatting and linting as manual review-only conventions.
- Keep the largest eagerly loaded frontend JavaScript chunk at or below Vite's 500 KiB warning threshold. Lazy-load substantial routes and tools that are not needed for the initial screen. Do not raise `build.chunkSizeWarningLimit` just to silence a warning; document a justified exception and its impact if the limit cannot be met.

## Development Workflow
- **Every important change MUST update and run tests.** When you add or change behavior, update or add unit tests (domain, backend API, frontend components) and E2E tests, then run the full suite (`pnpm test` for unit/integration and `pnpm test:e2e` for E2E) and make sure it is green before considering the work done. Do not report work as complete while any test is failing.
- Code changes MUST also pass `pnpm lint`, `pnpm format:check`, and `pnpm build`. Review build output for large-chunk warnings; split the route or dependency that creates an oversized initial chunk instead of suppressing the warning.
- **Maintain `MEMORY.md` at the repo root.** For each work session, append a short entry: date, what was done, key decisions, and the current state of the project. A new agent must read `MEMORY.md` first to rebuild context cheaply.
