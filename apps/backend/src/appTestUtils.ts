import { rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { getRequestListener } from "@hono/node-server";
import request from "supertest";
import { createApp } from "./app";
import { hashPassword } from "./auth";
import { createMemoryTaskRepository } from "./repository";
import { createMemoryUserRepository } from "./users";

/** Серверы, которые нужно закрыть после завершения API-тестов. */
export const activeServers = new Set<Server>();

/** Временные каталоги тестов, подлежащие удалению в cleanup. */
export const temporaryDirectories = new Set<string>();

/**
 * Запускает Hono-приложение на свободном локальном порту для Supertest.
 *
 * @param {ReturnType<typeof createApp>} app
 * @returns Результат выполнения функции.
 */
export const createTestServer = async (app: ReturnType<typeof createApp>) => {
  const server = createServer(getRequestListener(app.fetch));
  activeServers.add(server);
  /** Динамический порт позволяет параллельным тестам не конфликтовать друг с другом. */
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  return server;
};

/**
 * Создаёт аутентифицированный тестовый agent с учётной записью администратора.
 *
 * @param {{ projectArchivingEnabled?: boolean; }} [options]
 * @param {boolean} options.projectArchivingEnabled - Разрешает архивирование проектов в приложении, созданном для теста.
 * @returns Результат выполнения функции.
 */
export const createTestAgent = async (
  options: /**
   * Поля этой структуры:
   * - `projectArchivingEnabled`: Разрешает архивирование проектов в приложении, созданном для теста.
   */
  {
    projectArchivingEnabled?: boolean;
  } = {},
) => {
  const userRepository = createMemoryUserRepository([
    {
      id: "test-admin",
      username: "test-admin",
      passwordHash: await hashPassword("test-admin-password"),
      isAdmin: true,
      confirmDelete: true,
      inboxDescription: "",
    },
  ]);
  const server = await createTestServer(
    createApp(createMemoryTaskRepository(), { userRepository, ...options }),
  );
  const agent = request.agent(server);
  await agent
    .post("/auth/login")
    .send({ username: "test-admin", password: "test-admin-password" })
    .expect(200);
  return agent;
};

/**
 * Закрывает запущенные серверы и удаляет временные каталоги тестовой среды.
 */
export const cleanupTestResources = async () => {
  const servers = [...activeServers];
  activeServers.clear();
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  await Promise.all(
    [...temporaryDirectories].map((directory) => rm(directory, { recursive: true, force: true })),
  );
  temporaryDirectories.clear();
};
