import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { TaskRepository } from "../repository";
import { defaultAdminUserId } from "../users";
import { createPostgresProjectMethods } from "./postgresProjectMethods";
import { createPostgresSectionMethods } from "./postgresSectionMethods";
import { createPostgresTaskMethods } from "./postgresTaskMethods";

/**
 * Creates a PostgreSQL repository for projects, sections, and tasks.
 *
 * @param {string} databaseUrl
 * @param [userId]
 * @param {postgres.Sql} [sharedClient]
 * @returns {TaskRepository}
 */
export const createPostgresTaskRepository = (
  databaseUrl: string,
  userId = defaultAdminUserId,
  sharedClient?: postgres.Sql,
): TaskRepository => {
  const client = sharedClient ?? postgres(databaseUrl, { max: 10 });
  const db = drizzle(client);

  return {
    ...createPostgresProjectMethods(db, client, userId),
    ...createPostgresSectionMethods(db, client, userId),
    ...createPostgresTaskMethods(db, client, userId),
  };
};

/**
 * Creates a repository factory and reuses the connection for each user.
 *
 * @param {string} databaseUrl
 * @returns The user-scoped repository factory.
 */
export const createPostgresTaskRepositoryFactory = (databaseUrl: string) => {
  const sharedClient = postgres(databaseUrl, { max: 10 });
  let repositories = {} as Record<string, TaskRepository>;
  /** Cache repositories by UUID so their methods always use the same owner. */
  return (userId: string): TaskRepository => {
    const existing = repositories[userId];
    if (existing !== undefined) return existing;
    const created = createPostgresTaskRepository(databaseUrl, userId, sharedClient);
    repositories = { ...repositories, [userId]: created };
    return created;
  };
};
