import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { TaskRepository } from "../repository";
import { defaultAdminUserId } from "../users";
import { createPostgresProjectMethods } from "./postgresProjectMethods";
import { createPostgresSectionMethods } from "./postgresSectionMethods";
import { createPostgresTaskMethods } from "./postgresTaskMethods";

export const createPostgresTaskRepository = (
  databaseUrl: string,
  userId = defaultAdminUserId,
  sharedClient?: postgres.Sql,
): TaskRepository => {
  const client = sharedClient ?? postgres(databaseUrl, { max: 10 });
  const db = drizzle(client);

  return Object.freeze({
    ...createPostgresProjectMethods(db, client, userId),
    ...createPostgresSectionMethods(db, client, userId),
    ...createPostgresTaskMethods(db, client, userId),
  });
};

export const createPostgresTaskRepositoryFactory = (databaseUrl: string) => {
  const sharedClient = postgres(databaseUrl, { max: 10 });
  let repositories = Object.freeze({} as Readonly<Record<string, TaskRepository>>);
  return (userId: string): TaskRepository => {
    const existing = repositories[userId];
    if (existing !== undefined) return existing;
    const created = createPostgresTaskRepository(databaseUrl, userId, sharedClient);
    repositories = Object.freeze({ ...repositories, [userId]: created });
    return created;
  };
};
