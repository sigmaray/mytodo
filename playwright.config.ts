import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

/** Backend port used by the E2E server and browser. */
const backendPort = process.env.E2E_BACKEND_PORT ?? "3100";
/** Frontend development server port used during browser tests. */
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "5174";
/** E2E database URL; the dedicated URL takes precedence over DATABASE_URL. */
const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgres://todoist:todoist@127.0.0.1:5432/todoist_e2e";

export default defineConfig({
  /** Directory containing Playwright specs. */
  testDir: "./e2e",
  /** Store traces and reports in a temporary directory outside the repository. */
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? "/tmp/todoist-clone-playwright-results",
  /** Run tests sequentially to keep test data isolation predictable. */
  workers: 1,
  use: {
    /** Base frontend URL used for relative navigation in tests. */
    baseURL: `http://127.0.0.1:${frontendPort}`,
    /** Save a trace only when retrying a failed test. */
    trace: "on-first-retry",
  },
  webServer: [
    {
      /** Runs migrations, configures the test administrator, and starts the backend. */
      command: `DATABASE_URL=${databaseUrl} MYTODO_ATTACHMENTS_DIR=/tmp/mytodo-e2e-attachments MYTODO_ATTACHMENTS_ENABLED=true MYTODO_PROJECT_ARCHIVING_ENABLED=true MYTODO_ENABLE_PLAYWRIGHT_API=true pnpm --filter @todoist-clone/backend exec drizzle-kit migrate --config drizzle.config.ts && DATABASE_URL=${databaseUrl} pnpm --filter @todoist-clone/backend users update admin --password=todoist-e2e-password && DATABASE_URL=${databaseUrl} MYTODO_ATTACHMENTS_DIR=/tmp/mytodo-e2e-attachments MYTODO_ATTACHMENTS_ENABLED=true MYTODO_PROJECT_ARCHIVING_ENABLED=true MYTODO_ENABLE_PLAYWRIGHT_API=true PORT=${backendPort} pnpm --filter @todoist-clone/backend dev`,
      /** Wait for the backend session status endpoint to become available. */
      url: `http://127.0.0.1:${backendPort}/auth/status`,
      /** Do not reuse an unrelated server with different settings. */
      reuseExistingServer: false,
    },
    {
      /** Starts the frontend and points its API proxy at the test backend. */
      command: `VITE_API_TARGET=http://127.0.0.1:${backendPort} pnpm --filter @todoist-clone/frontend dev --host 127.0.0.1 --port ${frontendPort}`,
      /** Wait for the frontend to be ready before opening the browser. */
      url: `http://127.0.0.1:${frontendPort}`,
      /** Do not reuse a server started by another test suite. */
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      /** Runs the suite in Chromium with desktop Chrome settings. */
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
