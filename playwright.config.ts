import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

/** Порт backend, используемый E2E-сервером и браузером. */
const backendPort = process.env.E2E_BACKEND_PORT ?? "3100";
/** Порт dev-сервера frontend во время браузерных сценариев. */
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "5174";
/** База для E2E: отдельный URL имеет приоритет над общим DATABASE_URL. */
const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgres://todoist:todoist@127.0.0.1:5432/todoist_e2e";

export default defineConfig({
  /** Каталог со спецификациями Playwright. */
  testDir: "./e2e",
  /** Выносит трассы и отчёты во временный каталог вне репозитория. */
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? "/tmp/todoist-clone-playwright-results",
  /** Выполняет тесты последовательно, чтобы изоляция тестовых данных была предсказуемой. */
  workers: 1,
  use: {
    /** Базовый адрес frontend, передаваемый относительным переходам в тестах. */
    baseURL: `http://127.0.0.1:${frontendPort}`,
    /** Сохраняет trace только при повторной попытке после ошибки. */
    trace: "on-first-retry",
  },
  webServer: [
    {
      /** Запускает миграции, настраивает тестового администратора и поднимает backend. */
      command: `DATABASE_URL=${databaseUrl} MYTODO_ATTACHMENTS_DIR=/tmp/mytodo-e2e-attachments MYTODO_ATTACHMENTS_ENABLED=true MYTODO_PROJECT_ARCHIVING_ENABLED=true MYTODO_ENABLE_PLAYWRIGHT_API=true pnpm --filter @todoist-clone/backend exec drizzle-kit migrate --config drizzle.config.ts && DATABASE_URL=${databaseUrl} pnpm --filter @todoist-clone/backend users update admin --password=todoist-e2e-password && DATABASE_URL=${databaseUrl} MYTODO_ATTACHMENTS_DIR=/tmp/mytodo-e2e-attachments MYTODO_ATTACHMENTS_ENABLED=true MYTODO_PROJECT_ARCHIVING_ENABLED=true MYTODO_ENABLE_PLAYWRIGHT_API=true PORT=${backendPort} pnpm --filter @todoist-clone/backend dev`,
      /** Дожидается доступности endpoint состояния сессии backend. */
      url: `http://127.0.0.1:${backendPort}/auth/status`,
      /** Не переиспользует случайно запущенный сервер с чужими настройками. */
      reuseExistingServer: false,
    },
    {
      /** Запускает frontend и направляет его API-прокси на тестовый backend. */
      command: `VITE_API_TARGET=http://127.0.0.1:${backendPort} pnpm --filter @todoist-clone/frontend dev --host 127.0.0.1 --port ${frontendPort}`,
      /** Ждёт готовности frontend до открытия браузера. */
      url: `http://127.0.0.1:${frontendPort}`,
      /** Не использует уже запущенный сервер из другого набора тестов. */
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      /** Запускает набор в Chromium с настройками настольного Chrome. */
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
