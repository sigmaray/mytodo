import type { Hono } from "hono";
import type { TaskRepository } from "./repository";

/** Тип приложения Hono с идентификатором пользователя из auth middleware. */
export type AppHono = Hono<{ Variables: { userId: string; authenticated: boolean } }>;
/** По идентификатору пользователя выбирает принадлежащий ему репозиторий задач. */
export type RepositoryForUser = (userId: string) => TaskRepository;
