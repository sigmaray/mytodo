import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { TaskRepository } from "../repository";
import { defaultAdminUserId } from "../users";
import { createPostgresProjectMethods } from "./postgresProjectMethods";
import { createPostgresSectionMethods } from "./postgresSectionMethods";
import { createPostgresTaskMethods } from "./postgresTaskMethods";

/** Создаёт PostgreSQL-репозиторий с методами работы с проектами, секциями и задачами. */
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

/** Создаёт фабрику репозиториев и переиспользует соединение для каждого пользователя. */
export const createPostgresTaskRepositoryFactory = (databaseUrl: string) => {
  const sharedClient = postgres(databaseUrl, { max: 10 });
  let repositories = {} as Record<string, TaskRepository>;
  // Кэшируем репозиторий по UUID, чтобы его методы всегда работали с тем же владельцем.
  return (userId: string): TaskRepository => {
    const existing = repositories[userId];
    if (existing !== undefined) return existing;
    const created = createPostgresTaskRepository(databaseUrl, userId, sharedClient);
    repositories = { ...repositories, [userId]: created };
    return created;
  };
};
