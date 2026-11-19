import type { Hono } from "hono";
import type { TaskRepository } from "./repository";

/**
 * Hono application type with the user ID set by authentication middleware.
 *
 * @typedef {Object} AppHono
 * @property {{ userId: string; authenticated: boolean }} Variables - Request variables available to route handlers.
 * @property {string} Variables.userId - ID of the authenticated user.
 * @property {boolean} Variables.authenticated - Whether the request has an authenticated session.
 */
export type AppHono = Hono<{ Variables: { userId: string; authenticated: boolean } }>;
/**
 * Returns the task repository belonging to the specified user ID.
 *
 * @typedef {(userId: string) => TaskRepository} RepositoryForUser
 */
export type RepositoryForUser = (userId: string) => TaskRepository;
