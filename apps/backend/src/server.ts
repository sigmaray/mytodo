import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createPostgresTaskRepositoryFactory } from "./db/repository";
import { createPostgresUserRepository } from "./db/users-repository";
import { getDatabaseUrl } from "./database-url";
import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute } from "node:path";

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = getDatabaseUrl();
const mode = process.env.NODE_ENV ?? "development";
const attachmentsDir = process.env.MYTODO_ATTACHMENTS_DIR?.trim() || undefined;
if (attachmentsDir !== undefined) {
  if (!isAbsolute(attachmentsDir)) throw new Error("MYTODO_ATTACHMENTS_DIR must be an absolute path inside the API container");
  await mkdir(attachmentsDir, { recursive: true });
  try {
    await access(attachmentsDir, constants.W_OK);
  } catch {
    throw new Error(`MYTODO_ATTACHMENTS_DIR is not writable: ${attachmentsDir}`);
  }
}
const taskRepositoryFor = createPostgresTaskRepositoryFactory(databaseUrl);

serve({
  fetch: createApp(taskRepositoryFor, {
    databaseUrl,
    mode,
    attachmentsDir,
    userRepository: createPostgresUserRepository(databaseUrl)
  }).fetch,
  port
});

console.log(`API listening on http://127.0.0.1:${port}`);
