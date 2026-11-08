import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const backendPort = process.env.E2E_BACKEND_PORT ?? "3100";
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "5174";
const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgres://todoist:todoist@127.0.0.1:5432/todoist_e2e";

export default defineConfig({
  testDir: "./e2e",
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? "/tmp/todoist-clone-playwright-results",
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: `DATABASE_URL=${databaseUrl} MYTODO_ATTACHMENTS_DIR=/tmp/mytodo-e2e-attachments MYTODO_ATTACHMENTS_ENABLED=true MYTODO_PROJECT_ARCHIVING_ENABLED=true MYTODO_ENABLE_PLAYWRIGHT_API=true pnpm --filter @todoist-clone/backend exec drizzle-kit migrate --config drizzle.config.ts && DATABASE_URL=${databaseUrl} pnpm --filter @todoist-clone/backend users update admin --password=todoist-e2e-password && DATABASE_URL=${databaseUrl} MYTODO_ATTACHMENTS_DIR=/tmp/mytodo-e2e-attachments MYTODO_ATTACHMENTS_ENABLED=true MYTODO_PROJECT_ARCHIVING_ENABLED=true MYTODO_ENABLE_PLAYWRIGHT_API=true PORT=${backendPort} pnpm --filter @todoist-clone/backend dev`,
      url: `http://127.0.0.1:${backendPort}/auth/status`,
      reuseExistingServer: false
    },
    {
      command: `VITE_API_TARGET=http://127.0.0.1:${backendPort} pnpm --filter @todoist-clone/frontend dev --host 127.0.0.1 --port ${frontendPort}`,
      url: `http://127.0.0.1:${frontendPort}`,
      reuseExistingServer: false
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
