import { rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { getRequestListener } from "@hono/node-server";
import request from "supertest";
import { createApp } from "./app";
import { hashPassword } from "./auth";
import { createMemoryTaskRepository } from "./repository";
import { createMemoryUserRepository } from "./users";

/** Servers to close after API tests finish. */
export const activeServers = new Set<Server>();

/** Temporary test directories to remove during cleanup. */
export const temporaryDirectories = new Set<string>();

/**
 * Starts a Hono application on an available local port for Supertest.
 *
 * @param {ReturnType<typeof createApp>} app
 * @returns The started server and its base URL.
 */
export const createTestServer = async (app: ReturnType<typeof createApp>) => {
  const server = createServer(getRequestListener(app.fetch));
  activeServers.add(server);
  /** A dynamic port prevents parallel tests from conflicting with each other. */
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
 * Creates an authenticated test agent with an administrator account.
 *
 * @param {{ projectArchivingEnabled?: boolean; }} [options]
 * @param {boolean} options.projectArchivingEnabled - Enables project archiving in the test application.
 * @returns The authenticated test agent and its account details.
 */
export const createTestAgent = async (options: { projectArchivingEnabled?: boolean } = {}) => {
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
 * Closes running servers and removes temporary test directories.
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
