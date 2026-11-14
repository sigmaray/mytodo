import type { Hono } from "hono";
import type { TaskRepository } from "./repository";

/**
 * Тип приложения Hono с идентификатором пользователя из auth middleware.
 *
 * @typedef {Object} AppHono
 * @property {{ userId: string; authenticated: boolean }} Variables - Данные «variables», используемые типом «AppHono».
 * @property {string} Variables.userId - Данные «variables пользователь id», используемые типом «AppHono».
 * @property {boolean} Variables.authenticated - Признак или настройка «variables аутентификация».
 */
export type AppHono = Hono<{ Variables: { userId: string; authenticated: boolean } }>;
/**
 * По идентификатору пользователя выбирает принадлежащий ему репозиторий задач.
 *
 * @typedef {(userId: string) => TaskRepository} RepositoryForUser
 */
export type RepositoryForUser = (userId: string) => TaskRepository;
