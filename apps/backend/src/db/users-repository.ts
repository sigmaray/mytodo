import { and, eq, gt, isNotNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { PublicUser, UserRecord, UserRepository } from "../users";
import { sessions, users } from "./schema";

const toPublicUser = (user: Pick<UserRecord, "id" | "username" | "isAdmin">): PublicUser =>
  Object.freeze({ id: user.id, username: user.username, isAdmin: user.isAdmin });

export const createPostgresUserRepository = (databaseUrl: string): UserRepository => {
  const client = postgres(databaseUrl, { max: 10 });
  const db = drizzle(client);

  return Object.freeze({
    getByUsername: async (username) => {
      const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
      const row = rows[0];
      return row === undefined
        ? null
        : Object.freeze({
            id: row.id,
            username: row.username,
            passwordHash: row.passwordHash,
            isAdmin: row.isAdmin,
            confirmDelete: row.confirmDelete,
            inboxDescription: row.inboxDescription,
          });
    },
    getById: async (id) => {
      const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
      const row = rows[0];
      return row === undefined
        ? null
        : Object.freeze({
            id: row.id,
            username: row.username,
            passwordHash: row.passwordHash,
            isAdmin: row.isAdmin,
            confirmDelete: row.confirmDelete,
            inboxDescription: row.inboxDescription,
          });
    },
    list: async () =>
      Object.freeze(
        (
          await db
            .select({ id: users.id, username: users.username, isAdmin: users.isAdmin })
            .from(users)
            .orderBy(users.username)
        ).map(toPublicUser),
      ),
    create: async (username, passwordHash, isAdmin) => {
      const rows = await db
        .insert(users)
        .values({ id: crypto.randomUUID(), username, passwordHash, isAdmin })
        .returning({ id: users.id, username: users.username, isAdmin: users.isAdmin });
      const row = rows[0];
      if (row === undefined) throw new Error("User insert failed");
      return toPublicUser(row);
    },
    update: async (id, patch) => {
      const { passwordHash, ...publicPatch } = patch;
      const rows = await db
        .update(users)
        .set({ ...publicPatch, passwordHash })
        .where(eq(users.id, id))
        .returning({ id: users.id, username: users.username, isAdmin: users.isAdmin });
      if (passwordHash !== undefined) await db.delete(sessions).where(eq(sessions.userId, id));
      const row = rows[0];
      return row === undefined ? null : toPublicUser(row);
    },
    setPassword: async (id, passwordHash) => {
      const rows = await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, id))
        .returning({ id: users.id });
      await db.delete(sessions).where(eq(sessions.userId, id));
      return rows.length > 0;
    },
    delete: async (id) =>
      client.begin(async (transaction) => {
        await transaction`DELETE FROM tasks WHERE user_id = ${id}`;
        await transaction`DELETE FROM sections WHERE user_id = ${id}`;
        await transaction`DELETE FROM projects WHERE user_id = ${id}`;
        await transaction`DELETE FROM sessions WHERE user_id = ${id}`;
        const deleted = await transaction`DELETE FROM users WHERE id = ${id} RETURNING id`;
        return deleted.length > 0;
      }),
    hasPasswordUsers: async () =>
      (await db.select({ id: users.id }).from(users).where(isNotNull(users.passwordHash)).limit(1)).length >
      0,
    saveSession: async (tokenHash, userId, expiresAt) => {
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
      await db
        .insert(sessions)
        .values({ tokenHash, userId, expiresAt })
        .onConflictDoUpdate({ target: sessions.tokenHash, set: { userId, expiresAt } });
    },
    getSessionUserId: async (tokenHash, now) => {
      const rows = await db
        .select({ userId: sessions.userId })
        .from(sessions)
        .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
        .limit(1);
      return rows[0]?.userId ?? null;
    },
    deleteSession: async (tokenHash) => {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },
    deleteAllSessions: async (userId) => {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    },
    savePreferences: async (id, confirmDelete, inboxDescription) => {
      await db.update(users).set({ confirmDelete, inboxDescription }).where(eq(users.id, id));
    },
    close: async () => {
      await client.end();
    },
  });
};
