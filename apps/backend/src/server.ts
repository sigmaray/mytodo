import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { getDatabaseUrl } from "./database-url";
import { createPostgresTaskRepositoryFactory } from "./db/repository";
import { createPostgresUserRepository } from "./db/users-repository";

// Порт, на котором backend принимает HTTP-запросы.
/** TCP-порт backend-сервера, по умолчанию 3000. */
const port = Number(process.env.PORT ?? 3000);
/** Строка подключения, собранная из переменных окружения. */
const databaseUrl = getDatabaseUrl();
/** Режим запуска, влияющий на защищённые функции. */
const mode = process.env.NODE_ENV ?? "development";
/** В production cookie Secure включён, если явно не установлен false. */
const secureCookies = process.env.MYTODO_COOKIE_SECURE?.trim().toLowerCase() !== "false";
/** Разрешена ли загрузка файлов комментариев. */
const attachmentsEnabled = process.env.MYTODO_ATTACHMENTS_ENABLED?.trim().toLowerCase() === "true";
/** Разрешено ли архивирование проектов. */
const projectArchivingEnabled = process.env.MYTODO_PROJECT_ARCHIVING_ENABLED?.trim().toLowerCase() === "true";
/** Разрешён ли вспомогательный Playwright API. */
const playwrightApiEnabled = process.env.MYTODO_ENABLE_PLAYWRIGHT_API?.trim().toLowerCase() === "true";
/** Путь к приватному каталогу вложений, если он настроен. */
const attachmentsDir = process.env.MYTODO_ATTACHMENTS_DIR?.trim() || undefined;
if (attachmentsEnabled && attachmentsDir === undefined) {
  throw new Error("MYTODO_ATTACHMENTS_DIR must be set when MYTODO_ATTACHMENTS_ENABLED=true");
}
if (attachmentsEnabled && attachmentsDir !== undefined) {
  if (!isAbsolute(attachmentsDir))
    throw new Error("MYTODO_ATTACHMENTS_DIR must be an absolute path inside the API container");
  await mkdir(attachmentsDir, { recursive: true });
  try {
    await access(attachmentsDir, constants.W_OK);
  } catch {
    throw new Error(`MYTODO_ATTACHMENTS_DIR is not writable: ${attachmentsDir}`);
  }
}
// Фабрика выдаёт каждому вошедшему пользователю репозиторий с его собственным UUID.
const taskRepositoryFor = createPostgresTaskRepositoryFactory(databaseUrl);

serve({
  fetch: createApp(taskRepositoryFor, {
    databaseUrl,
    mode,
    secureCookies: mode === "production" ? secureCookies : undefined,
    attachmentsEnabled,
    projectArchivingEnabled,
    playwrightApiEnabled,
    attachmentsDir,
    userRepository: createPostgresUserRepository(databaseUrl),
  }).fetch,
  port,
});

console.log(`API listening on http://127.0.0.1:${port}`);
