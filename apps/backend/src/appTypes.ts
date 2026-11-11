import type { Hono } from "hono";
import type { TaskRepository } from "./repository";

export type AppHono = Hono<{ Variables: { userId: string; authenticated: boolean } }>;
export type RepositoryForUser = (userId: string) => TaskRepository;
