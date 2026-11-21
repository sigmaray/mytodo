import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { getDatabaseUrl } from "./database-url";
import { createPostgresTaskRepositoryFactory } from "./db/repository";
import { createPostgresUserRepository } from "./db/users-repository";

/** Backend TCP port, defaulting to 3000. */
const port = Number(process.env.PORT ?? 3000);
/** Connection string assembled from environment variables. */
const databaseUrl = getDatabaseUrl();
/** Runtime mode that controls protected features. */
const mode = process.env.NODE_ENV ?? "development";
/** In production, cookies use the Secure flag unless explicitly set to false. */
const secureCookies = process.env.MYTODO_COOKIE_SECURE?.trim().toLowerCase() !== "false";
/** Whether comment file uploads are enabled. */
const attachmentsEnabled = process.env.MYTODO_ATTACHMENTS_ENABLED?.trim().toLowerCase() === "true";
/** Whether project archiving is enabled. */
const projectArchivingEnabled = process.env.MYTODO_PROJECT_ARCHIVING_ENABLED?.trim().toLowerCase() === "true";
/** Whether the Playwright helper API is enabled. */
const playwrightApiEnabled = process.env.MYTODO_ENABLE_PLAYWRIGHT_API?.trim().toLowerCase() === "true";
/** Path to the private attachment directory, if configured. */
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
/** The factory gives each authenticated user a repository scoped to their UUID. */
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
