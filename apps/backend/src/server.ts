import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createPostgresTaskRepositoryFactory } from "./db/repository";
import { createPostgresUserRepository } from "./db/users-repository";
import { getDatabaseUrl } from "./database-url";

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = getDatabaseUrl();
const mode = process.env.NODE_ENV ?? "development";
const taskRepositoryFor = createPostgresTaskRepositoryFactory(databaseUrl);

serve({
  fetch: createApp(taskRepositoryFor, {
    databaseUrl,
    mode,
    userRepository: createPostgresUserRepository(databaseUrl)
  }).fetch,
  port
});

console.log(`API listening on http://127.0.0.1:${port}`);
